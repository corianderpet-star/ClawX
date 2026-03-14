/**
 * Automation State Store
 * Manages OpenClaw automation configuration state.
 * Shared between Settings (AutomationSettings) and Sidebar for
 * conditional navigation item visibility.
 */
import { create } from 'zustand';
import { invokeIpc } from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────

export interface HooksConfig {
  enabled?: boolean;
  token?: string;
  path?: string;
  maxBodyBytes?: number;
  internal?: {
    enabled?: boolean;
    entries?: Record<string, { enabled: boolean }>;
  };
  [key: string]: unknown;
}

export interface CronConfig {
  enabled?: boolean;
  maxConcurrentRuns?: number;
  [key: string]: unknown;
}

export interface PluginsConfig {
  enabled?: boolean;
  [key: string]: unknown;
}

export interface CommandsConfig {
  restart?: boolean;
  [key: string]: unknown;
}

export interface ApprovalsConfig {
  enabled?: boolean;
  [key: string]: unknown;
}

export type ConfigReloadMode = 'off' | 'restart' | 'hot' | 'hybrid';

export interface AutomationConfig {
  hooks?: HooksConfig;
  cron?: CronConfig;
  plugins?: PluginsConfig;
  commands?: CommandsConfig;
  approvals?: ApprovalsConfig;
  configReloadMode?: ConfigReloadMode;
}

// ── Version constants ────────────────────────────────────────────

export const FEATURE_MIN_VERSIONS: Record<string, string> = {
  hooks: '2026.3.11',
  cron: '2026.3.11',
  plugins: '2026.3.11',
  commands: '2026.3.8',
  approvals: '2026.3.12',
  configReloadMode: '2026.3.11',
};

// ── Version helpers ──────────────────────────────────────────────

function parseVersion(version: string): number[] {
  return version.split('.').map((part) => parseInt(part, 10) || 0);
}

function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// ── Store ────────────────────────────────────────────────────────

interface AutomationState {
  /** Current automation config read from openclaw.json */
  config: AutomationConfig;
  /** Detected OpenClaw runtime version */
  openClawVersion: string | undefined;
  /** Whether the store has completed its first load */
  loaded: boolean;
  /** Whether a save operation is in progress */
  saving: boolean;

  /** Load automation config and version (idempotent) */
  init: () => Promise<void>;
  /** Force reload from backend */
  refresh: () => Promise<void>;
  /** Update config locally (from AutomationSettings save callback) */
  setConfig: (config: AutomationConfig) => void;
  /** Set saving state */
  setSaving: (v: boolean) => void;

  /**
   * Whether a feature's minimum version requirement is met.
   */
  isFeatureAvailable: (feature: string) => boolean;

  /**
   * Whether a feature is enabled in config.
   */
  isFeatureEnabled: (feature: string) => boolean;

  /**
   * Whether a feature should be visible in sidebar
   * (version available AND enabled in config).
   */
  isFeatureVisible: (feature: string) => boolean;
}

export const useAutomationStore = create<AutomationState>()((set, get) => ({
  config: {},
  openClawVersion: undefined,
  loaded: false,
  saving: false,

  init: async () => {
    if (get().loaded) return;
    await get().refresh();
  },

  refresh: async () => {
    try {
      const [statusResult, configResult] = await Promise.all([
        invokeIpc<{ version?: string }>('openclaw:status'),
        invokeIpc<{ success: boolean; config?: AutomationConfig }>('automation:getConfig'),
      ]);

      set({
        openClawVersion: statusResult?.version,
        config: configResult?.success && configResult.config ? configResult.config : {},
        loaded: true,
      });
    } catch (error) {
      console.error('[automation-store] Failed to load:', error);
      set({ loaded: true });
    }
  },

  setConfig: (config) => set({ config }),
  setSaving: (saving) => set({ saving }),

  isFeatureAvailable: (feature) => {
    const { openClawVersion } = get();
    if (!openClawVersion) return false;
    const minVersion = FEATURE_MIN_VERSIONS[feature];
    if (!minVersion) return true;
    return compareVersions(openClawVersion, minVersion) >= 0;
  },

  isFeatureEnabled: (feature) => {
    const { config } = get();
    switch (feature) {
      case 'hooks':
        return config.hooks?.enabled ?? false;
      case 'cron':
        return config.cron?.enabled ?? false;
      case 'plugins':
        return config.plugins?.enabled ?? false;
      case 'commands':
        return true; // Commands is always "enabled"
      case 'approvals':
        return config.approvals?.enabled ?? false;
      default:
        return false;
    }
  },

  isFeatureVisible: (feature) => {
    const state = get();
    return state.isFeatureAvailable(feature) && state.isFeatureEnabled(feature);
  },
}));
