/**
 * Agent Configuration Utilities
 * Manages agent CRUD operations in OpenClaw config files (~/.openclaw/openclaw.json).
 * Creates workspace directories and copies template files for new agents.
 */
import { access, mkdir, readFile, writeFile, copyFile, rm } from 'fs/promises';
import { constants, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { app } from 'electron';
import { logger } from './logger';

const OPENCLAW_DIR = join(homedir(), '.openclaw');
const CONFIG_FILE = join(OPENCLAW_DIR, 'openclaw.json');

// ── Types ────────────────────────────────────────────────────────

export interface AgentConfigEntry {
  id: string;
  name?: string;
  description?: string;
  default?: boolean;
  workspace?: string;
  agentDir?: string;
  model?: string | { primary: string; fallbacks?: string[] };
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
  };
  sandbox?: { mode?: string };
  subagents?: { allowAgents?: string[] };
  tools?: {
    profile?: string;
    allow?: string[];
    deny?: string[];
  };
  /** Agent role in the multi-agent hierarchy */
  role?: 'lead' | 'sub';
  /** Parent agent ID (for sub-agents) */
  parentId?: string;
  /** Allow cross-agent communication */
  allowCrossComm?: boolean;
  /** Require @mention in channels (recommended for sub-agents) */
  requireMention?: boolean;
  [key: string]: unknown;
}

export interface CreateAgentInput {
  id: string;
  name?: string;
  description?: string;
  model?: string;
  /** Custom SOUL.md content – if provided, written instead of template */
  soulMd?: string;
  /** Role in the org hierarchy */
  role?: 'lead' | 'sub';
  /** Parent agent ID (for sub-agents) */
  parentId?: string;
  /** Allow cross-agent communication */
  allowCrossComm?: boolean;
  /** Emoji for identity display */
  emoji?: string;
  /** Require @mention in channels */
  requireMention?: boolean;
}

export interface AgentsConfig {
  defaults?: Record<string, unknown>;
  list?: AgentConfigEntry[];
  [key: string]: unknown;
}

interface OpenClawConfig {
  agents?: AgentsConfig;
  bindings?: Array<{ agentId: string; match?: Record<string, unknown> }>;
  [key: string]: unknown;
}

// ── Helpers ──────────────────────────────────────────────────────

async function fileExists(p: string): Promise<boolean> {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function ensureConfigDir(): Promise<void> {
  if (!(await fileExists(OPENCLAW_DIR))) {
    await mkdir(OPENCLAW_DIR, { recursive: true });
  }
}

async function readConfig(): Promise<OpenClawConfig> {
  await ensureConfigDir();
  if (!(await fileExists(CONFIG_FILE))) {
    return {};
  }
  try {
    const content = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as OpenClawConfig;
  } catch (error) {
    logger.error('Failed to read OpenClaw config for agent management', error);
    return {};
  }
}

async function writeConfig(config: OpenClawConfig): Promise<void> {
  await ensureConfigDir();
  // Ensure commands.restart for graceful reload
  const commands = (config.commands && typeof config.commands === 'object')
    ? { ...(config.commands as Record<string, unknown>) }
    : {};
  commands.restart = true;
  config.commands = commands;
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function getTemplatesDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'openclaw', 'docs', 'reference', 'templates');
  }
  return join(__dirname, '../../build/openclaw/docs/reference/templates');
}

// ── Template files to copy into new agent workspace ──────────────
// Note: SOUL.md is intentionally excluded — written from user input or as a
// separate step.  BOOTSTRAP.md must NOT be created manually (causes agent to
// get stuck in bootstrapping state).

const WORKSPACE_TEMPLATES = [
  'AGENTS.md',
  'IDENTITY.md',
  'USER.md',
  'TOOLS.md',
];

// ── Public API ───────────────────────────────────────────────────

/**
 * List all agents from the config file.
 */
export async function listAgentsFromConfig(): Promise<AgentConfigEntry[]> {
  const config = await readConfig();
  const agents = config.agents?.list;
  if (Array.isArray(agents) && agents.length > 0) {
    return agents;
  }
  // Fallback: single implicit 'main' agent
  return [{ id: 'main', name: 'Main Agent', default: true }];
}

/**
 * Create a new agent.
 * 1. Adds entry to agents.list in openclaw.json
 * 2. Creates workspace directory with template files
 * 3. Creates agentDir for sessions/state
 */
export async function createAgent(input: CreateAgentInput): Promise<AgentConfigEntry> {
  const { id, name, description, model, soulMd, role, parentId, allowCrossComm, emoji, requireMention } = input;

  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error('Invalid agent ID: must be alphanumeric, hyphens, or underscores');
  }

  const config = await readConfig();

  // Ensure agents section exists
  if (!config.agents) config.agents = {};
  if (!Array.isArray(config.agents.list)) config.agents.list = [];

  // Check for duplicate
  if (config.agents.list.some((a) => a.id === id)) {
    throw new Error(`Agent with ID "${id}" already exists`);
  }

  // Build workspace and agentDir paths
  const workspace = join(OPENCLAW_DIR, `workspace-${id}`);
  const agentDir = join(OPENCLAW_DIR, 'agents', id, 'agent');
  const sessionsDir = join(OPENCLAW_DIR, 'agents', id, 'sessions');

  // Build agent entry — include hierarchy fields for multi-agent support.
  const configEntry: AgentConfigEntry = {
    id,
    workspace,
    agentDir,
  };
  if (model) configEntry.model = model;

  // Multi-agent hierarchy fields
  if (role) configEntry.role = role;
  if (parentId) configEntry.parentId = parentId;
  if (allowCrossComm) configEntry.allowCrossComm = true;
  if (typeof requireMention === 'boolean') configEntry.requireMention = requireMention;
  if (emoji) {
    configEntry.identity = { emoji };
  }

  // If this agent has a parent, add it to the parent's subagents.allowAgents
  if (parentId) {
    const parentAgent = config.agents.list.find((a) => a.id === parentId);
    if (parentAgent) {
      if (!parentAgent.subagents) parentAgent.subagents = { allowAgents: [] };
      if (!parentAgent.subagents.allowAgents) parentAgent.subagents.allowAgents = [];
      if (!parentAgent.subagents.allowAgents.includes(id)) {
        parentAgent.subagents.allowAgents.push(id);
      }
    }
  }

  // Append to list
  config.agents.list.push(configEntry);

  // Write config
  await writeConfig(config);
  logger.info('Agent created in config', { agentId: id });

  // Build a richer return entry for the caller (includes display-only fields)
  const entry: AgentConfigEntry = { ...configEntry };
  if (name) entry.name = name;
  if (description) entry.description = description;

  // Create directories
  await mkdir(workspace, { recursive: true });
  await mkdir(agentDir, { recursive: true });
  await mkdir(sessionsDir, { recursive: true });
  await mkdir(join(workspace, 'memory'), { recursive: true });

  // Copy template files to workspace (excludes SOUL.md and BOOTSTRAP.md)
  const templatesDir = getTemplatesDir();
  for (const templateFile of WORKSPACE_TEMPLATES) {
    const src = join(templatesDir, templateFile);
    const dst = join(workspace, templateFile);
    if (existsSync(src) && !(await fileExists(dst))) {
      try {
        await copyFile(src, dst);
      } catch (err) {
        logger.warn(`Failed to copy template ${templateFile} for agent ${id}:`, err);
      }
    }
  }

  // Write SOUL.md – custom content from user or fall back to template
  const soulDst = join(workspace, 'SOUL.md');
  if (!(await fileExists(soulDst))) {
    if (soulMd && soulMd.trim()) {
      await writeFile(soulDst, soulMd, 'utf-8');
    } else {
      // Copy template SOUL.md as starting point
      const soulSrc = join(templatesDir, 'SOUL.md');
      if (existsSync(soulSrc)) {
        try {
          await copyFile(soulSrc, soulDst);
        } catch (err) {
          logger.warn(`Failed to copy SOUL.md template for agent ${id}:`, err);
        }
      }
    }
  }

  logger.info('Agent workspace initialized', { agentId: id, workspace, agentDir });

  return entry;
}

/**
 * Delete an agent by ID.
 * 1. Removes from agents.list in openclaw.json
 * 2. Removes any bindings referencing this agent
 * 3. Optionally removes workspace and agentDir directories
 */
export async function deleteAgent(agentId: string, removeFiles = false): Promise<void> {
  if (agentId === 'main') {
    throw new Error('Cannot delete the main agent');
  }

  const config = await readConfig();

  if (!config.agents?.list || !Array.isArray(config.agents.list)) {
    throw new Error('No agents configured');
  }

  const idx = config.agents.list.findIndex((a) => a.id === agentId);
  if (idx === -1) {
    throw new Error(`Agent "${agentId}" not found`);
  }

  const agent = config.agents.list[idx];
  const workspace = agent.workspace || join(OPENCLAW_DIR, `workspace-${agentId}`);
  const agentBaseDir = join(OPENCLAW_DIR, 'agents', agentId);

  // Remove from list
  config.agents.list.splice(idx, 1);

  // Remove related bindings
  if (Array.isArray(config.bindings)) {
    config.bindings = config.bindings.filter((b) => b.agentId !== agentId);
  }

  // Write config
  await writeConfig(config);
  logger.info('Agent removed from config', { agentId });

  // Optionally remove directories
  if (removeFiles) {
    try {
      if (await fileExists(workspace)) {
        await rm(workspace, { recursive: true, force: true });
        logger.info('Removed agent workspace', { workspace });
      }
    } catch (err) {
      logger.warn(`Failed to remove workspace for agent ${agentId}:`, err);
    }

    try {
      if (await fileExists(agentBaseDir)) {
        await rm(agentBaseDir, { recursive: true, force: true });
        logger.info('Removed agent directory', { agentBaseDir });
      }
    } catch (err) {
      logger.warn(`Failed to remove agentDir for agent ${agentId}:`, err);
    }
  }
}

// ── SOUL.md Operations ───────────────────────────────────────────

/**
 * Rename an agent (update its display name in the config).
 */
export async function renameAgent(agentId: string, newName: string): Promise<void> {
  const config = await readConfig();
  if (!config.agents?.list || !Array.isArray(config.agents.list)) {
    throw new Error('No agents configured');
  }
  const entry = config.agents.list.find((a) => a.id === agentId);
  if (!entry) {
    throw new Error(`Agent "${agentId}" not found`);
  }
  entry.name = newName.trim() || agentId;
  // Also update identity.name for consistency
  if (entry.identity) {
    entry.identity.name = entry.name;
  }
  await writeConfig(config);
  logger.info('Agent renamed', { agentId, newName: entry.name });
}

/**
 * Resolve the workspace path for a given agent ID from the config,
 * falling back to the conventional `~/.openclaw/workspace-<id>`.
 */
async function resolveWorkspace(agentId: string): Promise<string> {
  const config = await readConfig();
  const entry = config.agents?.list?.find((a) => a.id === agentId);
  return entry?.workspace || join(OPENCLAW_DIR, `workspace-${agentId}`);
}

/**
 * Read the SOUL.md file for an agent.
 * Returns the content string, or an empty string if the file does not exist.
 */
export async function readAgentSoul(agentId: string): Promise<string> {
  const workspace = await resolveWorkspace(agentId);
  const soulPath = join(workspace, 'SOUL.md');
  if (!(await fileExists(soulPath))) return '';
  return readFile(soulPath, 'utf-8');
}

/**
 * Write (create or overwrite) the SOUL.md file for an agent.
 */
export async function writeAgentSoul(agentId: string, content: string): Promise<void> {
  const workspace = await resolveWorkspace(agentId);
  await mkdir(workspace, { recursive: true });
  const soulPath = join(workspace, 'SOUL.md');
  await writeFile(soulPath, content, 'utf-8');
  logger.info('Agent SOUL.md updated', { agentId, soulPath });
}
