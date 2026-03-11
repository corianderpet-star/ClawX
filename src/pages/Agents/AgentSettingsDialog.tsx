/**
 * Agent Settings Dialog
 * Modal for editing agent name and managing channel bindings.
 * Design mirrors the project's existing dialog patterns (EditSoulDialog).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Loader2, Save, Settings, Plus, Trash2, Unplug, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { useAgentsStore } from '@/stores/agents';
import { useChannelsStore } from '@/stores/channels';
import { CHANNEL_ICONS, CHANNEL_NAMES } from '@/types/channel';
import type { Agent } from '@/types/agent';
import type { ChannelType } from '@/types/channel';

interface AgentSettingsDialogProps {
  open: boolean;
  agent: Agent | null;
  onClose: () => void;
}

export function AgentSettingsDialog({ open, agent, onClose }: AgentSettingsDialogProps) {
  const { t } = useTranslation(['agents', 'common']);
  const renameAgent = useAgentsStore((s) => s.renameAgent);
  const saving = useAgentsStore((s) => s.saving);

  const channels = useChannelsStore((s) => s.channels);
  const bindings = useChannelsStore((s) => s.bindings);
  const fetchBindings = useChannelsStore((s) => s.fetchBindings);
  const fetchChannels = useChannelsStore((s) => s.fetchChannels);
  const setBinding = useChannelsStore((s) => s.setBinding);

  const [agentName, setAgentName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameSuccess, setRenameSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChannelPicker, setShowChannelPicker] = useState(false);

  const agentId = agent?.id || '';

  // Load data when dialog opens
  useEffect(() => {
    if (!open || !agent) return;
    setAgentName(agent.name);
    setOriginalName(agent.name);
    setError(null);
    setRenameSuccess(false);
    setShowChannelPicker(false);
    fetchBindings();
    fetchChannels();
  }, [open, agent, fetchBindings, fetchChannels]);

  // Channels bound to this agent
  const boundChannels = useMemo(() => {
    if (!agentId) return [];
    return bindings
      .filter((b) => b.agentId === agentId)
      .map((b) => {
        // Find the matching channel from live channel data
        const matchedChannel = channels.find((ch) => {
          if (ch.type !== b.channelType) return false;
          if (b.accountId) return ch.accountId === b.accountId;
          return true;
        });
        return {
          channelType: b.channelType as ChannelType,
          accountId: b.accountId,
          name: matchedChannel?.name || b.accountId || CHANNEL_NAMES[b.channelType as ChannelType] || b.channelType,
          status: matchedChannel?.status || 'disconnected',
          icon: CHANNEL_ICONS[b.channelType as ChannelType] || '💬',
        };
      });
  }, [agentId, bindings, channels]);

  // Available channels not yet bound to this agent (for the picker)
  const availableChannels = useMemo(() => {
    return channels.filter((ch) => {
      // Check if already bound to this agent
      const alreadyBound = bindings.some(
        (b) =>
          b.agentId === agentId &&
          b.channelType === ch.type &&
          (b.accountId ? b.accountId === ch.accountId : true),
      );
      return !alreadyBound;
    });
  }, [channels, bindings, agentId]);

  const hasNameChange = agentName.trim() !== originalName;

  const handleClose = useCallback(() => {
    if (saving || renameSaving) return;
    setShowChannelPicker(false);
    onClose();
  }, [saving, renameSaving, onClose]);

  const handleRename = useCallback(async () => {
    if (!agentId || !hasNameChange) return;
    setRenameSaving(true);
    setError(null);
    setRenameSuccess(false);
    try {
      const ok = await renameAgent(agentId, agentName.trim());
      if (ok) {
        setOriginalName(agentName.trim());
        setRenameSuccess(true);
        setTimeout(() => setRenameSuccess(false), 2000);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setRenameSaving(false);
    }
  }, [agentId, agentName, hasNameChange, renameAgent]);

  const handleAddChannel = useCallback(
    async (channelType: string, accountId?: string) => {
      setError(null);
      try {
        await setBinding(channelType, agentId, accountId);
        setShowChannelPicker(false);
      } catch (err) {
        setError(String(err));
      }
    },
    [agentId, setBinding],
  );

  const handleRemoveChannel = useCallback(
    async (channelType: string, accountId?: string) => {
      setError(null);
      try {
        await setBinding(channelType, null, accountId);
      } catch (err) {
        setError(String(err));
      }
    },
    [setBinding],
  );

  if (!open || !agent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 rounded-xl border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 text-white">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {t('agents:settings.title', { name: agent.name })}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t('agents:settings.desc')}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose} disabled={saving || renameSaving}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Agent Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('agents:settings.agentName')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder={t('agents:settings.agentNamePlaceholder')}
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                disabled={renameSaving}
              />
              {hasNameChange && (
                <Button size="sm" onClick={handleRename} disabled={renameSaving || !agentName.trim()}>
                  {renameSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Agent ID + Model (read-only) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('agents:settings.agentId')}</label>
              <p className="text-sm font-mono bg-muted/50 rounded-md px-3 py-1.5 truncate">{agent.id}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('agents:settings.modelLabel')}</label>
              <p className="text-sm bg-muted/50 rounded-md px-3 py-1.5 truncate">
                {agent.model || (
                  <span className="text-muted-foreground italic">
                    {t('agents:settings.modelInherits')}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Channels Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('agents:settings.channelsSection')}</h3>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setShowChannelPicker(!showChannelPicker)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {t('agents:settings.addChannel')}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('agents:settings.channelsNote')}
            </p>

            {/* Channel Picker (dropdown) */}
            {showChannelPicker && (
              <div className="rounded-lg border bg-muted/30 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                {availableChannels.length === 0 ? (
                  <div className="text-center py-3">
                    <p className="text-xs text-muted-foreground">
                      {t('agents:settings.noAvailableChannels')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('agents:settings.noAvailableChannelsDesc')}
                    </p>
                  </div>
                ) : (
                  availableChannels.map((ch) => (
                    <button
                      key={ch.id}
                      className="flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                      onClick={() => handleAddChannel(ch.type, ch.accountId)}
                    >
                      <span className="text-base">{CHANNEL_ICONS[ch.type] || '💬'}</span>
                      <span className="flex-1 truncate">{ch.name}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                        {CHANNEL_NAMES[ch.type] || ch.type}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Bound Channel List */}
            {boundChannels.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
                <Unplug className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('agents:settings.noChannels')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('agents:settings.noChannelsDesc')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {boundChannels.map((ch) => (
                  <div
                    key={`${ch.channelType}-${ch.accountId || 'default'}`}
                    className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 group"
                  >
                    <span className="text-base shrink-0">{ch.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{ch.name}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                          {CHANNEL_NAMES[ch.channelType] || ch.channelType}
                        </Badge>
                      </div>
                    </div>
                    {ch.status === 'connected' ? (
                      <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 shrink-0">
                        <Plug className="h-2.5 w-2.5 mr-0.5" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 text-muted-foreground">
                        {ch.status === 'connecting' ? 'Connecting...' : ch.status === 'error' ? 'Error' : 'Disconnected'}
                      </Badge>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                      onClick={() => handleRemoveChannel(ch.channelType, ch.accountId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Rename success */}
          {renameSuccess && (
            <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
              <p className="text-xs text-emerald-700 dark:text-emerald-400">{t('agents:settings.renameSuccess')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t shrink-0">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={saving || renameSaving}>
            {t('common:actions.close')}
          </Button>
        </div>
      </div>
    </div>
  );
}
