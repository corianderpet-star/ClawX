/**
 * Agents Page
 * View and manage multiple AI agents.
 * Lists all available agents from the OpenClaw Gateway and allows
 * switching between them or starting new conversations.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, MessageSquare, Sparkles, ArrowRight, RefreshCw, AlertCircle, Plus, Trash2, FileText, FolderOpen } from 'lucide-react';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { CreateAgentDialog } from './CreateAgentDialog';
import { EditSoulDialog } from './EditSoulDialog';

export function Agents() {
  const { t } = useTranslation(['common', 'agents']);
  const navigate = useNavigate();

  const gatewayStatus = useGatewayStore((s) => s.status);
  const isGatewayRunning = gatewayStatus.state === 'running';

  const agents = useAgentsStore((s) => s.agents);
  const currentAgentId = useAgentsStore((s) => s.currentAgentId);
  const loading = useAgentsStore((s) => s.loading);
  const saving = useAgentsStore((s) => s.saving);
  const error = useAgentsStore((s) => s.error);
  const loadAgents = useAgentsStore((s) => s.loadAgents);
  const deleteAgent = useAgentsStore((s) => s.deleteAgent);
  const isMultiAgent = useAgentsStore((s) => s.isMultiAgent());

  const switchAgent = useChatStore((s) => s.switchAgent);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [soulEditAgent, setSoulEditAgent] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (isGatewayRunning) {
      loadAgents();
    }
  }, [isGatewayRunning, loadAgents]);

  const handleChatWithAgent = (agentId: string) => {
    switchAgent(agentId);
    navigate('/');
  };

  if (!isGatewayRunning) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center text-center p-8">
        <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('common:gateway.notRunning')}</h2>
        <p className="text-muted-foreground max-w-md">
          {t('common:gateway.notRunningDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('agents:title', 'Agents')}</h1>
          <p className="text-muted-foreground mt-1">
            {isMultiAgent
              ? t('agents:subtitleMulti', 'Manage and collaborate with multiple AI agents')
              : t('agents:subtitleSingle', 'Your AI agent is ready')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAgents()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            {t('common:actions.refresh')}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            disabled={saving}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('agents:createAgent')}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && agents.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Agent Grid */}
      {agents.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={cn(
                'group relative rounded-xl border bg-card p-5 transition-all hover:shadow-md',
                currentAgentId === agent.id && 'ring-2 ring-primary/50 border-primary/30',
              )}
            >
              {/* Agent Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  agent.isMain
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
                )}>
                  {agent.isMain ? (
                    <Sparkles className="h-5 w-5" />
                  ) : (
                    <Bot className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm truncate">{agent.name}</h3>
                    {agent.isMain && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {t('agents:mainBadge', 'Main')}
                      </Badge>
                    )}
                    {currentAgentId === agent.id && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">
                        {t('agents:activeBadge', 'Active')}
                      </Badge>
                    )}
                  </div>
                  {agent.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {agent.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Agent Details */}
              <div className="space-y-1.5 mb-4">
                {agent.model && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">{t('agents:model', 'Model')}:</span>
                    <span className="truncate">{agent.model}</span>
                  </div>
                )}
                {agent.provider && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">{t('agents:provider', 'Provider')}:</span>
                    <span className="truncate">{agent.provider}</span>
                  </div>
                )}
                {agent.skills && agent.skills.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">{t('agents:skills', 'Skills')}:</span>
                    <span>{agent.skills.length}</span>
                  </div>
                )}
                {typeof agent.config?.workspace === 'string' && agent.config.workspace && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FolderOpen className="h-3 w-3 shrink-0" />
                    <span className="truncate" title={agent.config.workspace}>{agent.config.workspace}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={currentAgentId === agent.id ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => handleChatWithAgent(agent.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  {currentAgentId === agent.id
                    ? t('agents:continueChat', 'Continue Chat')
                    : t('agents:startChat', 'Chat')}
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="px-2 text-muted-foreground hover:text-violet-600"
                  title={t('agents:soul.editTitle')}
                  onClick={() => setSoulEditAgent({ id: agent.id, name: agent.name })}
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
                {!agent.isMain && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-muted-foreground hover:text-destructive"
                    onClick={() => setAgentToDelete({ id: agent.id, name: agent.name })}
                    disabled={saving}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && agents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bot className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-2">{t('agents:noAgents', 'No agents found')}</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-4">
            {t('agents:noAgentsDesc', 'Configure agents in your OpenClaw configuration to enable multi-agent collaboration.')}
          </p>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('agents:createAgent')}
          </Button>
        </div>
      )}

      {/* Create Agent Dialog */}
      <CreateAgentDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />

      {/* Delete Agent Confirmation */}
      <ConfirmDialog
        open={!!agentToDelete}
        title={t('agents:deleteConfirmTitle')}
        message={t('agents:deleteConfirmDesc', { name: agentToDelete?.name || agentToDelete?.id })}
        confirmLabel={t('common:actions.delete')}
        onConfirm={async () => {
          if (agentToDelete) {
            await deleteAgent(agentToDelete.id, false);
            setAgentToDelete(null);
          }
        }}
        onCancel={() => setAgentToDelete(null)}
        variant="destructive"
      />

      {/* Edit Soul Dialog */}
      <EditSoulDialog
        open={!!soulEditAgent}
        agentId={soulEditAgent?.id || ''}
        agentName={soulEditAgent?.name || ''}
        onClose={() => setSoulEditAgent(null)}
      />
    </div>
  );
}

export default Agents;
