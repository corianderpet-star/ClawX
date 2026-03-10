/**
 * Agent Type Definitions
 * Types for multi-agent management and collaboration
 */

/** Agent definition returned by agents.list RPC */
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
}

/** Agent with active session info */
export interface AgentWithSessions extends Agent {
  sessionCount?: number;
  activeSessionKey?: string;
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
