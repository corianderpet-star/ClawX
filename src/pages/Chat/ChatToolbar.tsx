/**
 * Chat Toolbar
 * Session selector, new session, refresh, thinking toggle, and agent selector.
 * Rendered in the Header when on the Chat page.
 */
import { RefreshCw, Brain, Bot, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatStore } from '@/stores/chat';
import { useAgentsStore } from '@/stores/agents';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';

export function ChatToolbar() {
  const refresh = useChatStore((s) => s.refresh);
  const loading = useChatStore((s) => s.loading);
  const showThinking = useChatStore((s) => s.showThinking);
  const toggleThinking = useChatStore((s) => s.toggleThinking);
  const switchAgent = useChatStore((s) => s.switchAgent);
  const { t } = useTranslation(['chat', 'agents']);

  const agents = useAgentsStore((s) => s.agents);
  const currentAgentId = useAgentsStore((s) => s.currentAgentId);
  const isMultiAgent = agents.length > 1;

  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!agentMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAgentMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [agentMenuOpen]);

  const currentAgent = agents.find((a) => a.id === currentAgentId);

  return (
    <div className="flex items-center gap-2">
      {/* Agent Selector (only shown when multi-agent) */}
      {isMultiAgent && (
        <div className="relative" ref={menuRef}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs font-medium"
                onClick={() => setAgentMenuOpen(!agentMenuOpen)}
              >
                <Bot className="h-3.5 w-3.5" />
                <span className="max-w-[100px] truncate">{currentAgent?.name || currentAgentId}</span>
                <ChevronDown className={cn('h-3 w-3 transition-transform', agentMenuOpen && 'rotate-180')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('agents:agentSelector')}</p>
            </TooltipContent>
          </Tooltip>

          {agentMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border bg-popover p-1 shadow-md">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    if (agent.id !== currentAgentId) {
                      switchAgent(agent.id);
                    }
                    setAgentMenuOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                    'hover:bg-accent',
                    agent.id === currentAgentId && 'bg-accent/50 font-medium',
                  )}
                >
                  <Bot className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    agent.isMain ? 'text-indigo-500' : 'text-emerald-500',
                  )} />
                  <span className="flex-1 text-left truncate">{agent.name}</span>
                  {agent.id === currentAgentId && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Refresh */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refresh()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('chat:toolbar.refresh')}</p>
        </TooltipContent>
      </Tooltip>

      {/* Thinking Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8',
              showThinking && 'bg-primary/10 text-primary',
            )}
            onClick={toggleThinking}
          >
            <Brain className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{showThinking ? t('chat:toolbar.hideThinking') : t('chat:toolbar.showThinking')}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
