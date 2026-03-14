/**
 * OpenClaw Update Settings Component
 * Displays OpenClaw runtime version and allows checking/installing updates
 * with risk warning before update.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Download,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { invokeIpc } from '@/lib/api-client';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAutomationStore } from '@/stores/automation';

interface OpenClawUpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
}

interface OpenClawUpdateProgress {
  phase: 'checking' | 'downloading' | 'extracting' | 'installing' | 'done' | 'error';
  percent: number;
  message: string;
}

type OpenClawUpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'extracting'
  | 'installing'
  | 'done'
  | 'error';

export function OpenClawUpdateSettings() {
  const { t } = useTranslation('settings');
  const [status, setStatus] = useState<OpenClawUpdateStatus>('idle');
  const [currentVersion, setCurrentVersion] = useState('');
  const [latestVersion, setLatestVersion] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const refreshAutomation = useAutomationStore((s) => s.refresh);

  // Load current version on mount
  useEffect(() => {
    invokeIpc<{ version?: string }>('openclaw:status')
      .then((res) => {
        if (res?.version) {
          setCurrentVersion(res.version);
        }
      })
      .catch(() => {});
  }, []);

  // Listen for update progress events
  useEffect(() => {
    const handler = (...args: unknown[]) => {
      const p = args[0] as OpenClawUpdateProgress | undefined;
      if (!p) return;

      setProgress(p.percent);
      setProgressMessage(p.message);

      switch (p.phase) {
        case 'checking':
          setStatus('checking');
          break;
        case 'downloading':
          setStatus('downloading');
          break;
        case 'extracting':
          setStatus('extracting');
          break;
        case 'installing':
          setStatus('installing');
          break;
        case 'done':
          setStatus('done');
          // Refresh current version after update
          invokeIpc<{ version?: string }>('openclaw:status')
            .then((res) => {
              if (res?.version) {
                setCurrentVersion(res.version);
              }
            })
            .catch(() => {});
          // Refresh automation store so version-gated features are re-evaluated
          refreshAutomation();
          break;
        case 'error':
          setStatus('error');
          setError(p.message);
          break;
      }
    };

    window.electron?.ipcRenderer?.on?.('openclaw:update-progress', handler);
    return () => {
      window.electron?.ipcRenderer?.off?.('openclaw:update-progress', handler);
    };
  }, [refreshAutomation]);

  const handleCheckUpdate = useCallback(async () => {
    setStatus('checking');
    setError('');
    try {
      const result = await invokeIpc<OpenClawUpdateCheckResult>('openclaw:checkUpdate');
      setCurrentVersion(result.currentVersion);
      setLatestVersion(result.latestVersion);
      if (result.hasUpdate) {
        setStatus('available');
      } else {
        setStatus('not-available');
      }
    } catch (err) {
      setStatus('error');
      setError(String(err));
    }
  }, []);

  const handleConfirmUpdate = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleStartUpdate = useCallback(async () => {
    setShowConfirm(false);
    setStatus('downloading');
    setProgress(0);
    setProgressMessage('');
    try {
      const success = await invokeIpc<boolean>('openclaw:update');
      if (!success && status !== 'done' && status !== 'error') {
        setStatus('error');
        setError(t('openclawUpdate.status.failed'));
      }
    } catch (err) {
      setStatus('error');
      setError(String(err));
    }
  }, [status, t]);

  const renderStatusIcon = () => {
    switch (status) {
      case 'checking':
      case 'downloading':
      case 'extracting':
      case 'installing':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'available':
        return <Download className="h-4 w-4 text-primary" />;
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'not-available':
        return <PackageCheck className="h-4 w-4 text-green-500" />;
      case 'error':
        return <RefreshCw className="h-4 w-4 text-destructive" />;
      default:
        return <RefreshCw className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const renderStatusText = () => {
    switch (status) {
      case 'checking':
        return t('openclawUpdate.status.checking');
      case 'downloading':
        return t('openclawUpdate.status.downloading');
      case 'extracting':
        return t('openclawUpdate.status.extracting');
      case 'installing':
        return t('openclawUpdate.status.installing');
      case 'available':
        return t('openclawUpdate.status.available', { version: latestVersion });
      case 'done':
        return t('openclawUpdate.status.done');
      case 'not-available':
        return t('openclawUpdate.status.latest');
      case 'error':
        return error || t('openclawUpdate.status.failed');
      default:
        return t('openclawUpdate.status.check');
    }
  };

  const renderAction = () => {
    const isWorking = status === 'checking' || status === 'downloading' ||
      status === 'extracting' || status === 'installing';

    if (isWorking) {
      return (
        <Button disabled variant="outline" size="sm">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {status === 'checking'
            ? t('openclawUpdate.action.checking')
            : t('openclawUpdate.action.updating')}
        </Button>
      );
    }

    if (status === 'available') {
      return (
        <Button onClick={handleConfirmUpdate} size="sm">
          <Download className="h-4 w-4 mr-2" />
          {t('openclawUpdate.action.update')}
        </Button>
      );
    }

    if (status === 'error') {
      return (
        <Button onClick={handleCheckUpdate} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('openclawUpdate.action.retry')}
        </Button>
      );
    }

    return (
      <Button onClick={handleCheckUpdate} variant="outline" size="sm">
        <RefreshCw className="h-4 w-4 mr-2" />
        {t('openclawUpdate.action.check')}
      </Button>
    );
  };

  const showProgress = status === 'downloading' || status === 'extracting' || status === 'installing';

  return (
    <>
      <div className="space-y-4">
        {/* Current Version */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('openclawUpdate.currentVersion')}</p>
            <p className="text-2xl font-bold">
              {currentVersion ? `v${currentVersion}` : '-'}
            </p>
          </div>
          {renderStatusIcon()}
        </div>

        {/* Status */}
        <div className="flex items-center justify-between py-3 border-t border-b">
          <p className="text-sm text-muted-foreground">{renderStatusText()}</p>
          {renderAction()}
        </div>

        {/* Progress */}
        {showProgress && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {progressMessage || `${Math.round(progress)}%`}
            </p>
          </div>
        )}

        {/* Success message */}
        {status === 'done' && (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/10 p-4 text-green-700 dark:text-green-400 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{t('openclawUpdate.status.done')}</p>
                <p className="text-xs mt-1 opacity-80">
                  {t('openclawUpdate.restartHint')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Details */}
        {status === 'error' && error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/10 p-4 text-red-600 dark:text-red-400 text-sm">
            <p className="font-medium mb-1">{t('openclawUpdate.errorDetails')}</p>
            <p>{error}</p>
          </div>
        )}

        {/* Risk warning (always visible) */}
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 p-4 text-amber-700 dark:text-amber-400 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{t('openclawUpdate.riskWarning.title')}</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs opacity-80">
                <li>{t('openclawUpdate.riskWarning.item1')}</li>
                <li>{t('openclawUpdate.riskWarning.item2')}</li>
                <li>{t('openclawUpdate.riskWarning.item3')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirm}
        title={t('openclawUpdate.confirm.title')}
        message={t('openclawUpdate.confirm.description', {
          current: currentVersion,
          latest: latestVersion,
        }) + '\n\n• ' + t('openclawUpdate.confirm.risk1') + '\n• ' + t('openclawUpdate.confirm.risk2') + '\n• ' + t('openclawUpdate.confirm.risk3')}
        confirmLabel={t('openclawUpdate.confirm.proceed')}
        cancelLabel={t('openclawUpdate.confirm.cancel')}
        onConfirm={handleStartUpdate}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}

export default OpenClawUpdateSettings;
