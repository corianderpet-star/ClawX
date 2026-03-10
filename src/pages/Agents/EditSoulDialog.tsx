/**
 * Edit Soul Dialog
 * Modal for editing an existing agent's SOUL.md file.
 * Loads current content via IPC, provides a textarea editor, and saves back.
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Save, FileText, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useAgentsStore } from '@/stores/agents';

interface EditSoulDialogProps {
  open: boolean;
  agentId: string;
  agentName: string;
  onClose: () => void;
}

export function EditSoulDialog({ open, agentId, agentName, onClose }: EditSoulDialogProps) {
  const { t } = useTranslation(['agents', 'common']);
  const readSoul = useAgentsStore((s) => s.readSoul);
  const writeSoul = useAgentsStore((s) => s.writeSoul);
  const saving = useAgentsStore((s) => s.saving);

  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const hasChanges = content !== originalContent;

  // Load SOUL.md content when dialog opens
  useEffect(() => {
    if (!open || !agentId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setSaveSuccess(false);
      try {
        const soulContent = await readSoul(agentId);
        if (!cancelled) {
          setContent(soulContent);
          setOriginalContent(soulContent);
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [open, agentId, readSoul]);

  const handleClose = useCallback(() => {
    if (saving) return;
    onClose();
  }, [saving, onClose]);

  const handleSave = useCallback(async () => {
    setError(null);
    setSaveSuccess(false);
    try {
      await writeSoul(agentId, content);
      setOriginalContent(content);
      setSaveSuccess(true);
      // Auto-dismiss success indicator
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(String(err));
    }
  }, [agentId, content, writeSoul]);

  const handleRevert = useCallback(() => {
    setContent(originalContent);
    setError(null);
  }, [originalContent]);

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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{t('agents:soul.editTitle')}</h2>
              <p className="text-xs text-muted-foreground">{agentName} ({agentId})</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-sm text-muted-foreground mb-3">{t('agents:soul.editDesc')}</p>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
              disabled={saving}
              spellCheck={false}
            />
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 mt-3">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Success */}
          {saveSuccess && (
            <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 mt-3">
              <p className="text-xs text-emerald-700 dark:text-emerald-400">{t('agents:soul.saveSuccess')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t shrink-0">
          <div>
            {hasChanges && (
              <Button variant="ghost" size="sm" onClick={handleRevert} disabled={saving || loading}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                {t('agents:soul.revert')}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={saving}>
              {t('common:actions.close')}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || loading || !hasChanges}>
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  {t('agents:soul.saving')}
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {t('agents:soul.save')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
