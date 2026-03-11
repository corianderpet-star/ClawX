/**
 * Codex CLI OAuth — Browser-based OAuth for OpenAI Codex
 *
 * Implements the same PKCE authorization-code flow used by the Codex CLI.
 * The flow:
 *   1. Start a local HTTP callback server on 127.0.0.1 (random port).
 *   2. Build the authorize URL (ChatGPT issuer) with PKCE, then open in browser.
 *   3. Wait for the redirect callback with the authorization code.
 *   4. Exchange the code for tokens (id_token, access_token, refresh_token).
 *   5. Exchange the id_token for an OpenAI API key via token-exchange grant.
 *   6. Return the API key + tokens.
 */
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const DEFAULT_ISSUER = 'https://chatgpt.com';
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const SCOPES = 'openid profile email offline_access api.connectors.read api.connectors.invoke';
const CALLBACK_HOST = '127.0.0.1';

export type CodexCliOAuthCredentials = {
  /** Access token (JWT) — used directly by OpenClaw runtime as Bearer token */
  accessToken: string;
  /** Refresh token for re-authentication */
  refreshToken: string;
  /** Expiry timestamp (ms) */
  expiresAt: number;
  /** User email from id_token */
  email?: string;
};

export type CodexCliOAuthContext = {
  openUrl: (url: string) => Promise<void>;
  log: (msg: string) => void;
  progress: { update: (msg: string) => void; stop: (msg?: string) => void };
};

export class CodexOAuthError extends Error {
  detail: string;
  constructor(message: string, detail: string) {
    super(message);
    this.name = 'CodexOAuthError';
    this.detail = detail;
  }
}

// ── PKCE ────────────────────────────────────────────────────────

function generatePkce(): { verifier: string; challenge: string } {
  const bytes = randomBytes(64);
  const verifier = bytes.toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function generateState(): string {
  return randomBytes(24).toString('hex');
}

// ── Auth URL ────────────────────────────────────────────────────

function buildAuthorizeUrl(
  redirectUri: string,
  pkce: { verifier: string; challenge: string },
  state: string,
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SCOPES,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    state,
    codex_cli_simplified_flow: 'true',
    id_token_add_organizations: 'true',
  });
  return `${DEFAULT_ISSUER}/oauth/authorize?${params.toString()}`;
}

// ── Token exchange ──────────────────────────────────────────────

interface TokenResponse {
  id_token: string;
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  pkce: { verifier: string; challenge: string },
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID,
    code_verifier: pkce.verifier,
  });

  const response = await fetch(`${DEFAULT_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new CodexOAuthError(
      `Token exchange failed (${response.status})`,
      errorText,
    );
  }

  const data = (await response.json()) as TokenResponse;
  if (!data.refresh_token) {
    throw new Error('No refresh token received from OpenAI. Please try again.');
  }

  return data;
}

// ── Email extraction from JWT ───────────────────────────────────

function extractEmailFromIdToken(idToken: string): string | undefined {
  try {
    const parts = idToken.split('.');
    if (parts.length < 2) return undefined;
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
    return payload.email as string | undefined;
  } catch {
    return undefined;
  }
}

// ── Escaping ────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Main entry point ────────────────────────────────────────────

export async function loginCodexCliOAuth(
  ctx: CodexCliOAuthContext,
): Promise<CodexCliOAuthCredentials> {
  ctx.progress.update('Preparing OpenAI Codex OAuth...');

  const pkce = generatePkce();
  const state = generateState();

  const server = createServer();
  
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, CALLBACK_HOST, () => resolve());
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  if (!port) {
    server.close();
    throw new Error('Failed to bind callback server');
  }

  const redirectUri = `http://localhost:${port}/auth/callback`;
  const authUrl = buildAuthorizeUrl(redirectUri, pkce, state);

  ctx.progress.update('Complete sign-in in browser...');
  try {
    await ctx.openUrl(authUrl);
  } catch {
    ctx.log(`\nOpen this URL in your browser:\n\n${authUrl}\n`);
  }

  // Wait for callback
  const callbackResult = await new Promise<{ code: string }>((resolve, reject) => {
    let timeout: NodeJS.Timeout | null = null;

    const requestHandler = (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
      try {
        const requestUrl = new URL(req.url ?? '/', `http://${CALLBACK_HOST}:${port}`);

        if (requestUrl.pathname !== '/auth/callback') {
          if (requestUrl.pathname === '/success') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(
              "<!doctype html><html><head><meta charset='utf-8'/></head><body style='font-family:system-ui;text-align:center;padding:40px'>" +
              "<h2>✅ Authentication Complete</h2><p>You can close this window and return to ClawPlus.</p></body></html>",
            );
            return;
          }
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Not found');
          return;
        }

        const error = requestUrl.searchParams.get('error');
        const code = requestUrl.searchParams.get('code')?.trim();
        const callbackState = requestUrl.searchParams.get('state')?.trim();

        if (error) {
          const desc = requestUrl.searchParams.get('error_description') || error;
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(
            `<!doctype html><html><head><meta charset='utf-8'/></head><body style='font-family:system-ui;text-align:center;padding:40px'>` +
            `<h2>❌ Authentication Failed</h2><p>${escapeHtml(desc)}</p></body></html>`,
          );
          finish(new Error(`OAuth error: ${desc}`));
          return;
        }

        if (!code || !callbackState) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Missing code or state');
          finish(new Error('Missing OAuth code or state in callback'));
          return;
        }

        if (callbackState !== state) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(
            "<!doctype html><html><head><meta charset='utf-8'/></head><body style='font-family:system-ui;text-align:center;padding:40px'>" +
            "<h2>⚠️ Session Expired</h2><p>This authorization link is from a previous attempt. Please go back to ClawPlus and try again.</p></body></html>",
          );
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(
          "<!doctype html><html><head><meta charset='utf-8'/></head><body style='font-family:system-ui;text-align:center;padding:40px'>" +
          "<h2>✅ Authentication Complete</h2><p>You can close this window and return to ClawPlus.</p></body></html>",
        );

        finish(undefined, { code });
      } catch (err) {
        finish(err instanceof Error ? err : new Error('OAuth callback failed'));
      }
    };

    server.on('request', requestHandler);

    const finish = (err?: Error, result?: { code: string }) => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      server.removeListener('request', requestHandler);
      try {
        server.close();
      } catch {
        // ignore
      }
      if (err) {
        reject(err);
      } else if (result) {
        resolve(result);
      }
    };

    timeout = setTimeout(() => {
      finish(new CodexOAuthError(
        'OAuth login timed out. The browser did not redirect back.',
        `Waited 300s for callback on ${CALLBACK_HOST}:${port}`,
      ));
    }, 5 * 60 * 1000);
  });

  // Close the callback server (refactored approach handles it inline)
  
  ctx.progress.update('Exchanging authorization code for tokens...');
  const tokens = await exchangeCodeForTokens(callbackResult.code, redirectUri, pkce);

  const email = extractEmailFromIdToken(tokens.id_token);
  const expiresAt = tokens.expires_in
    ? Date.now() + tokens.expires_in * 1000 - 5 * 60 * 1000
    : Date.now() + 3600 * 1000;

  ctx.progress.stop('OpenAI Codex OAuth completed successfully');

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    email,
  };
}
