/**
 * AutomationSettings Component
 * Manages OpenClaw automation features: Hooks, Cron, Plugins, Commands, Approvals
 * and Gateway config reload mode.
 *
 * Supports version compatibility checking:
 * - v2026.3.8+: Commands
 * - v2026.3.11+: Hooks, Cron, Plugins, Config Reload Mode
 * - v2026.3.12+: Approvals (Lobster)
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Webhook,
  Clock,
  Puzzle,
  Terminal,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { invokeIpc } from '@/lib/api-client';
import { useAutomationStore, FEATURE_MIN_VERSIONS } from '@/stores/automation';
import type { AutomationConfig, ConfigReloadMode } from '@/stores/automation';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// ── Version Helpers ──────────────────────────────────────────────

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

function isFeatureAvailable(feature: string, currentVersion: string | undefined): boolean {
  if (!currentVersion) return false;
  const minVersion = FEATURE_MIN_VERSIONS[feature];
  if (!minVersion) return true;
  return compareVersions(currentVersion, minVersion) >= 0;
}

// ── Section Component ────────────────────────────────────────────

interface SectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  feature: string;
  openClawVersion: string | undefined;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function AutomationSection({
  title,
  description,
  icon,
  feature,
  openClawVersion,
  defaultOpen = false,
  children,
}: SectionProps) {
  const { t } = useTranslation('settings');
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const available = isFeatureAvailable(feature, openClawVersion);
  const minVersion = FEATURE_MIN_VERSIONS[feature];

  return (
    <div className="rounded-lg border border-border/60">
      <button
        type="button"
        className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{title}</span>
              {!available && minVersion && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-amber-500 border-amber-500/30">
                  v{minVersion}+
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{description}</p>
          </div>
        </div>
        {isOpen
          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {isOpen && (
        <div className="border-t border-border/60 p-3 space-y-3">
          {!available ? (
            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t('automation.upgradePrompt', {
                  current: openClawVersion || '?',
                  required: minVersion,
                })}
              </p>
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}

// ── Reload Mode Selector ─────────────────────────────────────────

interface ReloadModeSelectorProps {
  value: ConfigReloadMode;
  onChange: (mode: ConfigReloadMode) => void;
  disabled?: boolean;
}

function ReloadModeSelector({ value, onChange, disabled }: ReloadModeSelectorProps) {
  const { t } = useTranslation('settings');
  const modes: ConfigReloadMode[] = ['off', 'restart', 'hot', 'hybrid'];

  return (
    <div className="grid grid-cols-2 gap-2">
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          disabled={disabled}
          onClick={() => onChange(mode)}
          className={cn(
            'flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors',
            value === mode
              ? 'border-primary bg-primary/5'
              : 'border-border/60 hover:bg-muted/30',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <span className="text-xs font-medium">
            {t(`automation.reloadMode.${mode}`)}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            {t(`automation.reloadMode.${mode}Desc`)}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

export function AutomationSettings() {
  const { t } = useTranslation('settings');

  // Use shared automation store so sidebar stays in sync
  const config = useAutomationStore((s) => s.config);
  const openClawVersion = useAutomationStore((s) => s.openClawVersion);
  const loaded = useAutomationStore((s) => s.loaded);
  const saving = useAutomationStore((s) => s.saving);
  const initAutomation = useAutomationStore((s) => s.init);
  const setConfig = useAutomationStore((s) => s.setConfig);
  const setSaving = useAutomationStore((s) => s.setSaving);
  const refreshStore = useAutomationStore((s) => s.refresh);

  // Load on mount via store (idempotent)
  useEffect(() => {
    initAutomation();
  }, [initAutomation]);

  const saveConfig = useCallback(async (updates: Partial<AutomationConfig>) => {
    setSaving(true);
    try {
      const result = await invokeIpc<{ success: boolean; config?: AutomationConfig; error?: string }>(
        'automation:updateConfig',
        updates,
      );
      if (result?.success && result.config) {
        setConfig(result.config);
        // Refresh store so sidebar picks up the change
        await refreshStore();
        toast.success(t('automation.saved'));
      } else {
        toast.error(`${t('automation.saveFailed')}: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error(`${t('automation.saveFailed')}: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  }, [t, setConfig, setSaving, refreshStore]);

  const handleReloadModeChange = useCallback(async (mode: ConfigReloadMode) => {
    setSaving(true);
    try {
      const result = await invokeIpc<{ success: boolean; error?: string }>(
        'automation:setReloadMode',
        mode,
      );
      if (result?.success) {
        setConfig({ ...config, configReloadMode: mode });
        toast.success(t('automation.saved'));
      } else {
        toast.error(`${t('automation.saveFailed')}: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error(`${t('automation.saveFailed')}: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  }, [t, config, setConfig, setSaving]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Version info */}
      {openClawVersion ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>OpenClaw v{openClawVersion}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-amber-500">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{t('automation.versionUnknown')}</span>
        </div>
      )}

      {/* Hooks */}
      <AutomationSection
        title={t('automation.hooks.title')}
        description={t('automation.hooks.description')}
        icon={<Webhook className="h-4 w-4 text-blue-500" />}
        feature="hooks"
        openClawVersion={openClawVersion}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">{t('automation.hooks.enabled')}</Label>
              <p className="text-[10px] text-muted-foreground">{t('automation.hooks.enabledDesc')}</p>
            </div>
            <Switch
              checked={config.hooks?.enabled ?? false}
              onCheckedChange={(v) => saveConfig({ hooks: { enabled: v } })}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">{t('automation.hooks.internalEnabled')}</Label>
              <p className="text-[10px] text-muted-foreground">{t('automation.hooks.internalEnabledDesc')}</p>
            </div>
            <Switch
              checked={config.hooks?.internal?.enabled ?? false}
              onCheckedChange={(v) => saveConfig({ hooks: { internal: { enabled: v } } })}
              disabled={saving}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t('automation.hooks.webhookToken')}</Label>
            <Input
              type="password"
              value={config.hooks?.token ?? ''}
              onChange={(e) => setConfig({
                ...config,
                hooks: { ...config.hooks, token: e.target.value },
              })}
              onBlur={() => {
                if (config.hooks?.token !== undefined) {
                  saveConfig({ hooks: { token: config.hooks.token } });
                }
              }}
              placeholder="shared-secret"
              className="h-8 text-xs"
              disabled={saving}
            />
            <p className="text-[10px] text-muted-foreground">{t('automation.hooks.webhookTokenDesc')}</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t('automation.hooks.webhookPath')}</Label>
            <Input
              value={config.hooks?.path ?? '/hooks'}
              onChange={(e) => setConfig({
                ...config,
                hooks: { ...config.hooks, path: e.target.value },
              })}
              onBlur={() => {
                if (config.hooks?.path !== undefined) {
                  saveConfig({ hooks: { path: config.hooks.path } });
                }
              }}
              placeholder="/hooks"
              className="h-8 text-xs"
              disabled={saving}
            />
            <p className="text-[10px] text-muted-foreground">{t('automation.hooks.webhookPathDesc')}</p>
          </div>
        </div>
      </AutomationSection>

      {/* Cron */}
      <AutomationSection
        title={t('automation.cron.title')}
        description={t('automation.cron.description')}
        icon={<Clock className="h-4 w-4 text-green-500" />}
        feature="cron"
        openClawVersion={openClawVersion}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">{t('automation.cron.enabled')}</Label>
              <p className="text-[10px] text-muted-foreground">{t('automation.cron.enabledDesc')}</p>
            </div>
            <Switch
              checked={config.cron?.enabled ?? false}
              onCheckedChange={(v) => saveConfig({ cron: { enabled: v } })}
              disabled={saving}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t('automation.cron.maxConcurrent')}</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={config.cron?.maxConcurrentRuns ?? 1}
              onChange={(e) => setConfig({
                ...config,
                cron: { ...config.cron, maxConcurrentRuns: parseInt(e.target.value, 10) || 1 },
              })}
              onBlur={() => saveConfig({ cron: { maxConcurrentRuns: config.cron?.maxConcurrentRuns ?? 1 } })}
              className="h-8 text-xs w-20"
              disabled={saving}
            />
            <p className="text-[10px] text-muted-foreground">{t('automation.cron.maxConcurrentDesc')}</p>
          </div>
        </div>
      </AutomationSection>

      {/* Plugins */}
      <AutomationSection
        title={t('automation.plugins.title')}
        description={t('automation.plugins.description')}
        icon={<Puzzle className="h-4 w-4 text-purple-500" />}
        feature="plugins"
        openClawVersion={openClawVersion}
      >
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">{t('automation.plugins.enabled')}</Label>
            <p className="text-[10px] text-muted-foreground">{t('automation.plugins.enabledDesc')}</p>
          </div>
          <Switch
            checked={config.plugins?.enabled ?? false}
            onCheckedChange={(v) => saveConfig({ plugins: { enabled: v } })}
            disabled={saving}
          />
        </div>
      </AutomationSection>

      {/* Commands */}
      <AutomationSection
        title={t('automation.commands.title')}
        description={t('automation.commands.description')}
        icon={<Terminal className="h-4 w-4 text-orange-500" />}
        feature="commands"
        openClawVersion={openClawVersion}
        defaultOpen
      >
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">{t('automation.commands.restart')}</Label>
            <p className="text-[10px] text-muted-foreground">{t('automation.commands.restartDesc')}</p>
          </div>
          <Switch
            checked={config.commands?.restart ?? true}
            onCheckedChange={(v) => saveConfig({ commands: { restart: v } })}
            disabled={saving}
          />
        </div>
      </AutomationSection>

      {/* Approvals */}
      <AutomationSection
        title={t('automation.approvals.title')}
        description={t('automation.approvals.description')}
        icon={<ShieldCheck className="h-4 w-4 text-teal-500" />}
        feature="approvals"
        openClawVersion={openClawVersion}
      >
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">{t('automation.approvals.enabled')}</Label>
            <p className="text-[10px] text-muted-foreground">{t('automation.approvals.enabledDesc')}</p>
          </div>
          <Switch
            checked={config.approvals?.enabled ?? false}
            onCheckedChange={(v) => saveConfig({ approvals: { enabled: v } })}
            disabled={saving}
          />
        </div>
      </AutomationSection>

      <Separator />

      {/* Config Reload Mode */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-cyan-500" />
          <div>
            <Label className="text-sm">{t('automation.reloadMode.title')}</Label>
            <p className="text-[11px] text-muted-foreground">{t('automation.reloadMode.description')}</p>
          </div>
        </div>
        {isFeatureAvailable('configReloadMode', openClawVersion) ? (
          <ReloadModeSelector
            value={config.configReloadMode ?? 'off'}
            onChange={handleReloadModeChange}
            disabled={saving}
          />
        ) : (
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('automation.upgradePrompt', {
                current: openClawVersion || '?',
                required: FEATURE_MIN_VERSIONS.configReloadMode,
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
