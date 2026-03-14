/**
 * OpenClaw Automation Configuration Utilities
 * Manages automation features (Hooks, Cron, Plugins, Commands, Approvals)
 * in the OpenClaw config file (~/.openclaw/openclaw.json).
 *
 * Compatible with OpenClaw v2026.3.11+ and v2026.3.12+.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from './logger';

const OPENCLAW_DIR = join(homedir(), '.openclaw');
const CONFIG_FILE = join(OPENCLAW_DIR, 'openclaw.json');

// ── Types ────────────────────────────────────────────────────────

/** Hook internal entry config */
export interface HookEntry {
  enabled: boolean;
  env?: Record<string, string>;
}

/** Webhook mapping config */
export interface WebhookMapping {
  match: { path?: string; method?: string; [key: string]: unknown };
  action: 'wake' | 'agent';
  agentId?: string;
  wakeMode?: 'now' | 'queue';
  name?: string;
  sessionKey?: string;
  messageTemplate?: string;
  deliver?: boolean;
  channel?: string;
  model?: string;
}

/** Hooks configuration */
export interface HooksConfig {
  enabled?: boolean;
  token?: string;
  path?: string;
  maxBodyBytes?: number;
  defaultSessionKey?: string;
  allowRequestSessionKey?: boolean;
  allowedSessionKeyPrefixes?: string[];
  allowedAgentIds?: string[];
  presets?: string[];
  mappings?: WebhookMapping[];
  internal?: {
    enabled?: boolean;
    entries?: Record<string, HookEntry>;
    load?: { extraDirs?: string[] };
  };
  [key: string]: unknown;
}

/** Cron configuration */
export interface CronConfig {
  enabled?: boolean;
  store?: string;
  maxConcurrentRuns?: number;
  retry?: {
    maxAttempts?: number;
    backoffMs?: number[];
  };
  sessionRetention?: string;
  runLog?: {
    maxBytes?: string;
    keepLines?: number;
  };
  [key: string]: unknown;
}

/** Plugin entry config */
export interface PluginEntry {
  enabled: boolean;
  config?: Record<string, unknown>;
}

/** Plugins configuration */
export interface PluginsConfig {
  enabled?: boolean;
  allow?: string[];
  deny?: string[];
  load?: { paths?: string[] };
  entries?: Record<string, PluginEntry>;
  slots?: Record<string, string>;
  [key: string]: unknown;
}

/** Commands configuration */
export interface CommandsConfig {
  restart?: boolean;
  [key: string]: unknown;
}

/** Approvals (Lobster) configuration */
export interface ApprovalsConfig {
  enabled?: boolean;
  lobster?: boolean;
  [key: string]: unknown;
}

/** Config reload mode */
export type ConfigReloadMode = 'off' | 'restart' | 'hot' | 'hybrid';

/** Full automation configuration */
export interface AutomationConfig {
  hooks?: HooksConfig;
  cron?: CronConfig;
  plugins?: PluginsConfig;
  commands?: CommandsConfig;
  approvals?: ApprovalsConfig;
  configReloadMode?: ConfigReloadMode;
}

/** Minimum OpenClaw version for each feature */
export const FEATURE_MIN_VERSIONS: Record<string, string> = {
  hooks: '2026.3.11',
  cron: '2026.3.11',
  plugins: '2026.3.11',
  commands: '2026.3.8',
  approvals: '2026.3.12',
  configReloadMode: '2026.3.11',
};

// ── Helpers ──────────────────────────────────────────────────────

interface OpenClawConfig {
  [key: string]: unknown;
}

async function readConfig(): Promise<OpenClawConfig> {
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const content = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as OpenClawConfig;
  } catch (error) {
    logger.error('Failed to read OpenClaw config for automation', error);
    return {};
  }
}

async function writeConfig(config: OpenClawConfig): Promise<void> {
  if (!existsSync(OPENCLAW_DIR)) {
    await mkdir(OPENCLAW_DIR, { recursive: true });
  }
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Read the full automation configuration from openclaw.json.
 */
export async function readAutomationConfig(): Promise<AutomationConfig> {
  const config = await readConfig();
  return {
    hooks: (config.hooks as HooksConfig) ?? undefined,
    cron: (config.cron as CronConfig) ?? undefined,
    plugins: (config.plugins as PluginsConfig) ?? undefined,
    commands: (config.commands as CommandsConfig) ?? undefined,
    approvals: (config.approvals as ApprovalsConfig) ?? undefined,
    configReloadMode: (config.configReloadMode as ConfigReloadMode) ?? undefined,
  };
}

/**
 * Update automation configuration fields.
 * Only the provided top-level keys are merged; omitted keys are untouched.
 */
export async function updateAutomationConfig(
  updates: Partial<AutomationConfig>,
): Promise<AutomationConfig> {
  const config = await readConfig();

  if (updates.hooks !== undefined) {
    config.hooks = updates.hooks === null ? undefined : mergeDeep(config.hooks ?? {}, updates.hooks);
  }
  if (updates.cron !== undefined) {
    config.cron = updates.cron === null ? undefined : mergeDeep(config.cron ?? {}, updates.cron);
  }
  if (updates.plugins !== undefined) {
    config.plugins = updates.plugins === null ? undefined : mergeDeep(config.plugins ?? {}, updates.plugins);
  }
  if (updates.commands !== undefined) {
    config.commands = updates.commands === null ? undefined : mergeDeep(config.commands ?? {}, updates.commands);
  }
  if (updates.approvals !== undefined) {
    config.approvals = updates.approvals === null ? undefined : mergeDeep(config.approvals ?? {}, updates.approvals);
  }
  if (updates.configReloadMode !== undefined) {
    config.configReloadMode = updates.configReloadMode;
  }

  await writeConfig(config);
  logger.info('Automation config updated', { fields: Object.keys(updates) });

  return {
    hooks: (config.hooks as HooksConfig) ?? undefined,
    cron: (config.cron as CronConfig) ?? undefined,
    plugins: (config.plugins as PluginsConfig) ?? undefined,
    commands: (config.commands as CommandsConfig) ?? undefined,
    approvals: (config.approvals as ApprovalsConfig) ?? undefined,
    configReloadMode: (config.configReloadMode as ConfigReloadMode) ?? undefined,
  };
}

/**
 * Read the configReloadMode setting.
 */
export async function readConfigReloadMode(): Promise<ConfigReloadMode> {
  const config = await readConfig();
  return (config.configReloadMode as ConfigReloadMode) ?? 'off';
}

/**
 * Set the configReloadMode setting.
 */
export async function setConfigReloadMode(mode: ConfigReloadMode): Promise<void> {
  const config = await readConfig();
  config.configReloadMode = mode;
  await writeConfig(config);
  logger.info('Config reload mode set', { mode });
}

// ── Deep Merge Helper ────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];
    if (isPlainObject(sourceVal) && isPlainObject(targetVal)) {
      result[key] = mergeDeep(targetVal, sourceVal);
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}
