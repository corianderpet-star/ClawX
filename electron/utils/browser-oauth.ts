import { EventEmitter } from 'events';
import { BrowserWindow, shell } from 'electron';
import { logger } from './logger';
import { loginGeminiCliOAuth, type GeminiCliOAuthCredentials } from './gemini-cli-oauth';
import { loginCodexCliOAuth, type CodexCliOAuthCredentials } from './codex-cli-oauth';
import { getProviderService } from '../services/providers/provider-service';
import { getSecretStore } from '../services/secrets/secret-store';
import { saveOAuthTokenToOpenClaw } from './openclaw-auth';

export type BrowserOAuthProviderType = 'google' | 'openai';

const GOOGLE_RUNTIME_PROVIDER_ID = 'google-gemini-cli';
const GOOGLE_OAUTH_DEFAULT_MODEL = 'gemini-3-pro-preview';
const OPENAI_CODEX_RUNTIME_PROVIDER = 'openai-codex';
const OPENAI_OAUTH_DEFAULT_MODEL = 'gpt-5.2-codex';

class BrowserOAuthManager extends EventEmitter {
  private activeProvider: BrowserOAuthProviderType | null = null;
  private activeAccountId: string | null = null;
  private activeLabel: string | null = null;
  private active = false;
  private mainWindow: BrowserWindow | null = null;

  setWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  async startFlow(
    provider: BrowserOAuthProviderType,
    options?: { accountId?: string; label?: string },
  ): Promise<boolean> {
    if (this.active) {
      await this.stopFlow();
    }

    this.active = true;
    this.activeProvider = provider;
    this.activeAccountId = options?.accountId || provider;
    this.activeLabel = options?.label || null;
    this.emit('oauth:start', { provider, accountId: this.activeAccountId });

    try {
      if (provider === 'google') {
        const token = await loginGeminiCliOAuth({
          isRemote: false,
          openUrl: async (url) => {
            await shell.openExternal(url);
          },
          log: (message) => logger.info(`[BrowserOAuth] ${message}`),
          note: async (message, title) => {
            logger.info(`[BrowserOAuth] ${title || 'OAuth note'}: ${message}`);
          },
          prompt: async () => {
            throw new Error('Manual browser OAuth fallback is not implemented in ClawPlus yet.');
          },
          progress: {
            update: (message) => logger.info(`[BrowserOAuth] ${message}`),
            stop: (message) => {
              if (message) {
                logger.info(`[BrowserOAuth] ${message}`);
              }
            },
          },
        });

        await this.onGoogleSuccess(provider, token);
        return true;
      } else if (provider === 'openai') {
        const token = await loginCodexCliOAuth({
          openUrl: async (url) => {
            await shell.openExternal(url);
          },
          log: (message) => logger.info(`[BrowserOAuth] ${message}`),
          progress: {
            update: (message) => logger.info(`[BrowserOAuth] ${message}`),
            stop: (message) => {
              if (message) {
                logger.info(`[BrowserOAuth] ${message}`);
              }
            },
          },
        });

        await this.onOpenAISuccess(provider, token);
        return true;
      } else {
        throw new Error(`Unsupported browser OAuth provider type: ${provider}`);
      }
    } catch (error) {
      if (!this.active) {
        return false;
      }
      logger.error(`[BrowserOAuth] Flow error for ${provider}:`, error);
      this.emitError(error instanceof Error ? error.message : String(error));
      this.active = false;
      this.activeProvider = null;
      this.activeAccountId = null;
      this.activeLabel = null;
      return false;
    }
  }

  async stopFlow(): Promise<void> {
    this.active = false;
    this.activeProvider = null;
    this.activeAccountId = null;
    this.activeLabel = null;
    logger.info('[BrowserOAuth] Flow explicitly stopped');
  }

  private async onGoogleSuccess(
    providerType: BrowserOAuthProviderType,
    token: GeminiCliOAuthCredentials,
  ) {
    const accountId = this.activeAccountId || providerType;
    const accountLabel = this.activeLabel;
    this.active = false;
    this.activeProvider = null;
    this.activeAccountId = null;
    this.activeLabel = null;
    logger.info(`[BrowserOAuth] Successfully completed OAuth for ${providerType}`);

    const providerService = getProviderService();
    const existing = await providerService.getAccount(accountId);
    const nextAccount = await providerService.createAccount({
      id: accountId,
      vendorId: providerType,
      label: accountLabel || existing?.label || 'Google Gemini',
      authMode: 'oauth_browser',
      baseUrl: existing?.baseUrl,
      apiProtocol: existing?.apiProtocol,
      model: existing?.model || GOOGLE_OAUTH_DEFAULT_MODEL,
      fallbackModels: existing?.fallbackModels,
      fallbackAccountIds: existing?.fallbackAccountIds,
      enabled: existing?.enabled ?? true,
      isDefault: existing?.isDefault ?? false,
      metadata: {
        ...existing?.metadata,
        email: token.email,
        resourceUrl: GOOGLE_RUNTIME_PROVIDER_ID,
      },
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await getSecretStore().set({
      type: 'oauth',
      accountId,
      accessToken: token.access,
      refreshToken: token.refresh,
      expiresAt: token.expires,
      email: token.email,
      subject: token.projectId,
    });

    await saveOAuthTokenToOpenClaw(GOOGLE_RUNTIME_PROVIDER_ID, {
      access: token.access,
      refresh: token.refresh,
      expires: token.expires,
      email: token.email,
      projectId: token.projectId,
    });

    this.emit('oauth:success', { provider: providerType, accountId: nextAccount.id });
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('oauth:success', {
        provider: providerType,
        accountId: nextAccount.id,
        success: true,
      });
    }
  }

  private async onOpenAISuccess(
    providerType: BrowserOAuthProviderType,
    token: CodexCliOAuthCredentials,
  ) {
    const accountId = this.activeAccountId || providerType;
    const accountLabel = this.activeLabel;
    this.active = false;
    this.activeProvider = null;
    this.activeAccountId = null;
    this.activeLabel = null;
    logger.info(`[BrowserOAuth] Successfully completed Codex OAuth for ${providerType}`);

    const providerService = getProviderService();
    const existing = await providerService.getAccount(accountId);
    const nextAccount = await providerService.createAccount({
      id: accountId,
      vendorId: providerType,
      label: accountLabel || existing?.label || 'OpenAI (Codex)',
      authMode: 'oauth_browser',
      baseUrl: existing?.baseUrl,
      apiProtocol: existing?.apiProtocol,
      model: existing?.model || OPENAI_OAUTH_DEFAULT_MODEL,
      fallbackModels: existing?.fallbackModels,
      fallbackAccountIds: existing?.fallbackAccountIds,
      enabled: existing?.enabled ?? true,
      isDefault: existing?.isDefault ?? false,
      metadata: {
        ...existing?.metadata,
        email: token.email,
        resourceUrl: OPENAI_CODEX_RUNTIME_PROVIDER,
      },
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Store OAuth tokens as oauth secret (the OpenClaw runtime uses the
    // access_token JWT directly as a Bearer token — no API key exchange).
    await getSecretStore().set({
      type: 'oauth',
      accountId,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      email: token.email,
    });

    // Write the OAuth profile to auth-profiles.json so the OpenClaw
    // runtime activates the implicit `openai-codex` provider.
    await saveOAuthTokenToOpenClaw(OPENAI_CODEX_RUNTIME_PROVIDER, {
      access: token.accessToken,
      refresh: token.refreshToken,
      expires: token.expiresAt,
      email: token.email,
    });

    this.emit('oauth:success', { provider: providerType, accountId: nextAccount.id });
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('oauth:success', {
        provider: providerType,
        accountId: nextAccount.id,
        success: true,
      });
    }
  }

  private emitError(message: string) {
    this.emit('oauth:error', { message });
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('oauth:error', { message });
    }
  }
}

export const browserOAuthManager = new BrowserOAuthManager();
