/**
 * Settings Page
 * Application configuration
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  RefreshCw,
  Terminal,
  ExternalLink,
  Download,
  Copy,
  ChevronDown,
  ChevronRight,
  FileText,
  Image,
  Trash2,
  Palette,
  Upload,
  HardDriveDownload,
  PackageCheck,
  Loader2,
  Video,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings';
import { useGatewayStore } from '@/stores/gateway';
import { useUpdateStore } from '@/stores/update';
import { UpdateSettings } from '@/components/settings/UpdateSettings';
import {
  getGatewayWsDiagnosticEnabled,
  invokeIpc,
  setGatewayWsDiagnosticEnabled,
  toUserMessage,
} from '@/lib/api-client';
import {
  clearUiTelemetry,
  getUiTelemetrySnapshot,
  subscribeUiTelemetry,
  trackUiEvent,
  type UiTelemetryEntry,
} from '@/lib/telemetry';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { hostApiFetch } from '@/lib/host-api';
import { THEME_COLOR_PRESETS } from '@/lib/theme-colors';
type ControlUiInfo = {
  url: string;
  token: string;
  port: number;
};

// ── Migration Section Component ──────────────────────────────────

interface BackupSummary {
  settingsSize: number;
  providersCount: number;
  channelsCount: number;
  skillsCount: number;
  chatSessionsCount: number;
  agentsCount: number;
  hasBackgroundImage: boolean;
}

function MigrationSection() {
  const { t } = useTranslation('settings');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportStage, setExportStage] = useState('');
  const [summary, setSummary] = useState<BackupSummary | null>(null);

  // Load backup summary on mount
  useEffect(() => {
    invokeIpc<BackupSummary>('migration:summary')
      .then(setSummary)
      .catch(() => { /* ignore */ });
  }, []);

  // Listen for progress events
  useEffect(() => {
    const handler = (...args: unknown[]) => {
      const progress = args[0] as { stage: string } | undefined;
      if (progress?.stage) {
        setExportStage(progress.stage);
      }
    };
    window.electron?.ipcRenderer?.on?.('migration:progress', handler);
    return () => {
      window.electron?.ipcRenderer?.off?.('migration:progress', handler);
    };
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setExportStage('');
    try {
      const result = await invokeIpc<{
        success: boolean;
        canceled?: boolean;
        filePath?: string;
        sizeMB?: number;
        error?: string;
      }>('migration:export');

      if (result.canceled) {
        return;
      }
      if (result.success) {
        toast.success(t('migration.export.success'), {
          description: t('migration.export.successDetail', { size: result.sizeMB?.toFixed(1) || '0' }),
        });
      } else {
        toast.error(t('migration.export.error'), { description: result.error });
      }
    } catch (err) {
      toast.error(t('migration.export.error'), { description: String(err) });
    } finally {
      setExporting(false);
      setExportStage('');
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await invokeIpc<{
        success: boolean;
        canceled?: boolean;
        restored?: string[];
        errors?: Array<{ category: string; error: string }>;
        error?: string;
      }>('migration:import');

      if (result.canceled) {
        return;
      }
      if (result.success || (result.restored && result.restored.length > 0)) {
        toast.success(t('migration.import.success'), {
          description: t('migration.import.successDetail', { count: result.restored?.length || 0 }),
          action: {
            label: t('migration.import.restart'),
            onClick: () => invokeIpc('app:relaunch'),
          },
        });
      } else {
        const errorMsg = result.error || result.errors?.map(e => `${e.category}: ${e.error}`).join('; ');
        toast.error(t('migration.import.error'), { description: errorMsg });
      }
    } catch (err) {
      toast.error(t('migration.import.error'), { description: String(err) });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {summary.providersCount > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <PackageCheck className="h-4 w-4 shrink-0" />
              <span>{t('migration.summary.providers', { count: summary.providersCount })}</span>
            </div>
          )}
          {summary.channelsCount > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <PackageCheck className="h-4 w-4 shrink-0" />
              <span>{t('migration.summary.channels', { count: summary.channelsCount })}</span>
            </div>
          )}
          {summary.skillsCount > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <PackageCheck className="h-4 w-4 shrink-0" />
              <span>{t('migration.summary.skills', { count: summary.skillsCount })}</span>
            </div>
          )}
          {summary.chatSessionsCount > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <PackageCheck className="h-4 w-4 shrink-0" />
              <span>{t('migration.summary.chatSessions', { count: summary.chatSessionsCount })}</span>
            </div>
          )}
          {summary.agentsCount > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bot className="h-4 w-4 shrink-0" />
              <span>{t('migration.summary.agents', { count: summary.agentsCount })}</span>
            </div>
          )}
          {summary.settingsSize > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <PackageCheck className="h-4 w-4 shrink-0" />
              <span>{t('migration.summary.settings')}</span>
            </div>
          )}
          {summary.hasBackgroundImage && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <PackageCheck className="h-4 w-4 shrink-0" />
              <span>{t('migration.summary.backgroundImage')}</span>
            </div>
          )}
        </div>
      )}

      {/* Progress indicator */}
      {exportStage && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t(`migration.stage.${exportStage}`, exportStage)}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={handleExport}
          disabled={exporting || importing}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <HardDriveDownload className="h-4 w-4" />
          )}
          {exporting ? t('migration.export.exporting') : t('migration.export.button')}
        </Button>

        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={handleImport}
          disabled={exporting || importing}
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {importing ? t('migration.import.importing') : t('migration.import.button')}
        </Button>
      </div>
    </div>
  );
}

export function Settings() {
  const { t } = useTranslation('settings');
  const {
    theme,
    setTheme,
    themeColor,
    setThemeColor,
    language,
    setLanguage,
    gatewayAutoStart,
    setGatewayAutoStart,
    proxyEnabled,
    proxyServer,
    proxyHttpServer,
    proxyHttpsServer,
    proxyAllServer,
    proxyBypassRules,
    setProxyEnabled,
    setProxyServer,
    setProxyHttpServer,
    setProxyHttpsServer,
    setProxyAllServer,
    setProxyBypassRules,
    autoCheckUpdate,
    setAutoCheckUpdate,
    autoDownloadUpdate,
    setAutoDownloadUpdate,
    devModeUnlocked,
    setDevModeUnlocked,
    backgroundImage,
    backgroundType,
    backgroundOpacity,
    backgroundBlur,
    setBackgroundImage,
    setBackgroundType,
    setBackgroundOpacity,
    setBackgroundBlur,
  } = useSettingsStore();

  const { status: gatewayStatus, restart: restartGateway } = useGatewayStore();
  const currentVersion = useUpdateStore((state) => state.currentVersion);
  const updateSetAutoDownload = useUpdateStore((state) => state.setAutoDownload);
  const [controlUiInfo, setControlUiInfo] = useState<ControlUiInfo | null>(null);
  const [openclawCliCommand, setOpenclawCliCommand] = useState('');
  const [openclawCliError, setOpenclawCliError] = useState<string | null>(null);
  const [proxyServerDraft, setProxyServerDraft] = useState('');
  const [proxyHttpServerDraft, setProxyHttpServerDraft] = useState('');
  const [proxyHttpsServerDraft, setProxyHttpsServerDraft] = useState('');
  const [proxyAllServerDraft, setProxyAllServerDraft] = useState('');
  const [proxyBypassRulesDraft, setProxyBypassRulesDraft] = useState('');
  const [proxyEnabledDraft, setProxyEnabledDraft] = useState(false);
  const [showAdvancedProxy, setShowAdvancedProxy] = useState(false);
  const [savingProxy, setSavingProxy] = useState(false);
  const [wsDiagnosticEnabled, setWsDiagnosticEnabled] = useState(false);
  const [showTelemetryViewer, setShowTelemetryViewer] = useState(false);
  const [telemetryEntries, setTelemetryEntries] = useState<UiTelemetryEntry[]>([]);

  const isWindows = window.electron.platform === 'win32';
  const showCliTools = true;
  const [showLogs, setShowLogs] = useState(false);
  const [logContent, setLogContent] = useState('');
  const [bgPreviewUrl, setBgPreviewUrl] = useState('');
  const [bgIsVideo, setBgIsVideo] = useState(false);
  const [customColorDraft, setCustomColorDraft] = useState(
    themeColor.startsWith('#') ? themeColor : ''
  );
  const isCustomColor = themeColor.startsWith('#');

  // Load background preview on mount / when backgroundImage changes
  useEffect(() => {
    if (!backgroundImage) {
      setBgPreviewUrl('');
      setBgIsVideo(false);
      return;
    }
    invokeIpc<{ success: boolean; dataUrl?: string; isVideo?: boolean; mimeType?: string }>('settings:getBackgroundImageDataUrl')
      .then((res) => {
        if (res?.success) {
          const isVideo = res.isVideo ?? false;
          setBgIsVideo(isVideo);
          if (isVideo) {
            setBgPreviewUrl(`clawx-bg://background?t=${Date.now()}`);
          } else if (res.dataUrl) {
            setBgPreviewUrl(res.dataUrl);
          } else {
            setBgPreviewUrl('');
          }
        } else {
          setBgPreviewUrl('');
          setBgIsVideo(false);
        }
      })
      .catch(() => { setBgPreviewUrl(''); setBgIsVideo(false); });
  }, [backgroundImage, backgroundType]);

  const handleSelectBackground = async () => {
    try {
      const res = await invokeIpc<{ success: boolean; canceled?: boolean; path?: string; dataUrl?: string; isVideo?: boolean; mimeType?: string; error?: string }>(
        'settings:selectBackgroundImage'
      );
      if (res?.success && res.path) {
        const isVideo = res.isVideo ?? false;
        setBackgroundImage(res.path);
        setBackgroundType(isVideo ? 'video' : 'image');
        setBgIsVideo(isVideo);
        if (isVideo) {
          setBgPreviewUrl(`clawx-bg://background?t=${Date.now()}`);
        } else if (res.dataUrl) {
          setBgPreviewUrl(res.dataUrl);
        }
        toast.success(t('appearance.backgroundSelected'));
      } else if (res && !res.canceled) {
        toast.error(t('appearance.backgroundFailed'));
      }
    } catch {
      toast.error(t('appearance.backgroundFailed'));
    }
  };

  const handleRemoveBackground = async () => {
    try {
      await invokeIpc('settings:removeBackgroundImage');
      setBackgroundImage('');
      setBackgroundType('');
      setBgPreviewUrl('');
      setBgIsVideo(false);
      setBackgroundOpacity(0.3);
      setBackgroundBlur(0);
      toast.success(t('appearance.backgroundRemoved'));
    } catch {
      toast.error(t('appearance.backgroundFailed'));
    }
  };

  const handleShowLogs = async () => {
    try {
      const logs = await hostApiFetch<{ content: string }>('/api/logs?tailLines=100');
      setLogContent(logs.content);
      setShowLogs(true);
    } catch {
      setLogContent('(Failed to load logs)');
      setShowLogs(true);
    }
  };

  const handleOpenLogDir = async () => {
    try {
      const { dir: logDir } = await hostApiFetch<{ dir: string | null }>('/api/logs/dir');
      if (logDir) {
        await invokeIpc('shell:showItemInFolder', logDir);
      }
    } catch {
      // ignore
    }
  };

  // Open developer console
  const openDevConsole = async () => {
    try {
      const result = await hostApiFetch<{
        success: boolean;
        url?: string;
        token?: string;
        port?: number;
        error?: string;
      }>('/api/gateway/control-ui');
      if (result.success && result.url && result.token && typeof result.port === 'number') {
        setControlUiInfo({ url: result.url, token: result.token, port: result.port });
        trackUiEvent('settings.open_dev_console');
        window.electron.openExternal(result.url);
      } else {
        console.error('Failed to get Dev Console URL:', result.error);
      }
    } catch (err) {
      console.error('Error opening Dev Console:', err);
    }
  };

  const refreshControlUiInfo = async () => {
    try {
      const result = await hostApiFetch<{
        success: boolean;
        url?: string;
        token?: string;
        port?: number;
      }>('/api/gateway/control-ui');
      if (result.success && result.url && result.token && typeof result.port === 'number') {
        setControlUiInfo({ url: result.url, token: result.token, port: result.port });
      }
    } catch {
      // Ignore refresh errors
    }
  };

  const handleCopyGatewayToken = async () => {
    if (!controlUiInfo?.token) return;
    try {
      await navigator.clipboard.writeText(controlUiInfo.token);
      toast.success(t('developer.tokenCopied'));
    } catch (error) {
      toast.error(`Failed to copy token: ${String(error)}`);
    }
  };

  useEffect(() => {
    if (!showCliTools) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await invokeIpc<{
          success: boolean;
          command?: string;
          error?: string;
        }>('openclaw:getCliCommand');
        if (cancelled) return;
        if (result.success && result.command) {
          setOpenclawCliCommand(result.command);
          setOpenclawCliError(null);
        } else {
          setOpenclawCliCommand('');
          setOpenclawCliError(result.error || 'OpenClaw CLI unavailable');
        }
      } catch (error) {
        if (cancelled) return;
        setOpenclawCliCommand('');
        setOpenclawCliError(String(error));
      }
    })();

    return () => { cancelled = true; };
  }, [devModeUnlocked, showCliTools]);

  const handleCopyCliCommand = async () => {
    if (!openclawCliCommand) return;
    try {
      await navigator.clipboard.writeText(openclawCliCommand);
      toast.success(t('developer.cmdCopied'));
    } catch (error) {
      toast.error(`Failed to copy command: ${String(error)}`);
    }
  };

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      'openclaw:cli-installed',
      (...args: unknown[]) => {
        const installedPath = typeof args[0] === 'string' ? args[0] : '';
        toast.success(`openclaw CLI installed at ${installedPath}`);
      },
    );
    return () => { unsubscribe?.(); };
  }, []);

  useEffect(() => {
    setWsDiagnosticEnabled(getGatewayWsDiagnosticEnabled());
  }, []);

  useEffect(() => {
    if (!devModeUnlocked) return;
    setTelemetryEntries(getUiTelemetrySnapshot(200));
    const unsubscribe = subscribeUiTelemetry((entry) => {
      setTelemetryEntries((prev) => {
        const next = [...prev, entry];
        if (next.length > 200) {
          next.splice(0, next.length - 200);
        }
        return next;
      });
    });
    return unsubscribe;
  }, [devModeUnlocked]);

  useEffect(() => {
    setProxyEnabledDraft(proxyEnabled);
  }, [proxyEnabled]);

  useEffect(() => {
    setProxyServerDraft(proxyServer);
  }, [proxyServer]);

  useEffect(() => {
    setProxyHttpServerDraft(proxyHttpServer);
  }, [proxyHttpServer]);

  useEffect(() => {
    setProxyHttpsServerDraft(proxyHttpsServer);
  }, [proxyHttpsServer]);

  useEffect(() => {
    setProxyAllServerDraft(proxyAllServer);
  }, [proxyAllServer]);

  useEffect(() => {
    setProxyBypassRulesDraft(proxyBypassRules);
  }, [proxyBypassRules]);

  const handleSaveProxySettings = async () => {
    setSavingProxy(true);
    try {
      const normalizedProxyServer = proxyServerDraft.trim();
      const normalizedHttpServer = proxyHttpServerDraft.trim();
      const normalizedHttpsServer = proxyHttpsServerDraft.trim();
      const normalizedAllServer = proxyAllServerDraft.trim();
      const normalizedBypassRules = proxyBypassRulesDraft.trim();
      await invokeIpc('settings:setMany', {
        proxyEnabled: proxyEnabledDraft,
        proxyServer: normalizedProxyServer,
        proxyHttpServer: normalizedHttpServer,
        proxyHttpsServer: normalizedHttpsServer,
        proxyAllServer: normalizedAllServer,
        proxyBypassRules: normalizedBypassRules,
      });

      setProxyServer(normalizedProxyServer);
      setProxyHttpServer(normalizedHttpServer);
      setProxyHttpsServer(normalizedHttpsServer);
      setProxyAllServer(normalizedAllServer);
      setProxyBypassRules(normalizedBypassRules);
      setProxyEnabled(proxyEnabledDraft);

      toast.success(t('gateway.proxySaved'));
      trackUiEvent('settings.proxy_saved', { enabled: proxyEnabledDraft });
    } catch (error) {
      toast.error(`${t('gateway.proxySaveFailed')}: ${toUserMessage(error)}`);
    } finally {
      setSavingProxy(false);
    }
  };

  const telemetryStats = useMemo(() => {
    let errorCount = 0;
    let slowCount = 0;
    for (const entry of telemetryEntries) {
      if (entry.event.endsWith('_error') || entry.event.includes('request_error')) {
        errorCount += 1;
      }
      const durationMs = typeof entry.payload.durationMs === 'number'
        ? entry.payload.durationMs
        : Number.NaN;
      if (Number.isFinite(durationMs) && durationMs >= 800) {
        slowCount += 1;
      }
    }
    return { total: telemetryEntries.length, errorCount, slowCount };
  }, [telemetryEntries]);

  const telemetryByEvent = useMemo(() => {
    const map = new Map<string, {
      event: string;
      count: number;
      errorCount: number;
      slowCount: number;
      totalDuration: number;
      timedCount: number;
      lastTs: string;
    }>();

    for (const entry of telemetryEntries) {
      const current = map.get(entry.event) ?? {
        event: entry.event,
        count: 0,
        errorCount: 0,
        slowCount: 0,
        totalDuration: 0,
        timedCount: 0,
        lastTs: entry.ts,
      };

      current.count += 1;
      current.lastTs = entry.ts;

      if (entry.event.endsWith('_error') || entry.event.includes('request_error')) {
        current.errorCount += 1;
      }

      const durationMs = typeof entry.payload.durationMs === 'number'
        ? entry.payload.durationMs
        : Number.NaN;
      if (Number.isFinite(durationMs)) {
        current.totalDuration += durationMs;
        current.timedCount += 1;
        if (durationMs >= 800) {
          current.slowCount += 1;
        }
      }

      map.set(entry.event, current);
    }

    return [...map.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [telemetryEntries]);

  const handleCopyTelemetry = async () => {
    try {
      const serialized = telemetryEntries.map((entry) => JSON.stringify(entry)).join('\n');
      await navigator.clipboard.writeText(serialized);
      toast.success(t('developer.telemetryCopied'));
    } catch (error) {
      toast.error(`${t('common:status.error')}: ${String(error)}`);
    }
  };

  const handleClearTelemetry = () => {
    clearUiTelemetry();
    setTelemetryEntries([]);
    toast.success(t('developer.telemetryCleared'));
  };

  const handleWsDiagnosticToggle = (enabled: boolean) => {
    setGatewayWsDiagnosticEnabled(enabled);
    setWsDiagnosticEnabled(enabled);
    toast.success(
      enabled
        ? t('developer.wsDiagnosticEnabled')
        : t('developer.wsDiagnosticDisabled'),
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {/* Appearance */}
      <Card className="order-2">
        <CardHeader>
          <CardTitle>{t('appearance.title')}</CardTitle>
          <CardDescription>{t('appearance.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('appearance.theme')}</Label>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
              >
                <Sun className="h-4 w-4 mr-2" />
                {t('appearance.light')}
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
              >
                <Moon className="h-4 w-4 mr-2" />
                {t('appearance.dark')}
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
              >
                <Monitor className="h-4 w-4 mr-2" />
                {t('appearance.system')}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('appearance.themeColor')}</Label>
            <div className="flex flex-wrap items-center gap-2">
              {THEME_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id || '__default'}
                  type="button"
                  title={t(`appearance.colors.${preset.labelKey}`)}
                  className={`h-7 w-7 rounded-full border-2 transition-all hover:scale-110 ${
                    themeColor === preset.id
                      ? 'border-foreground scale-110 ring-2 ring-foreground/20'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: preset.swatch }}
                  onClick={() => setThemeColor(preset.id)}
                />
              ))}
              {/* Custom color input */}
              <div className="flex items-center gap-1.5 ml-1">
                <label
                  className={`relative h-7 w-7 rounded-full border-2 transition-all hover:scale-110 cursor-pointer overflow-hidden ${
                    isCustomColor
                      ? 'border-foreground scale-110 ring-2 ring-foreground/20'
                      : 'border-muted-foreground/40'
                  }`}
                  title={t('appearance.customColor')}
                >
                  {isCustomColor ? (
                    <span
                      className="absolute inset-0 rounded-full"
                      style={{ backgroundColor: themeColor }}
                    />
                  ) : (
                    <Palette className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" />
                  )}
                  <input
                    type="color"
                    className="sr-only"
                    value={customColorDraft || '#3b82f6'}
                    onChange={(e) => {
                      setCustomColorDraft(e.target.value);
                      setThemeColor(e.target.value);
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('appearance.language')}</Label>
            <div className="flex gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <Button
                  key={lang.code}
                  variant={language === lang.code ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLanguage(lang.code)}
                >
                  {lang.label}
                </Button>
              ))}
            </div>
          </div>
          <Separator />
          <div className="space-y-4">
            <Label>{t('appearance.background')}</Label>
            <div className="flex items-start gap-4">
              {/* Preview thumbnail */}
              <div
                className="relative h-24 w-40 shrink-0 overflow-hidden rounded-md border bg-muted flex items-center justify-center cursor-pointer"
                onClick={handleSelectBackground}
                title={t('appearance.uploadBackground')}
              >
                {bgPreviewUrl && bgIsVideo ? (
                  <video
                    src={bgPreviewUrl}
                    muted
                    autoPlay
                    loop
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : bgPreviewUrl ? (
                  <img
                    src={bgPreviewUrl}
                    alt="background preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Image className="h-6 w-6" />
                    <span className="text-xs">{t('appearance.noBackgroundSet')}</span>
                  </div>
                )}
                {bgIsVideo && bgPreviewUrl && (
                  <div className="absolute top-1 right-1 rounded bg-black/60 px-1.5 py-0.5">
                    <Video className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectBackground}>
                  <Image className="h-4 w-4 mr-2" />
                  {backgroundImage ? t('appearance.changeBackground') : t('appearance.uploadBackground')}
                </Button>
                {backgroundImage && (
                  <Button variant="outline" size="sm" onClick={handleRemoveBackground} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('appearance.removeBackground')}
                  </Button>
                )}
                {bgIsVideo && (
                  <p className="text-xs text-muted-foreground">{t('appearance.videoHint')}</p>
                )}
              </div>
            </div>
            {/* Sliders only visible when a background is set */}
            {backgroundImage && (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">{t('appearance.backgroundOpacity')}</Label>
                    <span className="text-xs text-muted-foreground">{Math.round(backgroundOpacity * 100)}%</span>
                  </div>
                  <Slider
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={[backgroundOpacity]}
                    onValueChange={([v]) => setBackgroundOpacity(v)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">{t('appearance.backgroundBlur')}</Label>
                    <span className="text-xs text-muted-foreground">{backgroundBlur}px</span>
                  </div>
                  <Slider
                    min={0}
                    max={30}
                    step={1}
                    value={[backgroundBlur]}
                    onValueChange={([v]) => setBackgroundBlur(v)}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gateway */}
      <Card className="order-1">
        <CardHeader>
          <CardTitle>{t('gateway.title')}</CardTitle>
          <CardDescription>{t('gateway.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('gateway.status')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('gateway.port')}: {gatewayStatus.port}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  gatewayStatus.state === 'running'
                    ? 'success'
                    : gatewayStatus.state === 'error'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {gatewayStatus.state}
              </Badge>
              <Button variant="outline" size="sm" onClick={restartGateway}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('common:actions.restart')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleShowLogs}>
                <FileText className="h-4 w-4 mr-2" />
                {t('gateway.logs')}
              </Button>
            </div>
          </div>

          {showLogs && (
            <div className="mt-4 p-4 rounded-lg bg-black/10 dark:bg-black/40 border border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">{t('gateway.appLogs')}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleOpenLogDir}>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {t('gateway.openFolder')}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowLogs(false)}>
                    {t('common:actions.close')}
                  </Button>
                </div>
              </div>
              <pre className="text-xs text-muted-foreground bg-background/50 p-3 rounded max-h-60 overflow-auto whitespace-pre-wrap font-mono">
                {logContent || t('chat:noLogs')}
              </pre>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('gateway.autoStart')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('gateway.autoStartDesc')}
              </p>
            </div>
            <Switch
              checked={gatewayAutoStart}
              onCheckedChange={setGatewayAutoStart}
            />
          </div>

          <Separator />

          {devModeUnlocked ? (
            <div className="space-y-4">
              <div className="rounded-md border border-border/60 p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setShowAdvancedProxy((prev) => !prev)}
                >
                  {showAdvancedProxy ? (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2" />
                  )}
                  {showAdvancedProxy ? t('gateway.hideAdvancedProxy') : t('gateway.showAdvancedProxy')}
                </Button>
                {showAdvancedProxy && (
                  <div className="mt-3 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t('gateway.proxyTitle')}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t('gateway.proxyDesc')}
                        </p>
                      </div>
                      <Switch
                        checked={proxyEnabledDraft}
                        onCheckedChange={setProxyEnabledDraft}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proxy-server">{t('gateway.proxyServer')}</Label>
                      <Input
                        id="proxy-server"
                        value={proxyServerDraft}
                        onChange={(event) => setProxyServerDraft(event.target.value)}
                        placeholder="http://127.0.0.1:7890"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('gateway.proxyServerHelp')}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proxy-http-server">{t('gateway.proxyHttpServer')}</Label>
                      <Input
                        id="proxy-http-server"
                        value={proxyHttpServerDraft}
                        onChange={(event) => setProxyHttpServerDraft(event.target.value)}
                        placeholder={proxyServerDraft || 'http://127.0.0.1:7890'}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('gateway.proxyHttpServerHelp')}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proxy-https-server">{t('gateway.proxyHttpsServer')}</Label>
                      <Input
                        id="proxy-https-server"
                        value={proxyHttpsServerDraft}
                        onChange={(event) => setProxyHttpsServerDraft(event.target.value)}
                        placeholder={proxyServerDraft || 'http://127.0.0.1:7890'}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('gateway.proxyHttpsServerHelp')}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proxy-all-server">{t('gateway.proxyAllServer')}</Label>
                      <Input
                        id="proxy-all-server"
                        value={proxyAllServerDraft}
                        onChange={(event) => setProxyAllServerDraft(event.target.value)}
                        placeholder={proxyServerDraft || 'socks5://127.0.0.1:7891'}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('gateway.proxyAllServerHelp')}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proxy-bypass">{t('gateway.proxyBypass')}</Label>
                      <Input
                        id="proxy-bypass"
                        value={proxyBypassRulesDraft}
                        onChange={(event) => setProxyBypassRulesDraft(event.target.value)}
                        placeholder="<local>;localhost;127.0.0.1;::1"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('gateway.proxyBypassHelp')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
                      <p className="text-sm text-muted-foreground">
                        {t('gateway.proxyRestartNote')}
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleSaveProxySettings}
                        disabled={savingProxy}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2${savingProxy ? ' animate-spin' : ''}`} />
                        {savingProxy ? t('common:status.saving') : t('common:actions.save')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              {t('advanced.devModeDesc')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Updates */}
      <Card className="order-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('updates.title')}
          </CardTitle>
          <CardDescription>{t('updates.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UpdateSettings />

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('updates.autoCheck')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('updates.autoCheckDesc')}
              </p>
            </div>
            <Switch
              checked={autoCheckUpdate}
              onCheckedChange={setAutoCheckUpdate}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('updates.autoDownload')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('updates.autoDownloadDesc')}
              </p>
            </div>
            <Switch
              checked={autoDownloadUpdate}
              onCheckedChange={(value) => {
                setAutoDownloadUpdate(value);
                updateSetAutoDownload(value);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Advanced */}
      <Card className="order-2">
        <CardHeader>
          <CardTitle>{t('advanced.title')}</CardTitle>
          <CardDescription>{t('advanced.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('advanced.devMode')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('advanced.devModeDesc')}
              </p>
            </div>
            <Switch
              checked={devModeUnlocked}
              onCheckedChange={setDevModeUnlocked}
            />
          </div>
        </CardContent>
      </Card>

      {/* Developer */}
      {devModeUnlocked && (
        <Card className="order-2">
          <CardHeader>
            <CardTitle>{t('developer.title')}</CardTitle>
            <CardDescription>{t('developer.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('developer.console')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('developer.consoleDesc')}
              </p>
              <Button variant="outline" onClick={openDevConsole}>
                <Terminal className="h-4 w-4 mr-2" />
                {t('developer.openConsole')}
                <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground">
                {t('developer.consoleNote')}
              </p>
              <div className="space-y-2 pt-2">
                <Label>{t('developer.gatewayToken')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('developer.gatewayTokenDesc')}
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={controlUiInfo?.token || ''}
                    placeholder={t('developer.tokenUnavailable')}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={refreshControlUiInfo}
                    disabled={!devModeUnlocked}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t('common:actions.load')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyGatewayToken}
                    disabled={!controlUiInfo?.token}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {t('common:actions.copy')}
                  </Button>
                </div>
              </div>
            </div>
            {showCliTools && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>{t('developer.cli')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('developer.cliDesc')}
                  </p>
                  {isWindows && (
                    <p className="text-xs text-muted-foreground">
                      {t('developer.cliPowershell')}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={openclawCliCommand}
                      placeholder={openclawCliError || t('developer.cmdUnavailable')}
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopyCliCommand}
                      disabled={!openclawCliCommand}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      {t('common:actions.copy')}
                    </Button>
                  </div>
                </div>
              </>
            )}

            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                <div>
                  <Label>{t('developer.wsDiagnostic')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('developer.wsDiagnosticDesc')}
                  </p>
                </div>
                <Switch
                  checked={wsDiagnosticEnabled}
                  onCheckedChange={handleWsDiagnosticToggle}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('developer.telemetryViewer')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('developer.telemetryViewerDesc')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTelemetryViewer((prev) => !prev)}
                >
                  {showTelemetryViewer
                    ? t('common:actions.hide')
                    : t('common:actions.show')}
                </Button>
              </div>

              {showTelemetryViewer && (
                <div className="space-y-3 rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{t('developer.telemetryTotal')}: {telemetryStats.total}</Badge>
                    <Badge variant={telemetryStats.errorCount > 0 ? 'destructive' : 'secondary'}>
                      {t('developer.telemetryErrors')}: {telemetryStats.errorCount}
                    </Badge>
                    <Badge variant={telemetryStats.slowCount > 0 ? 'secondary' : 'outline'}>
                      {t('developer.telemetrySlow')}: {telemetryStats.slowCount}
                    </Badge>
                    <div className="ml-auto flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleCopyTelemetry}>
                        <Copy className="h-4 w-4 mr-2" />
                        {t('common:actions.copy')}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={handleClearTelemetry}>
                        {t('common:actions.clear')}
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-auto rounded-md border border-border/50 bg-muted/20">
                    {telemetryByEvent.length > 0 && (
                      <div className="border-b border-border/50 bg-background/70 p-2">
                        <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
                          {t('developer.telemetryAggregated')}
                        </p>
                        <div className="space-y-1 text-[11px]">
                          {telemetryByEvent.map((item) => (
                            <div
                              key={item.event}
                              className="grid grid-cols-[minmax(0,1.6fr)_0.7fr_0.9fr_0.8fr_1fr] gap-2 rounded border border-border/40 px-2 py-1"
                            >
                              <span className="truncate font-medium" title={item.event}>{item.event}</span>
                              <span className="text-muted-foreground">n={item.count}</span>
                              <span className="text-muted-foreground">
                                avg={item.timedCount > 0 ? Math.round(item.totalDuration / item.timedCount) : 0}ms
                              </span>
                              <span className="text-muted-foreground">slow={item.slowCount}</span>
                              <span className="text-muted-foreground">err={item.errorCount}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1 p-2 font-mono text-xs">
                      {telemetryEntries.length === 0 ? (
                        <div className="text-muted-foreground">{t('developer.telemetryEmpty')}</div>
                      ) : (
                        telemetryEntries
                          .slice()
                          .reverse()
                          .map((entry) => (
                            <div key={entry.id} className="rounded border border-border/40 bg-background/60 p-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-semibold">{entry.event}</span>
                                <span className="text-muted-foreground">{entry.ts}</span>
                              </div>
                              <pre className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">
                                {JSON.stringify({ count: entry.count, ...entry.payload }, null, 2)}
                              </pre>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Migration */}
      <Card className="order-2">
        <CardHeader>
          <CardTitle>{t('migration.title')}</CardTitle>
          <CardDescription>{t('migration.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <MigrationSection />
        </CardContent>
      </Card>

      {/* About */}
      <Card className="order-2">
        <CardHeader>
          <CardTitle>{t('about.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>{t('about.appName')}</strong> - {t('about.tagline')}
          </p>
          <p>{t('about.basedOn')}</p>
          <p>{t('about.version', { version: currentVersion })}</p>
          <div className="flex gap-4 pt-2">
            {/* <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => window.electron.openExternal('https://claw-x.com')}
            >
              {t('about.docs')}
            </Button> */}
            {/* <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => window.electron.openExternal('https://github.com/ValueCell-ai/ClawPlus')}
            >
              {t('about.github')}
            </Button> */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Settings;
