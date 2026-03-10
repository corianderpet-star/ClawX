/**
 * Agents State Store
 * Manages agent list, current agent selection, and multi-agent coordination.
 * Agents are loaded from the OpenClaw Gateway via the `agents.list` RPC.
 */
import { create } from 'zustand';
import { invokeIpc } from '@/lib/api-client';
import type { Agent } from '@/types/agent';

/** Input for creating a new agent */
export interface CreateAgentInput {
  id: string;
  name?: string;
  description?: string;
  model?: string;
  /** Custom SOUL.md content */
  soulMd?: string;
}

interface AgentsState {
  /** All available agents */
  agents: Agent[];
  /** Currently selected agent ID (used for new sessions) */
  currentAgentId: string;
  /** Whether agents have been loaded */
  isLoaded: boolean;
  /** Loading state */
  loading: boolean;
  /** Whether a create/delete operation is in progress */
  saving: boolean;
  /** Error message */
  error: string | null;

  // Actions
  /** Load agents from Gateway */
  loadAgents: () => Promise<void>;
  /** Create a new agent */
  createAgent: (input: CreateAgentInput) => Promise<boolean>;
  /** Delete an agent by ID */
  deleteAgent: (agentId: string, removeFiles?: boolean) => Promise<boolean>;
  /** Read SOUL.md content for an agent */
  readSoul: (agentId: string) => Promise<string>;
  /** Write SOUL.md content for an agent */
  writeSoul: (agentId: string, content: string) => Promise<boolean>;
  /** Switch the active agent */
  setCurrentAgent: (agentId: string) => void;
  /** Get agent by ID */
  getAgent: (agentId: string) => Agent | undefined;
  /** Check if multi-agent mode is available */
  isMultiAgent: () => boolean;
  /** Clear error */
  clearError: () => void;
}

/** Default agent ID when no agents are configured */
const DEFAULT_AGENT_ID = 'main';

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  currentAgentId: DEFAULT_AGENT_ID,
  isLoaded: false,
  loading: false,
  saving: false,
  error: null,

  loadAgents: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });

    try {
      const result = await invokeIpc(
        'gateway:rpc',
        'agents.list',
        {},
      ) as { success: boolean; result?: unknown; error?: string };

      if (result.success && result.result) {
        const data = result.result as Record<string, unknown>;
        // OpenClaw agents.list returns { agents: [...] } or a direct array
        const rawAgents = Array.isArray(data)
          ? data
          : Array.isArray(data.agents)
            ? data.agents
            : [];

        const agents: Agent[] = rawAgents.map((raw: Record<string, unknown>) => ({
          id: String(raw.id || raw.agentId || raw.name || ''),
          name: String(raw.name || raw.id || raw.agentId || 'Unknown'),
          description: raw.description ? String(raw.description) : undefined,
          model: raw.model ? String(raw.model) : undefined,
          provider: raw.provider ? String(raw.provider) : undefined,
          systemPrompt: raw.systemPrompt ? String(raw.systemPrompt) : undefined,
          skills: Array.isArray(raw.skills) ? raw.skills.map(String) : undefined,
          isMain: raw.isMain === true || raw.id === 'main' || raw.agentId === 'main',
          status: (raw.status as Agent['status']) || 'idle',
          createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : undefined,
          lastActiveAt: typeof raw.lastActiveAt === 'number' ? raw.lastActiveAt : undefined,
          config: (raw.config && typeof raw.config === 'object') ? raw.config as Record<string, unknown> : undefined,
        })).filter((a: Agent) => a.id);

        // Ensure 'main' agent exists if no agents returned (single-agent fallback)
        if (agents.length === 0) {
          agents.push({
            id: 'main',
            name: 'Main Agent',
            isMain: true,
            status: 'active',
          });
        }

        // Keep current agent valid
        const { currentAgentId } = get();
        const currentExists = agents.some((a) => a.id === currentAgentId);
        const nextAgentId = currentExists
          ? currentAgentId
          : agents.find((a) => a.isMain)?.id || agents[0].id;

        set({
          agents,
          currentAgentId: nextAgentId,
          isLoaded: true,
          loading: false,
        });
      } else {
        // Gateway doesn't support agents.list or returned error — fallback to single agent
        const agents: Agent[] = [{
          id: 'main',
          name: 'Main Agent',
          isMain: true,
          status: 'active',
        }];
        set({ agents, isLoaded: true, loading: false });
      }
    } catch (err) {
      console.warn('Failed to load agents:', err);
      // Fallback to single agent mode on error
      const agents: Agent[] = [{
        id: 'main',
        name: 'Main Agent',
        isMain: true,
        status: 'active',
      }];
      set({
        agents,
        isLoaded: true,
        loading: false,
        error: String(err),
      });
    }
  },

  setCurrentAgent: (agentId: string) => {
    const { agents } = get();
    if (agents.some((a) => a.id === agentId)) {
      set({ currentAgentId: agentId });
    }
  },

  createAgent: async (input: CreateAgentInput) => {
    set({ saving: true, error: null });
    try {
      const result = await invokeIpc('agent:create', input) as { ok?: boolean; data?: unknown; error?: { message?: string } };
      if (result && result.ok === false && result.error) {
        throw new Error(result.error.message || 'Failed to create agent');
      }
      // Reload agents after successful creation
      set({ saving: false });
      await get().loadAgents();
      return true;
    } catch (err) {
      console.error('Failed to create agent:', err);
      set({ saving: false, error: String(err) });
      return false;
    }
  },

  deleteAgent: async (agentId: string, removeFiles = false) => {
    set({ saving: true, error: null });
    try {
      const result = await invokeIpc('agent:delete', { agentId, removeFiles }) as { ok?: boolean; data?: unknown; error?: { message?: string } };
      if (result && result.ok === false && result.error) {
        throw new Error(result.error.message || 'Failed to delete agent');
      }
      // If deleted agent was the current one, switch to main
      const { currentAgentId } = get();
      if (currentAgentId === agentId) {
        set({ currentAgentId: 'main' });
      }
      set({ saving: false });
      // Reload agents after successful deletion
      await get().loadAgents();
      return true;
    } catch (err) {
      console.error('Failed to delete agent:', err);
      set({ saving: false, error: String(err) });
      return false;
    }
  },

  getAgent: (agentId: string) => {
    return get().agents.find((a) => a.id === agentId);
  },

  readSoul: async (agentId: string) => {
    // invokeIpc via unified protocol already unwraps response.data,
    // so result is { content: '...' }, NOT { ok, data: { content } }
    const result = await invokeIpc('agent:readSoul', { agentId }) as { content?: string };
    return result?.content || '';
  },

  writeSoul: async (agentId: string, content: string) => {
    set({ saving: true, error: null });
    try {
      const result = await invokeIpc('agent:writeSoul', { agentId, content }) as { ok?: boolean; error?: { message?: string } };
      if (result && result.ok === false && result.error) {
        throw new Error(result.error.message || 'Failed to write SOUL.md');
      }
      set({ saving: false });
      return true;
    } catch (err) {
      console.error('Failed to write SOUL.md:', err);
      set({ saving: false, error: String(err) });
      return false;
    }
  },

  isMultiAgent: () => {
    return get().agents.length > 1;
  },

  clearError: () => set({ error: null }),
}));

/** Extract agent ID from a session key like "agent:<agentId>:<suffix>" */
export function extractAgentIdFromSessionKey(sessionKey: string): string {
  if (!sessionKey.startsWith('agent:')) return 'main';
  const parts = sessionKey.split(':');
  return parts.length >= 2 ? parts[1] : 'main';
}

/** Build a session key prefix for an agent */
export function agentSessionPrefix(agentId: string): string {
  return `agent:${agentId}`;
}

/** Build a default session key for an agent */
export function agentDefaultSessionKey(agentId: string): string {
  return `agent:${agentId}:main`;
}

/** Build a new unique session key for an agent */
export function agentNewSessionKey(agentId: string): string {
  return `agent:${agentId}:session-${Date.now()}`;
}
