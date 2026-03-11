import type { GatewayManager } from '../../gateway/manager';
import { getProviderAccount, listProviderAccounts } from './provider-store';
import { getProviderSecret } from '../secrets/secret-store';
import type { ProviderConfig } from '../../utils/secure-storage';
import { getAllProviders, getApiKey, getDefaultProvider, getProvider } from '../../utils/secure-storage';
import { getProviderConfig, getProviderDefaultModel } from '../../utils/provider-registry';
import {
  removeProviderFromOpenClaw,
  saveOAuthTokenToOpenClaw,
  saveProviderKeyToOpenClaw,
  setOpenClawDefaultModel,
  setOpenClawDefaultModelWithOverride,
  syncProviderConfigToOpenClaw,
  updateAgentModelProvider,
} from '../../utils/openclaw-auth';
import { logger } from '../../utils/logger';

const GOOGLE_OAUTH_RUNTIME_PROVIDER = 'google-gemini-cli';
const GOOGLE_OAUTH_DEFAULT_MODEL_REF = `${GOOGLE_OAUTH_RUNTIME_PROVIDER}/gemini-3-pro-preview`;
const OPENAI_CODEX_RUNTIME_PROVIDER = 'openai-codex';
const OPENAI_CODEX_DEFAULT_MODEL_REF = `${OPENAI_CODEX_RUNTIME_PROVIDER}/gpt-5.2-codex`;

type RuntimeProviderSyncContext = {
  runtimeProviderKey: string;
  meta: ReturnType<typeof getProviderConfig>;
  api: string;
};

export function getOpenClawProviderKey(type: string, providerId: string): string {
  if (type === 'custom' || type === 'ollama') {
    const suffix = providerId.replace(/-/g, '').slice(0, 8);
    return `${type}-${suffix}`;
  }
  if (type === 'minimax-portal-cn') {
    return 'minimax-portal';
  }
  return type;
}

async function resolveRuntimeProviderKey(config: ProviderConfig): Promise<string> {
  const account = await getProviderAccount(config.id);
  if (config.type === 'google' && account?.authMode === 'oauth_browser') {
    return GOOGLE_OAUTH_RUNTIME_PROVIDER;
  }
  if (config.type === 'openai' && account?.authMode === 'oauth_browser') {
    return OPENAI_CODEX_RUNTIME_PROVIDER;
  }
  return getOpenClawProviderKey(config.type, config.id);
}

async function isGoogleBrowserOAuthProvider(config: ProviderConfig): Promise<boolean> {
  const account = await getProviderAccount(config.id);
  if (config.type !== 'google' || account?.authMode !== 'oauth_browser') {
    return false;
  }

  const secret = await getProviderSecret(config.id);
  return secret?.type === 'oauth';
}

async function isOpenAICodexOAuthProvider(config: ProviderConfig): Promise<boolean> {
  const account = await getProviderAccount(config.id);
  if (config.type !== 'openai' || account?.authMode !== 'oauth_browser') {
    return false;
  }

  const secret = await getProviderSecret(config.id);
  return secret?.type === 'oauth';
}

export function getProviderModelRef(config: ProviderConfig): string | undefined {
  const providerKey = getOpenClawProviderKey(config.type, config.id);

  if (config.model) {
    return config.model.startsWith(`${providerKey}/`)
      ? config.model
      : `${providerKey}/${config.model}`;
  }

  const defaultModel = getProviderDefaultModel(config.type);
  if (!defaultModel) {
    return undefined;
  }

  return defaultModel.startsWith(`${providerKey}/`)
    ? defaultModel
    : `${providerKey}/${defaultModel}`;
}

export async function getProviderFallbackModelRefs(config: ProviderConfig): Promise<string[]> {
  const allProviders = await getAllProviders();
  const providerMap = new Map(allProviders.map((provider) => [provider.id, provider]));
  const seen = new Set<string>();
  const results: string[] = [];
  const providerKey = getOpenClawProviderKey(config.type, config.id);

  for (const fallbackModel of config.fallbackModels ?? []) {
    const normalizedModel = fallbackModel.trim();
    if (!normalizedModel) continue;

    const modelRef = normalizedModel.startsWith(`${providerKey}/`)
      ? normalizedModel
      : `${providerKey}/${normalizedModel}`;

    if (seen.has(modelRef)) continue;
    seen.add(modelRef);
    results.push(modelRef);
  }

  for (const fallbackId of config.fallbackProviderIds ?? []) {
    if (!fallbackId || fallbackId === config.id) continue;

    const fallbackProvider = providerMap.get(fallbackId);
    if (!fallbackProvider) continue;

    const modelRef = getProviderModelRef(fallbackProvider);
    if (!modelRef || seen.has(modelRef)) continue;

    seen.add(modelRef);
    results.push(modelRef);
  }

  return results;
}

function scheduleGatewayRestart(
  gatewayManager: GatewayManager | undefined,
  message: string,
  options?: { delayMs?: number; onlyIfRunning?: boolean },
): void {
  if (!gatewayManager) {
    return;
  }

  if (options?.onlyIfRunning && gatewayManager.getStatus().state === 'stopped') {
    return;
  }

  logger.info(message);
  gatewayManager.debouncedRestart(options?.delayMs);
}

/**
 * Lightweight config reload via SIGUSR1 (falls back to restart on Windows
 * or when the Gateway isn't running).  Use this for changes that only touch
 * auth-profiles.json or agents.defaults — the Gateway can pick these up
 * without a full process restart.
 */
function scheduleGatewayReload(
  gatewayManager: GatewayManager | undefined,
  message: string,
): void {
  if (!gatewayManager) {
    return;
  }
  if (gatewayManager.getStatus().state !== 'running') {
    return;
  }
  logger.info(message);
  void gatewayManager.reload().catch((err) => {
    logger.warn('Gateway config reload failed, will pick up changes on next restart:', err);
  });
}

export async function syncProviderApiKeyToRuntime(
  providerType: string,
  providerId: string,
  apiKey: string,
): Promise<void> {
  const ock = getOpenClawProviderKey(providerType, providerId);
  await saveProviderKeyToOpenClaw(ock, apiKey);
}

export async function syncAllProviderAuthToRuntime(): Promise<void> {
  const accounts = await listProviderAccounts();

  for (const account of accounts) {
    const runtimeProviderKey = await resolveRuntimeProviderKey({
      id: account.id,
      name: account.label,
      type: account.vendorId,
      baseUrl: account.baseUrl,
      model: account.model,
      fallbackModels: account.fallbackModels,
      fallbackProviderIds: account.fallbackAccountIds,
      enabled: account.enabled,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    });

    const secret = await getProviderSecret(account.id);
    if (!secret) {
      continue;
    }

    if (secret.type === 'api_key') {
      await saveProviderKeyToOpenClaw(runtimeProviderKey, secret.apiKey);
      continue;
    }

    if (secret.type === 'local' && secret.apiKey) {
      await saveProviderKeyToOpenClaw(runtimeProviderKey, secret.apiKey);
      continue;
    }

    if (secret.type === 'oauth') {
      await saveOAuthTokenToOpenClaw(runtimeProviderKey, {
        access: secret.accessToken,
        refresh: secret.refreshToken,
        expires: secret.expiresAt,
        email: secret.email,
        projectId: secret.subject,
      });
    }
  }
}

async function syncProviderSecretToRuntime(
  config: ProviderConfig,
  runtimeProviderKey: string,
  apiKey: string | undefined,
): Promise<void> {
  const secret = await getProviderSecret(config.id);
  if (apiKey !== undefined) {
    const trimmedKey = apiKey.trim();
    if (trimmedKey) {
      await saveProviderKeyToOpenClaw(runtimeProviderKey, trimmedKey);
    }
    return;
  }

  if (secret?.type === 'api_key') {
    await saveProviderKeyToOpenClaw(runtimeProviderKey, secret.apiKey);
    return;
  }

  if (secret?.type === 'oauth') {
    await saveOAuthTokenToOpenClaw(runtimeProviderKey, {
      access: secret.accessToken,
      refresh: secret.refreshToken,
      expires: secret.expiresAt,
      email: secret.email,
      projectId: secret.subject,
    });
    return;
  }

  if (secret?.type === 'local' && secret.apiKey) {
    await saveProviderKeyToOpenClaw(runtimeProviderKey, secret.apiKey);
  }
}

async function resolveRuntimeSyncContext(config: ProviderConfig): Promise<RuntimeProviderSyncContext | null> {
  const runtimeProviderKey = await resolveRuntimeProviderKey(config);

  // Implicit OAuth providers (openai-codex, google-gemini-cli) are managed
  // entirely through auth-profiles.json; they don't need explicit provider
  // config in openclaw.json.  Returning null skips the config sync.
  if (runtimeProviderKey === OPENAI_CODEX_RUNTIME_PROVIDER) {
    return null;
  }

  const meta = getProviderConfig(config.type);
  const api = config.type === 'custom' || config.type === 'ollama' ? 'openai-completions' : meta?.api;
  if (!api) {
    return null;
  }

  return {
    runtimeProviderKey,
    meta,
    api,
  };
}

async function syncRuntimeProviderConfig(
  config: ProviderConfig,
  context: RuntimeProviderSyncContext,
): Promise<void> {
  await syncProviderConfigToOpenClaw(context.runtimeProviderKey, config.model, {
    baseUrl: config.baseUrl || context.meta?.baseUrl,
    api: context.api,
    apiKeyEnv: context.meta?.apiKeyEnv,
    headers: context.meta?.headers,
  });
}

async function syncCustomProviderAgentModel(
  config: ProviderConfig,
  runtimeProviderKey: string,
  apiKey: string | undefined,
): Promise<void> {
  if (config.type !== 'custom' && config.type !== 'ollama') {
    return;
  }

  const resolvedKey = apiKey !== undefined ? (apiKey.trim() || null) : await getApiKey(config.id);
  if (!resolvedKey || !config.baseUrl) {
    return;
  }

  const modelId = config.model;
  await updateAgentModelProvider(runtimeProviderKey, {
    baseUrl: config.baseUrl,
    api: 'openai-completions',
    models: modelId ? [{ id: modelId, name: modelId }] : [],
    apiKey: resolvedKey,
  });
}

async function syncProviderToRuntime(
  config: ProviderConfig,
  apiKey: string | undefined,
): Promise<RuntimeProviderSyncContext | null> {
  const context = await resolveRuntimeSyncContext(config);

  // Always sync the secret (auth-profiles.json) — this is a hot update that
  // the Gateway reads dynamically without requiring a process restart.
  const runtimeProviderKey = context?.runtimeProviderKey ?? await resolveRuntimeProviderKey(config);
  await syncProviderSecretToRuntime(config, runtimeProviderKey, apiKey);

  // Implicit OAuth providers (openai-codex, google-gemini-cli) don't need
  // explicit provider config in openclaw.json; skip the config sync.
  if (!context) {
    return null;
  }

  await syncRuntimeProviderConfig(config, context);
  await syncCustomProviderAgentModel(config, context.runtimeProviderKey, apiKey);
  return context;
}

export async function syncSavedProviderToRuntime(
  config: ProviderConfig,
  apiKey: string | undefined,
  gatewayManager?: GatewayManager,
): Promise<void> {
  const context = await syncProviderToRuntime(config, apiKey);
  if (!context) {
    return;
  }

  scheduleGatewayRestart(
    gatewayManager,
    `Scheduling Gateway restart after saving provider "${context.runtimeProviderKey}" config`,
  );
}

export async function syncUpdatedProviderToRuntime(
  config: ProviderConfig,
  apiKey: string | undefined,
  gatewayManager?: GatewayManager,
): Promise<void> {
  const context = await syncProviderToRuntime(config, apiKey);

  // Determine the runtime provider key — works even without full context.
  const ock = context?.runtimeProviderKey ?? await resolveRuntimeProviderKey(config);
  const fallbackModels = await getProviderFallbackModelRefs(config);

  const defaultProviderId = await getDefaultProvider();
  if (defaultProviderId === config.id) {
    const modelOverride = config.model ? `${ock}/${config.model}` : undefined;
    if (config.type !== 'custom' && config.type !== 'ollama') {
      await setOpenClawDefaultModel(ock, modelOverride, fallbackModels);
    } else {
      await setOpenClawDefaultModelWithOverride(ock, modelOverride, {
        baseUrl: config.baseUrl,
        api: 'openai-completions',
      }, fallbackModels);
    }
  }

  if (!context) {
    // Implicit OAuth provider — only auth-profiles and agent defaults changed.
    // These are hot-reloadable; a lightweight reload signal is sufficient.
    scheduleGatewayReload(
      gatewayManager,
      `Reloading Gateway config after updating implicit OAuth provider "${ock}"`,
    );
    return;
  }

  // Infrastructure-level config (models.providers) changed → full restart.
  scheduleGatewayRestart(
    gatewayManager,
    `Scheduling Gateway restart after updating provider "${ock}" config`,
  );
}

export async function syncDeletedProviderToRuntime(
  provider: ProviderConfig | null,
  providerId: string,
  gatewayManager?: GatewayManager,
  runtimeProviderKey?: string,
): Promise<void> {
  if (!provider?.type) {
    return;
  }

  const ock = runtimeProviderKey ?? await resolveRuntimeProviderKey({ ...provider, id: providerId });
  await removeProviderFromOpenClaw(ock);

  scheduleGatewayRestart(
    gatewayManager,
    `Scheduling Gateway restart after deleting provider "${ock}"`,
  );
}

export async function syncDeletedProviderApiKeyToRuntime(
  provider: ProviderConfig | null,
  providerId: string,
  runtimeProviderKey?: string,
): Promise<void> {
  if (!provider?.type) {
    return;
  }

  const ock = runtimeProviderKey ?? await resolveRuntimeProviderKey({ ...provider, id: providerId });
  await removeProviderFromOpenClaw(ock);
}

export async function syncDefaultProviderToRuntime(
  providerId: string,
  gatewayManager?: GatewayManager,
): Promise<void> {
  const provider = await getProvider(providerId);
  if (!provider) {
    return;
  }

  const ock = await resolveRuntimeProviderKey(provider);
  const providerKey = await getApiKey(providerId);
  const fallbackModels = await getProviderFallbackModelRefs(provider);
  const oauthTypes = ['qwen-portal', 'minimax-portal', 'minimax-portal-cn'];
  const isGoogleOAuthProvider = await isGoogleBrowserOAuthProvider(provider);
  const isCodexOAuthProvider = await isOpenAICodexOAuthProvider(provider);
  const isOAuthProvider = (oauthTypes.includes(provider.type) && !providerKey) || isGoogleOAuthProvider || isCodexOAuthProvider;

  if (!isOAuthProvider) {
    const modelOverride = provider.model
      ? (provider.model.startsWith(`${ock}/`) ? provider.model : `${ock}/${provider.model}`)
      : undefined;

    if (provider.type === 'custom' || provider.type === 'ollama') {
      await setOpenClawDefaultModelWithOverride(ock, modelOverride, {
        baseUrl: provider.baseUrl,
        api: 'openai-completions',
      }, fallbackModels);
    } else {
      await setOpenClawDefaultModel(ock, modelOverride, fallbackModels);
    }

    if (providerKey) {
      await saveProviderKeyToOpenClaw(ock, providerKey);
    }
  } else {
    if (isGoogleOAuthProvider) {
      const secret = await getProviderSecret(provider.id);
      if (secret?.type === 'oauth') {
        await saveOAuthTokenToOpenClaw(GOOGLE_OAUTH_RUNTIME_PROVIDER, {
          access: secret.accessToken,
          refresh: secret.refreshToken,
          expires: secret.expiresAt,
          email: secret.email,
          projectId: secret.subject,
        });
      }

      const modelOverride = provider.model
        ? (provider.model.startsWith(`${GOOGLE_OAUTH_RUNTIME_PROVIDER}/`)
          ? provider.model
          : `${GOOGLE_OAUTH_RUNTIME_PROVIDER}/${provider.model}`)
        : GOOGLE_OAUTH_DEFAULT_MODEL_REF;

      await setOpenClawDefaultModel(GOOGLE_OAUTH_RUNTIME_PROVIDER, modelOverride, fallbackModels);
      logger.info(`Configured openclaw.json for Google browser OAuth provider "${provider.id}"`);
      scheduleGatewayReload(
        gatewayManager,
        `Reloading Gateway config after Google OAuth provider switch to "${GOOGLE_OAUTH_RUNTIME_PROVIDER}"`,
      );
      return;
    }

    if (isCodexOAuthProvider) {
      const secret = await getProviderSecret(provider.id);
      if (secret?.type === 'oauth') {
        await saveOAuthTokenToOpenClaw(OPENAI_CODEX_RUNTIME_PROVIDER, {
          access: secret.accessToken,
          refresh: secret.refreshToken,
          expires: secret.expiresAt,
          email: secret.email,
          projectId: secret.subject,
        });
      }

      const modelOverride = provider.model
        ? (provider.model.startsWith(`${OPENAI_CODEX_RUNTIME_PROVIDER}/`)
          ? provider.model
          : `${OPENAI_CODEX_RUNTIME_PROVIDER}/${provider.model}`)
        : OPENAI_CODEX_DEFAULT_MODEL_REF;

      await setOpenClawDefaultModel(OPENAI_CODEX_RUNTIME_PROVIDER, modelOverride, fallbackModels);
      logger.info(`Configured openclaw.json for OpenAI Codex OAuth provider "${provider.id}"`);
      scheduleGatewayReload(
        gatewayManager,
        `Reloading Gateway config after Codex OAuth provider switch to "${OPENAI_CODEX_RUNTIME_PROVIDER}"`,
      );
      return;
    }

    const defaultBaseUrl = provider.type === 'minimax-portal'
      ? 'https://api.minimax.io/anthropic'
      : (provider.type === 'minimax-portal-cn' ? 'https://api.minimaxi.com/anthropic' : 'https://portal.qwen.ai/v1');
    const api: 'anthropic-messages' | 'openai-completions' =
      (provider.type === 'minimax-portal' || provider.type === 'minimax-portal-cn')
        ? 'anthropic-messages'
        : 'openai-completions';

    let baseUrl = provider.baseUrl || defaultBaseUrl;
    if ((provider.type === 'minimax-portal' || provider.type === 'minimax-portal-cn') && baseUrl) {
      baseUrl = baseUrl.replace(/\/v1$/, '').replace(/\/anthropic$/, '').replace(/\/$/, '') + '/anthropic';
    }

    const targetProviderKey = (provider.type === 'minimax-portal' || provider.type === 'minimax-portal-cn')
      ? 'minimax-portal'
      : provider.type;

    await setOpenClawDefaultModelWithOverride(targetProviderKey, getProviderModelRef(provider), {
      baseUrl,
      api,
      authHeader: targetProviderKey === 'minimax-portal' ? true : undefined,
      apiKeyEnv: targetProviderKey === 'minimax-portal' ? 'minimax-oauth' : 'qwen-oauth',
    }, fallbackModels);

    logger.info(`Configured openclaw.json for OAuth provider "${provider.type}"`);

    try {
      const defaultModelId = provider.model?.split('/').pop();
      await updateAgentModelProvider(targetProviderKey, {
        baseUrl,
        api,
        authHeader: targetProviderKey === 'minimax-portal' ? true : undefined,
        apiKey: targetProviderKey === 'minimax-portal' ? 'minimax-oauth' : 'qwen-oauth',
        models: defaultModelId ? [{ id: defaultModelId, name: defaultModelId }] : [],
      });
    } catch (err) {
      logger.warn(`Failed to update models.json for OAuth provider "${targetProviderKey}":`, err);
    }
  }

  if (
    (provider.type === 'custom' || provider.type === 'ollama') &&
    providerKey &&
    provider.baseUrl
  ) {
    const modelId = provider.model;
    await updateAgentModelProvider(ock, {
      baseUrl: provider.baseUrl,
      api: 'openai-completions',
      models: modelId ? [{ id: modelId, name: modelId }] : [],
      apiKey: providerKey,
    });
  }

  scheduleGatewayRestart(
    gatewayManager,
    `Scheduling Gateway restart after provider switch to "${ock}"`,
    { onlyIfRunning: true },
  );
}
