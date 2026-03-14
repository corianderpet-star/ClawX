/**
 * Approvals Page
 * Manages approval workflows powered by the Lobster deterministic runtime.
 * Only accessible when OpenClaw version ≥ 2026.3.12 and approvals.enabled = true.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Settings,
  Info,
  InboxIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useGatewayStore } from '@/stores/gateway';
import { useAutomationStore } from '@/stores/automation';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// ── Types ────────────────────────────────────────────────────────

interface ApprovalRequest {
  id: string;
  agentId?: string;
  action: string;
  description?: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  metadata?: Record<string, unknown>;
}

// ── Component ────────────────────────────────────────────────────

export function Approvals() {
  const { t } = useTranslation('approvals');
  const navigate = useNavigate();
  const isGatewayRunning = useGatewayStore((s) => s.status?.state === 'running');
  const openClawVersion = useAutomationStore((s) => s.openClawVersion);
  const approvalsEnabled = useAutomationStore((s) => s.isFeatureEnabled('approvals'));
  const approvalsAvailable = useAutomationStore((s) => s.isFeatureAvailable('approvals'));

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!isGatewayRunning || !approvalsAvailable || !approvalsEnabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await hostApiFetch<ApprovalRequest[]>('/api/approvals/list');
      setRequests(Array.isArray(result) ? result : []);
    } catch {
      // API may not be available yet — this is expected for new installations
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [isGatewayRunning, approvalsAvailable, approvalsEnabled]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Not available due to version
  if (!approvalsAvailable) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-teal-500" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
              <p className="text-muted-foreground text-sm">{t('description')}</p>
            </div>
          </div>

          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">{t('versionRequired')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('currentVersion', { version: openClawVersion || '?' })}
                </p>
                <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                  {t('requiresVersion')}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Available but not enabled
  if (!approvalsEnabled) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-teal-500" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
              <p className="text-muted-foreground text-sm">{t('description')}</p>
            </div>
          </div>

          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <Info className="h-10 w-10 text-muted-foreground" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">{t('notEnabled')}</p>
                <p className="text-xs text-muted-foreground">{t('notEnabledDesc')}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/settings')}
                className="mt-2"
              >
                <Settings className="h-4 w-4 mr-2" />
                {t('goToSettings')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Gateway not running
  if (!isGatewayRunning) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-teal-500" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
              <p className="text-muted-foreground text-sm">{t('description')}</p>
            </div>
          </div>

          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
              <p className="text-sm text-muted-foreground">{t('gatewayNotRunning')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const resolvedRequests = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-teal-500" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
              <p className="text-muted-foreground text-sm">{t('description')}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadRequests}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('refresh')}
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-2 py-3">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Pending Approvals */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('pending')}</CardTitle>
                <CardDescription>{t('pendingDesc')}</CardDescription>
              </div>
              {pendingRequests.length > 0 && (
                <Badge variant="secondary">{pendingRequests.length}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <InboxIcon className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">{t('noPending')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <ApprovalItem key={req.id} request={req} onRefresh={loadRequests} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resolved History */}
        {resolvedRequests.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('history')}</CardTitle>
              <CardDescription>{t('historyDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {resolvedRequests.slice(0, 20).map((req) => (
                  <ApprovalItem key={req.id} request={req} onRefresh={loadRequests} resolved />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Approval Item Component ──────────────────────────────────────

function ApprovalItem({
  request,
  onRefresh,
  resolved,
}: {
  request: ApprovalRequest;
  onRefresh: () => void;
  resolved?: boolean;
}) {
  const { t } = useTranslation('approvals');
  const [acting, setActing] = useState(false);

  const handleAction = async (action: 'approve' | 'deny') => {
    setActing(true);
    try {
      await hostApiFetch(`/api/approvals/${request.id}/${action}`, { method: 'POST' });
      onRefresh();
    } catch {
      // Error handling
    } finally {
      setActing(false);
    }
  };

  const statusIcon = {
    pending: <Clock className="h-4 w-4 text-amber-500" />,
    approved: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    denied: <XCircle className="h-4 w-4 text-red-500" />,
  }[request.status];

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border p-3 transition-colors',
        resolved ? 'bg-muted/30' : 'bg-background hover:bg-muted/20',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {statusIcon}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{request.action}</span>
            {request.agentId && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                {request.agentId}
              </Badge>
            )}
          </div>
          {request.description && (
            <p className="text-xs text-muted-foreground truncate">{request.description}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {new Date(request.requestedAt).toLocaleString()}
          </p>
        </div>
      </div>

      {!resolved && request.status === 'pending' && (
        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950"
            onClick={() => handleAction('approve')}
            disabled={acting}
          >
            {acting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {t('approve')}
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => handleAction('deny')}
            disabled={acting}
          >
            {acting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                {t('deny')}
              </>
            )}
          </Button>
        </div>
      )}

      {resolved && request.resolvedAt && (
        <span className="text-[10px] text-muted-foreground shrink-0 ml-3">
          {new Date(request.resolvedAt).toLocaleString()}
        </span>
      )}
    </div>
  );
}
