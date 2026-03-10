/**
 * Create Agent Dialog — Multi-step Wizard
 * Step 1: Basic info (ID, name, description)
 * Step 2: Model configuration (alias-based)
 * Step 3: SOUL.md editor — the agent's core role definition
 *
 * Based on the recommended OpenClaw multi-agent configuration flow:
 * create → set model → write SOUL.md → test
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useAgentsStore, type CreateAgentInput } from '@/stores/agents';
import { cn } from '@/lib/utils';

interface CreateAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (agentId: string) => void;
}

const TOTAL_STEPS = 3;

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
  const saving = useAgentsStore((s) => s.saving);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    model: '',
    soulMd: DEFAULT_SOUL_TEMPLATE,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setFormData({
      id: '',
      name: '',
      description: '',
      model: '',
      soulMd: DEFAULT_SOUL_TEMPLATE,
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
    { num: 2, icon: Cpu, label: t('agents:wizard.stepModel') },
    { num: 3, icon: FileText, label: t('agents:wizard.stepSoul') },
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
            </div>
          )}

          {/* ── Step 2: Model Configuration ───────────────────── */}
          {step === 2 && (
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

          {/* ── Step 3: SOUL.md Editor ────────────────────────── */}
          {step === 3 && (
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
