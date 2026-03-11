/**
 * Agent Type Definitions
 * Types for multi-agent management and collaboration.
 *
 * Supports a "company-style" hierarchy: agents have a `role` (lead / sub)
 * and optional `parentId` to form a tree.  The lead agent dispatches tasks
 * to sub-agents; sub-agents can optionally communicate with each other
 * when `allowCrossComm` is enabled.
 */

// ── Agent role in the org hierarchy ──────────────────────────────

/** Role of an agent inside the multi-agent tree. */
export type AgentRole = 'lead' | 'sub';

// ── Core Agent interface ─────────────────────────────────────────

/** Agent definition returned by agents.list RPC + local config */
export interface Agent {
  id: string;
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  skills?: string[];
  /** Whether this is the main/default agent */
  isMain?: boolean;
  /** Agent status */
  status?: 'active' | 'idle' | 'error';
  /** Creation timestamp */
  createdAt?: number;
  /** Last activity timestamp */
  lastActiveAt?: number;
  /** Agent-specific configuration */
  config?: Record<string, unknown>;

  // ── Multi-agent hierarchy fields ───────────────────────────────

  /** Role in the org tree – "lead" = manager, "sub" = subordinate */
  role?: AgentRole;
  /** Parent agent ID – only set for sub-agents */
  parentId?: string;
  /** IDs of allowed sub-agents (for lead agents) */
  subagentIds?: string[];
  /** Allow cross-agent communication between sub-agents */
  allowCrossComm?: boolean;
  /** Identity info for visual display */
  identity?: {
    emoji?: string;
    theme?: string;
    avatar?: string;
  };
  /** Whether this agent should require @mention in channels (sub-agents default true) */
  requireMention?: boolean;
}

/** Agent with active session info */
export interface AgentWithSessions extends Agent {
  sessionCount?: number;
  activeSessionKey?: string;
}

/** Tree node for the org-chart UI */
export interface AgentTreeNode extends Agent {
  children: AgentTreeNode[];
  /** depth in the tree (0 = root) */
  depth: number;
}

/** Parameters for routing a message to a specific agent */
export interface AgentRouteParams {
  agentId: string;
  sessionKey?: string;
  message: string;
}

/** Multi-agent collaboration mode */
export type CollaborationMode = 'sequential' | 'parallel' | 'delegate';

/** Agent delegation request */
export interface AgentDelegation {
  fromAgentId: string;
  toAgentId: string;
  task: string;
  sessionKey?: string;
}
