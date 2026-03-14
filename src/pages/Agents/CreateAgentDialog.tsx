/**
 * Create Agent Dialog — Multi-step Wizard
 * Step 1: Basic info (ID, name, description)
 * Step 2: Role & Hierarchy (lead/sub, parent agent, cross-communication)
 * Step 3: Model configuration (alias-based)
 * Step 4: SOUL.md editor — the agent's core role definition
 *
 * Based on the recommended OpenClaw multi-agent configuration flow:
 * create → set role/hierarchy → set model → write SOUL.md → test
 */
import { useState, useCallback, useMemo } from 'react';
import {
  Bot,
  X,
  Loader2,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Cpu,
  FileText,
  CheckCircle2,
  Crown,
  Users,
  Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';
import { useAgentsStore, type CreateAgentInput } from '@/stores/agents';
import { cn } from '@/lib/utils';
import type { AgentRole } from '@/types/agent';

interface CreateAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (agentId: string) => void;
}

const TOTAL_STEPS = 4;

/** Default SOUL.md template for new agents */
const DEFAULT_SOUL_TEMPLATE = `# SOUL.md — Who You Are

## Role

<!-- Describe this agent's role, responsibilities and personality -->
You are a helpful assistant that...

## Core Principles

- Be genuinely helpful, not performatively helpful.
- Have opinions — an assistant with no personality is just a search engine.
- Be resourceful before asking — read the context, search first, then ask.
- Earn trust through competence.

## Boundaries

- Private things stay private.
- When in doubt, ask before acting externally.

## Vibe

Be the assistant you'd actually want to talk to. Concise when needed, thorough when it matters.
`;

export function CreateAgentDialog({ open, onClose, onCreated }: CreateAgentDialogProps) {
  const { t } = useTranslation(['agents', 'common']);
  const createAgent = useAgentsStore((s) => s.createAgent);
  const agents = useAgentsStore((s) => s.agents);
  const saving = useAgentsStore((s) => s.saving);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    model: '',
    soulMd: DEFAULT_SOUL_TEMPLATE,
    // Multi-agent hierarchy fields
    role: '' as '' | AgentRole,
    parentId: '',
    allowCrossComm: false,
    emoji: '',
    requireMention: true,
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Get potential parent agents (only lead agents or main agent)
  const parentAgentOptions = useMemo(() => {
    return agents.filter(a => a.role === 'lead' || a.isMain || (!a.role && !a.parentId));
  }, [agents]);

  const resetForm = useCallback(() => {
    setFormData({
      id: '',
      name: '',
      description: '',
      model: '',
      soulMd: DEFAULT_SOUL_TEMPLATE,
      role: '',
      parentId: '',
      allowCrossComm: false,
      emoji: '',
      requireMention: true,
    });
    setFormError(null);
    setStep(1);
  }, []);

  const handleClose = useCallback(() => {
    if (saving) return;
    resetForm();
    onClose();
  }, [saving, resetForm, onClose]);

  // ── Step validation ────────────────────────────────────────────

  const validateStep1 = useCallback((): boolean => {
    const id = formData.id.trim();
    if (!id) {
      setFormError(t('agents:form.errorIdRequired'));
      return false;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      setFormError(t('agents:form.errorIdInvalid'));
      return false;
    }
    if (id === 'main') {
      setFormError(t('agents:form.errorIdReserved'));
      return false;
    }
    return true;
  }, [formData.id, t]);

  const handleNext = useCallback(() => {
    setFormError(null);
    if (step === 1 && !validateStep1()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, [step, validateStep1]);

  const handleBack = useCallback(() => {
    setFormError(null);
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  // ── Submit (final step) ────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    setFormError(null);

    const input: CreateAgentInput = { id: formData.id.trim() };
    if (formData.name.trim()) input.name = formData.name.trim();
    if (formData.description.trim()) input.description = formData.description.trim();
    if (formData.model.trim()) input.model = formData.model.trim();
    if (formData.soulMd.trim()) input.soulMd = formData.soulMd.trim();
    // Multi-agent hierarchy fields
    if (formData.role) input.role = formData.role;
    if (formData.parentId) input.parentId = formData.parentId;
    if (formData.allowCrossComm) input.allowCrossComm = true;
    if (formData.emoji.trim()) input.emoji = formData.emoji.trim();
    if (formData.role === 'sub') input.requireMention = formData.requireMention;

    const success = await createAgent(input);
    if (success) {
      const agentId = input.id;
      resetForm();
      onClose();
      onCreated?.(agentId);
    }
  }, [formData, createAgent, resetForm, onClose, onCreated]);

  // ── Step indicator data ────────────────────────────────────────

  const steps = useMemo(() => [
    { num: 1, icon: Bot, label: t('agents:wizard.stepBasic') },
    { num: 2, icon: Users, label: t('agents:wizard.stepHierarchy', '角色层级') },
    { num: 3, icon: Cpu, label: t('agents:wizard.stepModel') },
    { num: 4, icon: FileText, label: t('agents:wizard.stepSoul') },
  ], [t]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl mx-4 rounded-xl border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold">{t('agents:form.title')}</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 px-6 py-3 border-b shrink-0">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />}
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                  step === s.num
                    ? 'bg-primary/10 text-primary'
                    : step > s.num
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground/50',
                )}
              >
                {step > s.num ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <s.icon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ── Step 1: Basic Info ─────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-2">{t('agents:wizard.basicDesc')}</p>

              {/* Agent ID */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="agent-id">
                  {t('agents:form.id')} <span className="text-destructive">*</span>
                </label>
                <input
                  id="agent-id"
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder={t('agents:form.idPlaceholder')}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  disabled={saving}
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">{t('agents:form.idHint')}</p>
              </div>

              {/* Agent Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="agent-name">
                  {t('agents:form.name')}
                </label>
                <input
                  id="agent-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('agents:form.namePlaceholder')}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  disabled={saving}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="agent-desc">
                  {t('agents:form.description')}
                </label>
                <textarea
                  id="agent-desc"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('agents:form.descriptionPlaceholder')}
                  rows={3}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  disabled={saving}
                />
              </div>

              {/* Emoji */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="agent-emoji">
                  {t('agents:form.emoji', 'Emoji 图标')}
                </label>
                <input
                  id="agent-emoji"
                  type="text"
                  value={formData.emoji}
                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                  placeholder={t('agents:form.emojiPlaceholder', '例如 🦞 📊 🎨 💻')}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  disabled={saving}
                  maxLength={4}
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Role & Hierarchy ──────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground mb-2">
                {t('agents:wizard.hierarchyDesc', '设置此智能体在组织架构中的角色和层级关系。')}
              </p>

              {/* Role Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t('agents:form.role', '角色')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all hover:shadow-sm',
                      formData.role === 'lead'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                        : 'border-muted hover:border-muted-foreground/30',
                    )}
                    onClick={() => setFormData({ ...formData, role: 'lead', parentId: '' })}
                  >
                    <Crown className={cn('h-6 w-6', formData.role === 'lead' ? 'text-amber-600' : 'text-muted-foreground')} />
                    <div className="text-center">
                      <p className="text-sm font-medium">{t('agents:form.roleLead', '主管 (Lead)')}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t('agents:form.roleLeadDesc', '调度中枢，分发任务给下属智能体')}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all hover:shadow-sm',
                      formData.role === 'sub'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : 'border-muted hover:border-muted-foreground/30',
                    )}
                    onClick={() => setFormData({ ...formData, role: 'sub' })}
                  >
                    <Bot className={cn('h-6 w-6', formData.role === 'sub' ? 'text-blue-600' : 'text-muted-foreground')} />
                    <div className="text-center">
                      <p className="text-sm font-medium">{t('agents:form.roleSub', '执行 (Sub)')}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t('agents:form.roleSubDesc', '专注特定任务，由主管调度指挥')}
                      </p>
                    </div>
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t('agents:form.roleHint', '不选择则为独立智能体，不参与层级协作。')}
                </p>
              </div>

              {/* Parent Agent (only for sub agents) */}
              {formData.role === 'sub' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="agent-parent">
                    {t('agents:form.parentAgent', '上级智能体')} <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="agent-parent"
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    disabled={saving}
                  >
                    <option value="">{t('agents:form.selectParent', '选择上级智能体...')}</option>
                    {parentAgentOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.identity?.emoji ? `${a.identity.emoji} ` : ''}{a.name} ({a.id})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    {t('agents:form.parentHint', '此智能体将作为所选上级智能体的下属。')}
                  </p>
                </div>
              )}

              {/* Require Mention (for sub agents) */}
              {formData.role === 'sub' && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{t('agents:form.requireMention', '需要 @提及')}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t('agents:form.requireMentionDesc', '在频道中只有被 @提及 时才会响应（推荐子智能体开启）')}
                    </p>
                  </div>
                  <Switch
                    checked={formData.requireMention}
                    onCheckedChange={(v) => setFormData({ ...formData, requireMention: v })}
                  />
                </div>
              )}

              {/* Cross-Agent Communication */}
              {formData.role === 'lead' && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      <Network className="h-3.5 w-3.5 inline mr-1.5" />
                      {t('agents:form.crossComm', '跨 Agent 通信')}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t('agents:form.crossCommDesc', '允许下属智能体之间互相通信和协作')}
                    </p>
                  </div>
                  <Switch
                    checked={formData.allowCrossComm}
                    onCheckedChange={(v) => setFormData({ ...formData, allowCrossComm: v })}
                  />
                </div>
              )}

              {/* Architecture preview */}
              {formData.role && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium mb-2">{t('agents:wizard.architecturePreview', '架构预览')}</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {formData.role === 'lead' && (
                      <>
                        <p>🏢 {formData.name || formData.id || '...'} <span className="text-amber-600 font-medium">[主管]</span></p>
                        <p className="pl-4">├── 下属智能体将自动关联到此主管</p>
                        {formData.allowCrossComm && <p className="pl-4">└── ✅ 下属间可互相通信</p>}
                      </>
                    )}
                    {formData.role === 'sub' && formData.parentId && (
                      <>
                        <p>🏢 {parentAgentOptions.find(a => a.id === formData.parentId)?.name || formData.parentId} <span className="text-amber-600 font-medium">[主管]</span></p>
                        <p className="pl-4">└── {formData.emoji || '🤖'} {formData.name || formData.id || '...'} <span className="text-blue-600 font-medium">[执行]</span></p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Model Configuration ───────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-2">{t('agents:wizard.modelDesc')}</p>

              {/* Model input */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="agent-model">
                  {t('agents:form.model')}
                </label>
                <input
                  id="agent-model"
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder={t('agents:form.modelPlaceholder')}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  disabled={saving}
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">{t('agents:form.modelHint')}</p>
              </div>

              {/* Model alias examples */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium mb-2">{t('agents:wizard.modelExamples')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'anthropic/claude-sonnet-4-5',
                    'openai/gpt-4.1',
                    'google/gemini-2.5-pro',
                    'deepseek/deepseek-chat',
                  ].map((alias) => (
                    <button
                      key={alias}
                      type="button"
                      className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                      onClick={() => setFormData({ ...formData, model: alias })}
                    >
                      {alias}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">{t('agents:wizard.modelAliasHint')}</p>
              </div>
            </div>
          )}

          {/* ── Step 4: SOUL.md Editor ────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('agents:wizard.soulDesc')}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{t('agents:wizard.soulHint')}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="agent-soul">
                  SOUL.md
                </label>
                <textarea
                  id="agent-soul"
                  value={formData.soulMd}
                  onChange={(e) => setFormData({ ...formData, soulMd: e.target.value })}
                  rows={14}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
                  disabled={saving}
                  autoFocus
                  spellCheck={false}
                />
              </div>

              {/* Quick template button */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setFormData({ ...formData, soulMd: DEFAULT_SOUL_TEMPLATE })}
                >
                  {t('agents:wizard.resetTemplate')}
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {formError && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 mt-4">
              <p className="text-xs text-destructive">{formError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t shrink-0">
          <div>
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={handleBack} disabled={saving}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                {t('agents:wizard.back')}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={saving}>
              {t('common:actions.cancel')}
            </Button>
            {step < TOTAL_STEPS ? (
              <Button size="sm" onClick={handleNext}>
                {t('agents:wizard.next')}
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleSubmit} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    {t('agents:form.creating')}
                  </>
                ) : (
                  <>
                    <Bot className="h-3.5 w-3.5 mr-1.5" />
                    {t('agents:form.create')}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
