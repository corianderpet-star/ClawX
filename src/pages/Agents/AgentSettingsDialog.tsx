/**
 * Agent Settings Dialog
 * Modal for editing agent name, model, description, tool permissions,
 * skills management, and channel bindings.
 * Uses Tabs for organised sections: General | Tools | Skills | Channels.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, Loader2, Save, Settings, Plus, Trash2, Unplug, Plug,
  Shield, Wrench, ZapOff, Info, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ModelIdCombobox } from '@/components/ModelIdCombobox';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAgentsStore } from '@/stores/agents';
import { useChannelsStore } from '@/stores/channels';
import { useSkillsStore } from '@/stores/skills';
import { CHANNEL_ICONS, CHANNEL_NAMES } from '@/types/channel';
import type { Agent } from '@/types/agent';
import type { ChannelType } from '@/types/channel';

interface AgentSettingsDialogProps {
  open: boolean;
  agent: Agent | null;
  onClose: () => void;
}

/** Tool profile options matching OpenClaw supported profiles */
const TOOL_PROFILES = ['default', 'full', 'coding', 'minimal', 'messaging', 'none'] as const;

export function AgentSettingsDialog({ open, agent, onClose }: AgentSettingsDialogProps) {
  const { t } = useTranslation(['agents', 'common']);
  const renameAgent = useAgentsStore((s) => s.renameAgent);
  const updateAgent = useAgentsStore((s) => s.updateAgent);
  const saving = useAgentsStore((s) => s.saving);

  const channels = useChannelsStore((s) => s.channels);
  const bindings = useChannelsStore((s) => s.bindings);
  const fetchBindings = useChannelsStore((s) => s.fetchBindings);
  const fetchChannels = useChannelsStore((s) => s.fetchChannels);
  const setBinding = useChannelsStore((s) => s.setBinding);

  const skills = useSkillsStore((s) => s.skills);
  const fetchSkills = useSkillsStore((s) => s.fetchSkills);

  const navigate = useNavigate();

  // ── Form state ─────────────────────────────────────────────────
  const [agentName, setAgentName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('');
  const [model, setModel] = useState('');
  const [toolProfile, setToolProfile] = useState('default');
  const [toolAllow, setToolAllow] = useState('');
  const [toolDeny, setToolDeny] = useState('');
  /** Per-agent skill allowlist: undefined = all skills enabled, string[] = custom allowlist */
  const [agentSkills, setAgentSkills] = useState<string[] | undefined>(undefined);

  // ── UI state ───────────────────────────────────────────────────
  const [renameSaving, setRenameSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [renameSuccess, setRenameSuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChannelPicker, setShowChannelPicker] = useState(false);

  const agentId = agent?.id || '';

  // ── Initialise form when dialog opens ──────────────────────────
  useEffect(() => {
    if (!open || !agent) return;
    setAgentName(agent.name);
    setOriginalName(agent.name);
    setDescription(agent.description || '');
    setEmoji(agent.identity?.emoji || '');
    setModel(agent.model || '');

    // Parse tools config from agent.config or Agent type
    const cfg = agent.config as Record<string, unknown> | undefined;
    const tools = cfg?.tools as { profile?: string; allow?: string[]; deny?: string[] } | undefined;
    setToolProfile(tools?.profile || 'default');
    setToolAllow(tools?.allow?.join('\n') || '');
    setToolDeny(tools?.deny?.join('\n') || '');
    setAgentSkills(agent.skills);

    setError(null);
    setRenameSuccess(false);
    setSaveSuccess(false);
    setShowChannelPicker(false);
    fetchBindings();
    fetchChannels();
    fetchSkills();
  }, [open, agent, fetchBindings, fetchChannels, fetchSkills]);

  // ── Derived data ───────────────────────────────────────────────

  // Channels bound to this agent
  const boundChannels = useMemo(() => {
    if (!agentId) return [];
    return bindings
      .filter((b) => b.agentId === agentId)
      .map((b) => {
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

  // Available channels not yet bound to this agent
  const availableChannels = useMemo(() => {
    return channels.filter((ch) => {
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

  // ── Handlers ───────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    if (saving || renameSaving || settingsSaving) return;
    setShowChannelPicker(false);
    onClose();
  }, [saving, renameSaving, settingsSaving, onClose]);

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

  /** Save all settings (model, description, tools, emoji) via updateAgent */
  const handleSaveSettings = useCallback(async () => {
    if (!agentId) return;
    setSettingsSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const allowList = toolAllow.split('\n').map((s) => s.trim()).filter(Boolean);
      const denyList = toolDeny.split('\n').map((s) => s.trim()).filter(Boolean);

      const ok = await updateAgent({
        agentId,
        description: description.trim(),
        model: model.trim() || undefined,
        emoji: emoji.trim() || undefined,
        tools: {
          profile: toolProfile === 'default' ? undefined : toolProfile,
          allow: allowList.length > 0 ? allowList : undefined,
          deny: denyList.length > 0 ? denyList : undefined,
        },
        skills: agentSkills === undefined ? null : agentSkills,
      });

      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSettingsSaving(false);
    }
  }, [agentId, description, model, emoji, toolProfile, toolAllow, toolDeny, agentSkills, updateAgent]);

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

  /** Toggle a skill for this specific agent (per-agent allowlist) */
  const handleToggleAgentSkill = useCallback(
    (skillId: string, checked: boolean) => {
      setAgentSkills((prev) => {
        if (checked) {
          // Enabling: add to allowlist
          if (prev === undefined) return prev; // already all enabled
          const next = [...prev, skillId];
          // If all skills are now included, revert to "all enabled"
          const allSkillIds = skills.map((s) => s.id);
          if (allSkillIds.every((id) => next.includes(id))) return undefined;
          return next;
        } else {
          // Disabling: create allowlist from all IDs minus this one
          if (prev === undefined) {
            return skills.map((s) => s.id).filter((id) => id !== skillId);
          }
          return prev.filter((id) => id !== skillId);
        }
      });
    },
    [skills],
  );

  if (!open || !agent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Dialog — frosted glass */}
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl border border-white/20 dark:border-white/10 bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl shadow-[0_8px_60px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_8px_60px_-12px_rgba(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-primary shadow-lg shadow-primary/20 text-white">
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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose} disabled={saving || renameSaving || settingsSaving}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body — Tabbed */}
        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-3 shrink-0 bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/30 dark:border-white/10 rounded-lg">
            <TabsTrigger value="general" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              {t('agents:settings.tabGeneral')}
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              {t('agents:settings.tabTools')}
            </TabsTrigger>
            <TabsTrigger value="skills" className="gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              {t('agents:settings.tabSkills')}
            </TabsTrigger>
            <TabsTrigger value="channels" className="gap-1.5">
              <Plug className="h-3.5 w-3.5" />
              {t('agents:settings.tabChannels')}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: General ─────────────────────────────────── */}
          <TabsContent value="general" className="flex-1 overflow-y-auto px-6 py-5 space-y-5 mt-0">
            {/* Agent Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('agents:settings.agentName')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder={t('agents:settings.agentNamePlaceholder')}
                  className="flex-1 rounded-lg border border-white/30 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
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

            {/* Agent ID (read-only) */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('agents:settings.agentId')}</label>
              <p className="text-sm font-mono bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 rounded-lg px-3 py-1.5 truncate">{agent.id}</p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('agents:settings.description')}</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('agents:settings.descriptionPlaceholder')}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            {/* Emoji */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('agents:settings.emoji')}</label>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder={t('agents:settings.emojiPlaceholder')}
                className="w-full rounded-lg border border-white/30 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
              />
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('agents:settings.modelLabel')}</label>
              <ModelIdCombobox
                value={model}
                onChange={setModel}
                placeholder={t('agents:settings.modelPlaceholder')}
                providerType={agent.provider || undefined}
              />
              <p className="text-xs text-muted-foreground">{t('agents:settings.modelHint')}</p>
            </div>
          </TabsContent>

          {/* ── Tab: Tools & Permissions ─────────────────────── */}
          <TabsContent value="tools" className="flex-1 overflow-y-auto px-6 py-5 space-y-5 mt-0">
            {/* Tool Profile */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('agents:settings.toolProfile')}</label>
              <Select
                value={toolProfile}
                onChange={(e) => setToolProfile(e.target.value)}
                className="w-full"
              >
                {TOOL_PROFILES.map((profile) => (
                  <option key={profile} value={profile}>
                    {t(`agents:settings.profile${profile.charAt(0).toUpperCase()}${profile.slice(1)}`)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">{t('agents:settings.toolProfileHint')}</p>
            </div>

            {/* Allow List */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('agents:settings.toolAllow')}</label>
              <Textarea
                value={toolAllow}
                onChange={(e) => setToolAllow(e.target.value)}
                placeholder={t('agents:settings.toolAllowPlaceholder')}
                rows={3}
                className="resize-none text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">{t('agents:settings.toolAllowHint')}</p>
            </div>

            {/* Deny List */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('agents:settings.toolDeny')}</label>
              <Textarea
                value={toolDeny}
                onChange={(e) => setToolDeny(e.target.value)}
                placeholder={t('agents:settings.toolDenyPlaceholder')}
                rows={3}
                className="resize-none text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">{t('agents:settings.toolDenyHint')}</p>
            </div>
          </TabsContent>

          {/* ── Tab: Skills ──────────────────────────────────── */}
          <TabsContent value="skills" className="flex-1 overflow-y-auto px-6 py-5 space-y-4 mt-0">
            <div>
              <h3 className="text-sm font-semibold">{t('agents:settings.skillsTitle')}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t('agents:settings.skillsHint')}</p>
            </div>

            {/* Per-agent allowlist info banner */}
            <div className="rounded-xl border border-blue-300/40 dark:border-blue-500/20 bg-blue-100/30 dark:bg-blue-900/15 backdrop-blur-sm px-3 py-2.5 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  {agentSkills === undefined
                    ? t('agents:settings.skillsAllEnabled')
                    : t('agents:settings.skillsCustomAllowlist', { count: agentSkills.length })}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {agentSkills !== undefined && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2.5 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                    onClick={() => setAgentSkills(undefined)}
                  >
                    {t('agents:settings.skillsResetAll')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] px-2.5 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  onClick={() => { onClose(); navigate('/skills'); }}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  {t('agents:settings.goToSkills')}
                </Button>
              </div>
            </div>

            {skills.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/30 dark:border-white/10 bg-white/20 dark:bg-white/5 backdrop-blur-sm p-6 text-center">
                <Wrench className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('agents:settings.noSkills')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('agents:settings.noSkillsDesc')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {skills.map((skill) => {
                  const isEnabledForAgent = agentSkills === undefined || agentSkills.includes(skill.id);
                  return (
                    <div
                      key={skill.id}
                      className="flex items-center gap-3 rounded-xl border border-white/25 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-sm px-3 py-2.5 group hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-150"
                    >
                      <span className="text-base shrink-0">{skill.icon || '📦'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{skill.name}</span>
                          {skill.isCore ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                              {t('agents:settings.skillCore')}
                            </Badge>
                          ) : skill.isBundled ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 text-blue-600 dark:text-blue-400">
                              {t('agents:settings.skillBuiltIn')}
                            </Badge>
                          ) : null}
                          {skill.version && (
                            <span className="text-[10px] text-muted-foreground">v{skill.version}</span>
                          )}
                        </div>
                        {skill.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{skill.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!skill.enabled && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                            <ZapOff className="h-2.5 w-2.5 mr-0.5" />
                            {t('agents:settings.skillGlobalOff')}
                          </Badge>
                        )}
                        <Switch
                          checked={isEnabledForAgent}
                          onCheckedChange={(checked) => handleToggleAgentSkill(skill.id, checked)}
                          disabled={!skill.enabled}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Channels ────────────────────────────────── */}
          <TabsContent value="channels" className="flex-1 overflow-y-auto px-6 py-5 space-y-4 mt-0">
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

            {/* Channel Picker */}
            {showChannelPicker && (
              <div className="rounded-xl border border-white/25 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-md p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
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
              <div className="rounded-xl border border-dashed border-white/30 dark:border-white/10 bg-white/20 dark:bg-white/5 backdrop-blur-sm p-6 text-center">
                <Unplug className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('agents:settings.noChannels')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('agents:settings.noChannelsDesc')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {boundChannels.map((ch) => (
                  <div
                    key={`${ch.channelType}-${ch.accountId || 'default'}`}
                    className="flex items-center gap-2.5 rounded-xl border border-white/25 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-sm px-3 py-2.5 group hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-150"
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
          </TabsContent>
        </Tabs>

        {/* Error / Success messages */}
        {(error || renameSuccess || saveSuccess) && (
          <div className="px-6 pb-2 space-y-1.5">
            {error && (
              <div className="rounded-lg border border-red-300/30 dark:border-red-500/20 bg-red-100/30 dark:bg-red-900/15 backdrop-blur-sm px-3 py-2">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}
            {renameSuccess && (
              <div className="rounded-lg border border-emerald-300/30 dark:border-emerald-500/20 bg-emerald-100/30 dark:bg-emerald-900/15 backdrop-blur-sm px-3 py-2">
                <p className="text-xs text-emerald-700 dark:text-emerald-400">{t('agents:settings.renameSuccess')}</p>
              </div>
            )}
            {saveSuccess && (
              <div className="rounded-lg border border-emerald-300/30 dark:border-emerald-500/20 bg-emerald-100/30 dark:bg-emerald-900/15 backdrop-blur-sm px-3 py-2">
                <p className="text-xs text-emerald-700 dark:text-emerald-400">{t('agents:settings.saveSuccess')}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/30 dark:border-white/10 shrink-0">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={saving || renameSaving || settingsSaving}>
            {t('common:actions.close')}
          </Button>
          <Button
            size="sm"
            onClick={handleSaveSettings}
            disabled={settingsSaving || renameSaving}
          >
            {settingsSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                {t('agents:settings.saving')}
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1" />
                {t('agents:settings.save')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
