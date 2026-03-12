/**
 * Agents State Store
 * Manages agent list, current agent selection, and multi-agent coordination.
 * Agents are loaded from the OpenClaw Gateway via the `agents.list` RPC.
 */
import { create } from 'zustand';
import { invokeIpc } from '@/lib/api-client';
import type { Agent, AgentRole } from '@/types/agent';

/** Input for creating a new agent */
export interface CreateAgentInput {
  id: string;
  name?: string;
  description?: string;
  model?: string;
  /** Custom SOUL.md content */
  soulMd?: string;
  /** Role in the org hierarchy */
  role?: AgentRole;
  /** Parent agent ID (for sub-agents) */
  parentId?: string;
  /** Allow cross-agent communication */
  allowCrossComm?: boolean;
  /** Emoji for visual identity */
  emoji?: string;
  /** Whether to require @mention in channels */
  requireMention?: boolean;
}

/** Input for updating an existing agent */
export interface UpdateAgentInput {
  agentId: string;
  name?: string;
  description?: string;
  model?: string;
  tools?: {
    profile?: string;
    allow?: string[];
    deny?: string[];
  };
  /** Per-agent skill allowlist. undefined = don't change; string[] = set allowlist; null = clear (all skills). */
  skills?: string[] | null;
  role?: 'lead' | 'sub';
  allowCrossComm?: boolean;
  requireMention?: boolean;
  emoji?: string;
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
  /** Rename an agent */
  renameAgent: (agentId: string, name: string) => Promise<boolean>;
  /** Update agent fields (model, tools, description, etc.) */
  updateAgent: (input: UpdateAgentInput) => Promise<boolean>;
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
      // Fetch from two sources in parallel:
      // 1. Gateway RPC (runtime status: id, name, identity)
      // 2. Local config file (full data: skills, model, description, tools, etc.)
      const [rpcResult, configResult] = await Promise.all([
        invokeIpc(
          'gateway:rpc',
          'agents.list',
          {},
        ).catch(() => null) as Promise<{ success: boolean; result?: unknown; error?: string } | null>,
        invokeIpc('agent:list').catch(() => null) as Promise<Array<Record<string, unknown>> | null>,
      ]);

      // Build config lookup map (by agent id)
      const configMap = new Map<string, Record<string, unknown>>();
      if (Array.isArray(configResult)) {
        for (const entry of configResult) {
          const id = String(entry.id || '');
          if (id) configMap.set(id, entry);
        }
      }

      let rawAgents: Record<string, unknown>[] = [];
      if (rpcResult?.success && rpcResult.result) {
        const data = rpcResult.result as Record<string, unknown>;
        // OpenClaw agents.list returns { agents: [...] } or a direct array
        rawAgents = Array.isArray(data)
          ? data
          : Array.isArray(data.agents)
            ? data.agents
            : [];
      }

      // If gateway didn't return agents, fall back to config file as the source
      if (rawAgents.length === 0 && configMap.size > 0) {
        rawAgents = Array.from(configMap.values());
      }

      if (rawAgents.length > 0) {
        const agents: Agent[] = rawAgents.map((raw: Record<string, unknown>) => {
          const id = String(raw.id || raw.agentId || raw.name || '');
          // Merge with config data to fill fields not returned by gateway RPC
          const cfg = configMap.get(id);
          return {
            id,
            name: String(raw.name || cfg?.name || id || 'Unknown'),
            description: (raw.description || cfg?.description) ? String(raw.description || cfg?.description) : undefined,
            model: (raw.model || cfg?.model) ? String(raw.model || cfg?.model) : undefined,
            provider: raw.provider ? String(raw.provider) : undefined,
            systemPrompt: raw.systemPrompt ? String(raw.systemPrompt) : undefined,
            skills: Array.isArray(raw.skills)
              ? raw.skills.map(String)
              : Array.isArray(cfg?.skills)
                ? (cfg.skills as unknown[]).map(String)
                : undefined,
            isMain: raw.isMain === true || cfg?.default === true || raw.id === 'main' || raw.agentId === 'main',
            status: (raw.status as Agent['status']) || 'idle',
            createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : undefined,
            lastActiveAt: typeof raw.lastActiveAt === 'number' ? raw.lastActiveAt : undefined,
            config: (raw.config && typeof raw.config === 'object') ? raw.config as Record<string, unknown> : undefined,
            role: (cfg?.role as Agent['role']) || undefined,
            identity: (raw.identity && typeof raw.identity === 'object')
              ? raw.identity as Agent['identity']
              : (cfg?.identity && typeof cfg.identity === 'object')
                ? cfg.identity as Agent['identity']
                : undefined,
          };
        }).filter((a: Agent) => a.id);

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

  renameAgent: async (agentId: string, name: string) => {
    set({ saving: true, error: null });
    try {
      const result = await invokeIpc('agent:rename', { agentId, name }) as { success?: boolean; ok?: boolean; error?: { message?: string } };
      if (result && result.ok === false && result.error) {
        throw new Error(result.error.message || 'Failed to rename agent');
      }
      // Update local state immediately
      set((state) => ({
        saving: false,
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, name } : a,
        ),
      }));
      return true;
    } catch (err) {
      console.error('Failed to rename agent:', err);
      set({ saving: false, error: String(err) });
      return false;
    }
  },

  updateAgent: async (input: UpdateAgentInput) => {
    set({ saving: true, error: null });
    try {
      const result = await invokeIpc('agent:update', input) as { ok?: boolean; error?: { message?: string } };
      if (result && result.ok === false && result.error) {
        throw new Error(result.error.message || 'Failed to update agent');
      }
      // Update local state immediately with provided fields
      set((state) => ({
        saving: false,
        agents: state.agents.map((a) => {
          if (a.id !== input.agentId) return a;
          const updated = { ...a };
          if (input.name !== undefined) updated.name = input.name;
          if (input.description !== undefined) updated.description = input.description;
          if (input.model !== undefined) updated.model = input.model;
          if (input.role !== undefined) updated.role = input.role;
          if (input.emoji !== undefined) {
            updated.identity = { ...updated.identity, emoji: input.emoji };
          }
          if (input.skills !== undefined) {
            updated.skills = input.skills === null ? undefined : input.skills;
          }
          return updated;
        }),
      }));
      // Reload from gateway to get full state
      await get().loadAgents();
      return true;
    } catch (err) {
      console.error('Failed to update agent:', err);
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
