/**
 * Agent Org Chart — Tree Visualization
 * Renders agents in a company-style org-chart hierarchy with
 * connection lines between parent and child agents.
 */
import { useMemo, useState } from 'react';
import {
  Bot,
  MessageSquare,
  ArrowRight,
  Trash2,
  FileText,
  Crown,
  Users,
  ChevronDown,
  ChevronRight,
  Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { Agent, AgentTreeNode } from '@/types/agent';

// ── Tree builder ─────────────────────────────────────────────────

export function buildAgentTree(agents: Agent[]): AgentTreeNode[] {
  const map = new Map<string, AgentTreeNode>();

  // Create nodes
  for (const a of agents) {
    map.set(a.id, { ...a, children: [], depth: 0 });
  }

  const roots: AgentTreeNode[] = [];

  // Link parent → children
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      const parent = map.get(node.parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Calculate depth
  const setDepth = (node: AgentTreeNode, depth: number) => {
    node.depth = depth;
    for (const child of node.children) {
      setDepth(child, depth + 1);
    }
  };
  for (const root of roots) {
    setDepth(root, 0);
  }

  return roots;
}

// ── Connector Lines ──────────────────────────────────────────────

function VerticalLine({ className }: { className?: string }) {
  return (
    <div className={cn('flex justify-center', className)}>
      <div className="w-px h-6 border-l-2 border-dashed border-amber-400/60" />
    </div>
  );
}

// ── Agent Card ───────────────────────────────────────────────────

interface AgentCardProps {
  agent: AgentTreeNode;
  currentAgentId?: string;
  onChat: (agentId: string) => void;
  onEditSoul: (agent: { id: string; name: string }) => void;
  onDelete: (agent: { id: string; name: string }) => void;
  isCompact?: boolean;
}

function AgentCard({
  agent,
  currentAgentId,
  onChat,
  onEditSoul,
  onDelete,
  isCompact,
}: AgentCardProps) {
  const { t } = useTranslation(['agents', 'common']);
  const isActive = currentAgentId === agent.id;
  const isLead = agent.role === 'lead' || agent.isMain;
  const hasChildren = agent.children.length > 0;

  // Color scheme based on role
  const cardGradient = isLead
    ? 'from-indigo-500 to-purple-600'
    : 'from-emerald-500 to-teal-600';

  const roleIcon = isLead ? Crown : Bot;
  const RoleIcon = roleIcon;

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-card transition-all hover:shadow-lg',
        isCompact ? 'p-3 min-w-[180px] max-w-[220px]' : 'p-4 min-w-[220px] max-w-[280px]',
        isActive && 'ring-2 ring-primary/50 border-primary/30',
        isLead && 'shadow-md',
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2.5 mb-2">
        <div className={cn(
          'flex shrink-0 items-center justify-center rounded-lg text-white',
          isCompact ? 'h-8 w-8' : 'h-10 w-10',
          `bg-gradient-to-br ${cardGradient}`,
        )}>
          {agent.identity?.emoji ? (
            <span className="text-sm">{agent.identity.emoji}</span>
          ) : (
            <RoleIcon className={cn(isCompact ? 'h-4 w-4' : 'h-5 w-5')} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className={cn('font-semibold truncate', isCompact ? 'text-xs' : 'text-sm')}>
              {agent.name}
            </h3>
            {isLead && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                {t('agents:leadBadge', '主管')}
              </Badge>
            )}
            {agent.role === 'sub' && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">
                {t('agents:subBadge', '执行')}
              </Badge>
            )}
            {isActive && (
              <Badge className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-0">
                {t('agents:activeBadge')}
              </Badge>
            )}
          </div>
          {!isCompact && agent.description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
              {agent.description}
            </p>
          )}
        </div>
      </div>

      {/* Info */}
      {!isCompact && (
        <div className="space-y-1 mb-3">
          {agent.model && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="font-medium">{t('agents:model')}:</span>
              <span className="truncate">{typeof agent.model === 'string' ? agent.model : ''}</span>
            </div>
          )}
          {hasChildren && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{t('agents:subAgentCount', { count: agent.children.length })}</span>
            </div>
          )}
          {agent.allowCrossComm && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
              <Network className="h-3 w-3" />
              <span>{t('agents:crossCommEnabled', '跨Agent通信')}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant={isActive ? 'default' : 'outline'}
          className="flex-1 h-7 text-xs"
          onClick={() => onChat(agent.id)}
        >
          <MessageSquare className="h-3 w-3 mr-1" />
          {isActive
            ? t('agents:continueChat')
            : t('agents:startChat')}
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="px-1.5 h-7 text-muted-foreground hover:text-violet-600"
          title={t('agents:soul.editTitle')}
          onClick={() => onEditSoul({ id: agent.id, name: agent.name })}
        >
          <FileText className="h-3 w-3" />
        </Button>
        {!agent.isMain && (
          <Button
            size="sm"
            variant="ghost"
            className="px-1.5 h-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete({ id: agent.id, name: agent.name })}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Tree Node Renderer (recursive) ──────────────────────────────

interface TreeNodeProps {
  node: AgentTreeNode;
  currentAgentId?: string;
  onChat: (agentId: string) => void;
  onEditSoul: (agent: { id: string; name: string }) => void;
  onDelete: (agent: { id: string; name: string }) => void;
}

function TreeNode({ node, currentAgentId, onChat, onEditSoul, onDelete }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* This Agent Card */}
      <div className="relative">
        <AgentCard
          agent={node}
          currentAgentId={currentAgentId}
          onChat={onChat}
          onEditSoul={onEditSoul}
          onDelete={onDelete}
          isCompact={node.depth > 0}
        />
        {/* Expand/collapse toggle for nodes with children */}
        {hasChildren && (
          <button
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center h-5 w-5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-600 hover:bg-amber-400/30 transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <>
          <VerticalLine className="mt-3" />
          {node.children.length > 1 && (
            <div className="relative w-full flex justify-center">
              {/* Horizontal line spanning children */}
              <div className="absolute top-0 h-px border-t-2 border-dashed border-amber-400/60"
                style={{
                  left: `${100 / (2 * node.children.length)}%`,
                  right: `${100 / (2 * node.children.length)}%`,
                }}
              />
            </div>
          )}
          <div className={cn(
            'flex gap-6 justify-center flex-wrap',
            node.children.length > 1 && 'mt-0',
          )}>
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <VerticalLine />
                <TreeNode
                  node={child}
                  currentAgentId={currentAgentId}
                  onChat={onChat}
                  onEditSoul={onEditSoul}
                  onDelete={onDelete}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main OrgChart Component ──────────────────────────────────────

interface AgentOrgChartProps {
  agents: Agent[];
  currentAgentId?: string;
  onChat: (agentId: string) => void;
  onEditSoul: (agent: { id: string; name: string }) => void;
  onDelete: (agent: { id: string; name: string }) => void;
}

export function AgentOrgChart({
  agents,
  currentAgentId,
  onChat,
  onEditSoul,
  onDelete,
}: AgentOrgChartProps) {
  const tree = useMemo(() => buildAgentTree(agents), [agents]);

  if (tree.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto pb-8">
      <div className="flex flex-col items-center min-w-fit px-8 py-4">
        {/* Render each root and its subtree */}
        <div className="flex gap-10 justify-center flex-wrap">
          {tree.map((root) => (
            <TreeNode
              key={root.id}
              node={root}
              currentAgentId={currentAgentId}
              onChat={onChat}
              onEditSoul={onEditSoul}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
