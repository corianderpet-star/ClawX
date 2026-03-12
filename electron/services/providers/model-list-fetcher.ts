/**
 * Model List Fetcher
 *
 * Fetches available model lists from provider APIs.
 * Each provider has its own endpoint format:
 *   - OpenAI-compatible: GET /models
 *   - Google: GET /models (query key)
 *   - Anthropic: GET /models (x-api-key header)
 *   - Ollama: GET /api/tags (local, no auth)
 */

import { proxyAwareFetch } from '../../utils/proxy-fetch';
import { logger } from '../../utils/logger';

export interface FetchedModel {
  id: string;
  name: string;
  owned_by?: string;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

// ─── OpenAI-compatible ───────────────────────────────────────────────────────

async function fetchOpenAiCompatibleModels(
  baseUrl: string,
  apiKey: string,
  extraHeaders?: Record<string, string>,
): Promise<FetchedModel[]> {
  const url = `${normalizeBaseUrl(baseUrl)}/models`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    ...extraHeaders,
  };
  const res = await proxyAwareFetch(url, { headers });
  if (!res.ok) {
    throw new Error(`OpenAI-compatible /models returned ${res.status}`);
  }
  const body = (await res.json()) as { data?: Array<{ id: string; owned_by?: string }> };
  return (body.data ?? []).map((m) => ({
    id: m.id,
    name: m.id,
    owned_by: m.owned_by,
  }));
}

// ─── Google Gemini ───────────────────────────────────────────────────────────

async function fetchGoogleModels(apiKey: string, baseUrl?: string): Promise<FetchedModel[]> {
  const base = normalizeBaseUrl(baseUrl || 'https://generativelanguage.googleapis.com/v1beta');
  const url = `${base}/models?pageSize=100&key=${encodeURIComponent(apiKey)}`;
  const res = await proxyAwareFetch(url, {});
  if (!res.ok) {
    throw new Error(`Google /models returned ${res.status}`);
  }
  const body = (await res.json()) as {
    models?: Array<{ name: string; displayName?: string }>;
  };
  return (body.models ?? []).map((m) => {
    // name comes as "models/gemini-2.0-flash" – extract the model id
    const id = m.name.startsWith('models/') ? m.name.slice('models/'.length) : m.name;
    return { id, name: m.displayName || id };
  });
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

async function fetchAnthropicModels(apiKey: string, baseUrl?: string): Promise<FetchedModel[]> {
  const base = normalizeBaseUrl(baseUrl || 'https://api.anthropic.com/v1');
  const url = `${base}/models?limit=100`;
  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  const res = await proxyAwareFetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Anthropic /models returned ${res.status}`);
  }
  const body = (await res.json()) as {
    data?: Array<{ id: string; display_name?: string }>;
  };
  return (body.data ?? []).map((m) => ({
    id: m.id,
    name: m.display_name || m.id,
  }));
}

// ─── Ollama (local, no auth) ─────────────────────────────────────────────────

async function fetchOllamaModels(baseUrl?: string): Promise<FetchedModel[]> {
  // Ollama uses /v1 suffix in the stored baseUrl but the tags API is at /api/tags
  const raw = normalizeBaseUrl(baseUrl || 'http://localhost:11434/v1');
  const ollamaBase = raw.replace(/\/v1$/, '');
  const url = `${ollamaBase}/api/tags`;
  const res = await proxyAwareFetch(url, {});
  if (!res.ok) {
    throw new Error(`Ollama /api/tags returned ${res.status}`);
  }
  const body = (await res.json()) as {
    models?: Array<{ name: string; model?: string }>;
  };
  return (body.models ?? []).map((m) => ({
    id: m.name,
    name: m.name,
  }));
}

// ─── Public entry point ──────────────────────────────────────────────────────

export async function fetchProviderModels(
  providerType: string,
  apiKey: string | undefined,
  baseUrl?: string,
): Promise<FetchedModel[]> {
  try {
    switch (providerType) {
      case 'openai':
        if (!apiKey) return [];
        return await fetchOpenAiCompatibleModels(
          baseUrl || 'https://api.openai.com/v1',
          apiKey,
        );

      case 'anthropic':
        if (!apiKey) return [];
        return await fetchAnthropicModels(apiKey, baseUrl);

      case 'google':
        if (!apiKey) return [];
        return await fetchGoogleModels(apiKey, baseUrl);

      case 'openrouter':
        if (!apiKey) return [];
        return await fetchOpenAiCompatibleModels(
          baseUrl || 'https://openrouter.ai/api/v1',
          apiKey,
          {
            'HTTP-Referer': 'https://claw-x.com',
            'X-Title': 'ClawPlus',
          },
        );

      case 'ollama':
        return await fetchOllamaModels(baseUrl);

      case 'moonshot':
        if (!apiKey) return [];
        return await fetchOpenAiCompatibleModels(
          baseUrl || 'https://api.moonshot.cn/v1',
          apiKey,
        );

      case 'siliconflow':
        if (!apiKey) return [];
        return await fetchOpenAiCompatibleModels(
          baseUrl || 'https://api.siliconflow.cn/v1',
          apiKey,
        );

      case 'ark':
        if (!apiKey) return [];
        return await fetchOpenAiCompatibleModels(
          baseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
          apiKey,
        );

      case 'qwen-portal':
        if (!apiKey) return [];
        return await fetchOpenAiCompatibleModels(
          baseUrl || 'https://portal.qwen.ai/v1',
          apiKey,
        );

      case 'minimax-portal':
      case 'minimax-portal-cn': {
        // MiniMax uses anthropic-messages API, /models may not be available.
        // Return empty and let user type manually.
        return [];
      }

      case 'custom':
        if (!apiKey || !baseUrl) return [];
        return await fetchOpenAiCompatibleModels(baseUrl, apiKey);

      default:
        return [];
    }
  } catch (error) {
    logger.warn(
      `[model-list-fetcher] Failed to fetch models for ${providerType}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}
