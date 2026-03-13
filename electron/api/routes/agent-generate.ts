/**
 * Agent Generate Route
 *
 * POST /api/agent/generate
 *   Body: { prompt: string }
 *   Returns: { success: boolean; config?: GeneratedAgentConfig; error?: string }
 *
 * Uses the default AI provider account to generate a complete agent config from
 * a user description prompt. Calls the provider's chat completions API directly
 * from the main process, bypassing the Gateway (which handles runtime chat).
 */
import type { IncomingMessage, ServerResponse } from 'http';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';
import { getProviderService } from '../../services/providers/provider-service';
import { getApiKey } from '../../utils/secure-storage';
import { getProviderConfig } from '../../utils/provider-registry';
import { getProviderSecret } from '../../services/secrets/secret-store';
import { proxyAwareFetch } from '../../utils/proxy-fetch';
import { logger } from '../../utils/logger';

/**
 * Resolve the API key / access token for an account, with multi-source fallback.
 *
 * Resolution order:
 *   1. `getApiKey(accountId)` — handles api_key & local secret types, plus
 *      the legacy `apiKeys` map.
 *   2. OAuth secret — extracts `accessToken` from an oauth-type secret.
 *   3. `getApiKey(vendorId)` — fallback for legacy setups where the key was
 *      stored under the vendor type name (e.g. "deepseek") instead of the
 *      account ID.
 */
async function resolveApiKeyForAccount(
  accountId: string,
  vendorId: string,
): Promise<string | null> {
  // 1. Standard lookup by account ID
  const key = await getApiKey(accountId);
  if (key) return key;

  // 2. OAuth secret (stores token in accessToken, not apiKey)
  try {
    const secret = await getProviderSecret(accountId);
    if (secret?.type === 'oauth' && secret.accessToken) {
      return secret.accessToken;
    }
  } catch {
    // ignore
  }

  // 3. Fallback: try vendor type name (e.g. "deepseek", "openai")
  if (vendorId && vendorId !== accountId) {
    const fallback = await getApiKey(vendorId);
    if (fallback) {
      logger.warn(
        `[agent-generate] API key not found for account "${accountId}", ` +
        `but found under vendor type "${vendorId}". Consider re-saving the provider.`,
      );
      return fallback;
    }
  }

  logger.error(
    `[agent-generate] No API key found for account="${accountId}" vendorId="${vendorId}"`,
  );
  return null;
}

interface GenerateRequest {
  prompt: string;
}

interface GeneratedAgentConfig {
  id: string;
  name: string;
  description: string;
  emoji: string;
  model?: string;
  toolProfile?: string;
  soulMd: string;
  tags: string[];
  requiredSkills?: string[];
}

const SYSTEM_PROMPT = `You are an AI agent configuration generator for ClawPlus (OpenClaw runtime).
Given a user's description, generate a complete agent configuration.

You MUST respond with a valid JSON object (no markdown, no code blocks, no extra text).
The JSON schema:
{
  "id": "string — lowercase alphanumeric with hyphens, 2-20 chars, e.g. 'code-reviewer'",
  "name": "string — display name, 2-30 chars, e.g. 'Code Reviewer'",
  "description": "string — one-line description, max 100 chars",
  "emoji": "string — single emoji representing the agent",
  "model": "string or null — model ID if specific model preferred, otherwise null",
  "toolProfile": "string or null — 'full' for full tool access, 'code' for code-only, null for default",
  "soulMd": "string — the SOUL.md content in Markdown. This defines the agent's role, personality, expertise, working principles, and behavioral guidelines. Should be 200-800 words. Use markdown headings and bullet points.",
  "tags": ["array of string tags describing the agent's capabilities, 2-5 tags"],
  "requiredSkills": ["array of skill IDs the agent needs, e.g. 'browser', 'memory'. Can be empty array."]
}

Known skill IDs: browser, memory, image-gen, code-exec, web-search, file-manager, mcp-*.

Guidelines:
- The SOUL.md should be detailed and specific to the described role
- Use professional, clear language in the SOUL.md
- Include specific behavioral rules and constraints
- The ID should be descriptive but concise
- Tags should be relevant keywords`;

export async function handleAgentGenerateRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  _ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname !== '/api/agent/generate' || req.method !== 'POST') {
    return false;
  }

  try {
    const body = await parseJsonBody<GenerateRequest>(req);
    if (!body.prompt || !body.prompt.trim()) {
      sendJson(res, 400, { success: false, error: 'Prompt is required' });
      return true;
    }

    const svc = getProviderService();
    const defaultId = await svc.getDefaultAccountId();
    if (!defaultId) {
      sendJson(res, 400, {
        success: false,
        error: 'No default AI provider configured. Please set up a provider in Settings > AI Providers.',
      });
      return true;
    }

    const account = await svc.getAccount(defaultId);
    if (!account || !account.enabled) {
      sendJson(res, 400, {
        success: false,
        error: 'Default AI provider is not available or disabled.',
      });
      return true;
    }

    const apiKey = await resolveApiKeyForAccount(defaultId, account.vendorId);
    const vendorConfig = getProviderConfig(account.vendorId);

    const baseUrl = account.baseUrl || vendorConfig?.baseUrl;
    // Force chat completions for agent generation — the Responses API
    // requires the `api.responses.write` scope which OAuth / restricted
    // API keys often lack.  Chat Completions works universally and is
    // sufficient for a single-turn JSON generation call.
    const rawProtocol = account.apiProtocol || vendorConfig?.api || 'openai-completions';
    const protocol = rawProtocol === 'openai-responses' ? 'openai-completions' : rawProtocol;
    const model = account.model || vendorConfig?.models?.[0]?.id;

    if (!baseUrl) {
      sendJson(res, 400, {
        success: false,
        error: 'Provider base URL is not configured.',
      });
      return true;
    }

    if (!apiKey) {
      sendJson(res, 400, {
        success: false,
        error: 'API key not found for the default provider. Please re-enter your API key in Settings > AI Providers.',
      });
      return true;
    }

    const userMessage = `Generate an AI agent configuration based on the following requirements:\n\n${body.prompt.trim()}`;
    let config: GeneratedAgentConfig;

    if (protocol === 'anthropic-messages') {
      config = await callAnthropicApi(baseUrl, apiKey, model, userMessage, vendorConfig?.headers);
    } else {
      config = await callOpenAiApi(baseUrl, apiKey, model, userMessage, protocol, vendorConfig?.headers);
    }

    sendJson(res, 200, { success: true, config });
  } catch (err) {
    logger.error('[agent-generate] Failed to generate agent config:', err);
    sendJson(res, 500, {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return true;
}

async function callOpenAiApi(
  baseUrl: string,
  apiKey: string | null,
  model: string | undefined,
  userMessage: string,
  protocol: string,
  extraHeaders?: Record<string, string>,
): Promise<GeneratedAgentConfig> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const endpoint = protocol === 'openai-responses'
    ? `${baseUrl}/responses`
    : `${baseUrl}/chat/completions`;

  let response: Response;

  if (protocol === 'openai-responses') {
    response = await proxyAwareFetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'gpt-4o',
        instructions: SYSTEM_PROMPT,
        input: userMessage,
        text: { format: { type: 'json_object' } },
      }),
    });
  } else {
    response = await proxyAwareFetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Provider API error (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();
  let content: string;

  if (protocol === 'openai-responses') {
    // Responses API format
    content = data?.output?.[0]?.content?.[0]?.text
      || data?.output_text
      || JSON.stringify(data);
  } else {
    // Chat Completions format
    content = data?.choices?.[0]?.message?.content || '';
  }

  return parseGeneratedConfig(content);
}

async function callAnthropicApi(
  baseUrl: string,
  apiKey: string | null,
  model: string | undefined,
  userMessage: string,
  extraHeaders?: Record<string, string>,
): Promise<GeneratedAgentConfig> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    ...extraHeaders,
  };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const response = await proxyAwareFetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Anthropic API error (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();
  const content = data?.content?.[0]?.text || '';

  return parseGeneratedConfig(content);
}

function parseGeneratedConfig(raw: string): GeneratedAgentConfig {
  // Strip markdown code blocks if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse AI response as JSON. The model did not return valid JSON.');
  }

  // Validate required fields
  if (!parsed.id || typeof parsed.id !== 'string') {
    parsed.id = 'ai-agent';
  }
  if (!parsed.name || typeof parsed.name !== 'string') {
    parsed.name = parsed.id as string;
  }
  if (!parsed.soulMd || typeof parsed.soulMd !== 'string') {
    parsed.soulMd = '';
  }

  return {
    id: String(parsed.id).replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase().slice(0, 20),
    name: String(parsed.name).slice(0, 30),
    description: String(parsed.description || '').slice(0, 100),
    emoji: String(parsed.emoji || '🤖').slice(0, 2),
    model: parsed.model ? String(parsed.model) : undefined,
    toolProfile: parsed.toolProfile ? String(parsed.toolProfile) : undefined,
    soulMd: String(parsed.soulMd),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 5) : [],
    requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills.map(String) : [],
  };
}
