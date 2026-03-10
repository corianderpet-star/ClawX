/**
 * Migration / Backup Utilities
 * One-click export & import of all user data for device transfer.
 *
 * Backup format: JSON file (.clawxbackup) containing:
 * - App settings (electron-store: settings.json)
 * - Provider configs & API keys (electron-store: clawx-providers.json)
 * - OpenClaw config (openclaw.json)
 * - OpenClaw auth (auth.json)
 * - Channel configs (embedded in openclaw.json)
 * - Installed skills (directory tree, base64-encoded files)
 * - Chat history sessions (JSONL files, base64-encoded)
 * - Cron tasks (from Gateway RPC when available)
 * - Background image (base64-encoded)
 */
import { readFile, writeFile, readdir, stat, mkdir, access, constants } from 'fs/promises';
import { join, relative, sep } from 'path';
import { homedir } from 'os';
import { app } from 'electron';
import { logger } from './logger';

// ── Types ────────────────────────────────────────────────────────

export interface BackupFile {
  /** Relative path (forward-slash separated) */
  path: string;
  /** Base64-encoded content */
  content: string;
}

export interface BackupAgent {
  /** Agent ID (e.g., 'main', 'my-agent') */
  id: string;
  /** Workspace files (SOUL.md, AGENTS.md, IDENTITY.md, etc.) — paths relative to workspace dir */
  workspaceFiles: BackupFile[];
}

export interface BackupManifest {
  version: 2;
  appVersion: string;
  createdAt: string;
  platform: string;

  /** electron-store: settings */
  settings: Record<string, unknown> | null;
  /** electron-store: clawx-providers */
  providers: Record<string, unknown> | null;
  /** ~/.openclaw/openclaw.json */
  openclawConfig: Record<string, unknown> | null;
  /** ~/.openclaw/auth.json */
  openclawAuth: Record<string, unknown> | null;
  /** Installed skills as file tree */
  skills: BackupFile[];
  /** Chat session JSONL files */
  chatSessions: BackupFile[];
  /** Agent workspace files (SOUL.md etc.) per agent */
  agents: BackupAgent[];
  /** Cron tasks (if Gateway was running) */
  cronTasks: unknown[] | null;
  /** Background image (base64) */
  backgroundImage: BackupFile | null;
}

export interface MigrationProgress {
  stage: string;
  current: number;
  total: number;
}

type ProgressCallback = (progress: MigrationProgress) => void;

// ── Helpers ──────────────────────────────────────────────────────

const OPENCLAW_DIR = join(homedir(), '.openclaw');

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    if (!(await fileExists(filePath))) return null;
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(`Migration: failed to read ${filePath}:`, err);
    return null;
  }
}

/**
 * Recursively collect all files in a directory as BackupFile entries.
 * Limits to common text / small binary extensions to avoid huge backups.
 */
async function collectDirectoryFiles(
  baseDir: string,
  onProgress?: ProgressCallback,
  stageName = 'collect',
): Promise<BackupFile[]> {
  const results: BackupFile[] = [];
  if (!(await fileExists(baseDir))) return results;

  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, .git, __pycache__ etc.
        if (['node_modules', '.git', '__pycache__', '.venv', 'venv'].includes(entry.name)) continue;
        await walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const fileStat = await stat(fullPath);
          // Skip files > 50MB
          if (fileStat.size > 50 * 1024 * 1024) continue;
          const content = await readFile(fullPath);
          const relPath = relative(baseDir, fullPath).split(sep).join('/');
          results.push({ path: relPath, content: content.toString('base64') });
          if (onProgress) {
            onProgress({ stage: stageName, current: results.length, total: -1 });
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  await walk(baseDir);
  return results;
}

async function restoreDirectoryFiles(baseDir: string, files: BackupFile[]): Promise<void> {
  await mkdir(baseDir, { recursive: true });
  for (const file of files) {
    const targetPath = join(baseDir, ...file.path.split('/'));
    const targetDir = join(targetPath, '..');
    await mkdir(targetDir, { recursive: true });
    await writeFile(targetPath, Buffer.from(file.content, 'base64'));
  }
}

// ── Export ────────────────────────────────────────────────────────

export async function exportBackup(onProgress?: ProgressCallback): Promise<BackupManifest> {
  const stages = [
    'settings', 'providers', 'openclawConfig', 'openclawAuth',
    'skills', 'chatSessions', 'agents', 'backgroundImage',
  ];
  let stageIndex = 0;
  const report = (stage: string, current = 0, total = 1) => {
    if (onProgress) onProgress({ stage, current, total });
  };

  // 1. App settings
  report(stages[stageIndex++]);
  const settingsPath = join(app.getPath('userData'), 'settings.json');
  const settings = await readJsonFile(settingsPath);

  // 2. Provider configs
  report(stages[stageIndex++]);
  const providersPath = join(app.getPath('userData'), 'clawx-providers.json');
  const providers = await readJsonFile(providersPath);

  // 3. OpenClaw config
  report(stages[stageIndex++]);
  const openclawConfig = await readJsonFile(join(OPENCLAW_DIR, 'openclaw.json'));

  // 4. OpenClaw auth
  report(stages[stageIndex++]);
  const openclawAuth = await readJsonFile(join(OPENCLAW_DIR, 'auth.json'));

  // 5. Installed skills
  report(stages[stageIndex++]);
  const skillsDir = join(OPENCLAW_DIR, 'skills');
  const skills = await collectDirectoryFiles(skillsDir, onProgress, 'skills');

  // 6. Chat sessions
  report(stages[stageIndex++]);
  const agentsDir = join(OPENCLAW_DIR, 'agents');
  const chatSessions = await collectChatSessions(agentsDir, onProgress);

  // 7. Agent workspace files (SOUL.md, AGENTS.md, IDENTITY.md, etc.)
  report(stages[stageIndex++]);
  const agents = await collectAgentWorkspaces(openclawConfig, onProgress);

  // 8. Background image
  report(stages[stageIndex++]);
  let backgroundImage: BackupFile | null = null;
  if (settings?.backgroundImage && typeof settings.backgroundImage === 'string' && settings.backgroundImage.length > 0) {
    try {
      const bgPath = settings.backgroundImage as string;
      if (await fileExists(bgPath)) {
        const bgContent = await readFile(bgPath);
        backgroundImage = {
          path: bgPath.split(sep).pop() || 'background',
          content: bgContent.toString('base64'),
        };
      }
    } catch {
      // Skip if background image is unavailable
    }
  }

  const manifest: BackupManifest = {
    version: 2,
    appVersion: app.getVersion(),
    createdAt: new Date().toISOString(),
    platform: process.platform,
    settings,
    providers,
    openclawConfig,
    openclawAuth,
    skills,
    chatSessions,
    agents,
    cronTasks: null, // Cron tasks handled separately via Gateway RPC
    backgroundImage,
  };

  return manifest;
}

/**
 * Collect chat session JSONL files from the agents directory tree.
 * Structure: agents/<agentId>/sessions/<uuid>.jsonl
 */
async function collectChatSessions(
  agentsDir: string,
  onProgress?: ProgressCallback,
): Promise<BackupFile[]> {
  const results: BackupFile[] = [];
  if (!(await fileExists(agentsDir))) return results;

  try {
    const agentEntries = await readdir(agentsDir, { withFileTypes: true });
    for (const agentEntry of agentEntries) {
      if (!agentEntry.isDirectory()) continue;
      const sessionsDir = join(agentsDir, agentEntry.name, 'sessions');
      if (!(await fileExists(sessionsDir))) continue;

      const sessionFiles = await readdir(sessionsDir, { withFileTypes: true });
      for (const sf of sessionFiles) {
        if (!sf.isFile()) continue;
        // Include .jsonl files but skip .deleted.jsonl
        if (!sf.name.endsWith('.jsonl') || sf.name.endsWith('.deleted.jsonl')) continue;
        try {
          const fullPath = join(sessionsDir, sf.name);
          const content = await readFile(fullPath);
          const relPath = `${agentEntry.name}/sessions/${sf.name}`;
          results.push({ path: relPath, content: content.toString('base64') });
          if (onProgress) {
            onProgress({ stage: 'chatSessions', current: results.length, total: -1 });
          }
        } catch {
          // Skip unreadable
        }
      }
    }
  } catch {
    // agents dir unreadable
  }

  return results;
}

/**
 * Collect agent workspace files (SOUL.md, AGENTS.md, IDENTITY.md, etc.)
 * for every configured agent.
 */
async function collectAgentWorkspaces(
  openclawConfig: Record<string, unknown> | null,
  onProgress?: ProgressCallback,
): Promise<BackupAgent[]> {
  const results: BackupAgent[] = [];
  if (!openclawConfig) return results;

  // Resolve agent list from config
  const agentsCfg = openclawConfig.agents as { list?: Array<{ id: string; workspace?: string }> } | undefined;
  const agentList = Array.isArray(agentsCfg?.list) ? agentsCfg!.list : [];

  // Also check for the implicit 'main' agent if not in list
  const hasMain = agentList.some(a => a.id === 'main');
  const candidates = hasMain ? agentList : [{ id: 'main' }, ...agentList];

  for (const agent of candidates) {
    const workspace = agent.workspace || join(OPENCLAW_DIR, `workspace-${agent.id}`);
    if (!(await fileExists(workspace))) continue;

    const workspaceFiles = await collectDirectoryFiles(workspace, undefined, 'agents');
    if (workspaceFiles.length > 0) {
      results.push({ id: agent.id, workspaceFiles });
      if (onProgress) {
        onProgress({ stage: 'agents', current: results.length, total: -1 });
      }
    }
  }

  return results;
}

// ── Import ───────────────────────────────────────────────────────

export interface ImportOptions {
  /** Restore app settings (theme, language, proxy, etc.) */
  settings: boolean;
  /** Restore provider configs & API keys */
  providers: boolean;
  /** Restore OpenClaw config (channels, skill entries) */
  openclawConfig: boolean;
  /** Restore OpenClaw auth (API keys in OpenClaw format) */
  openclawAuth: boolean;
  /** Restore installed skills */
  skills: boolean;
  /** Restore chat history */
  chatSessions: boolean;
  /** Restore agent workspace files (SOUL.md etc.) */
  agents: boolean;
  /** Restore background image */
  backgroundImage: boolean;
  /** Restore cron tasks */
  cronTasks: boolean;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  settings: true,
  providers: true,
  openclawConfig: true,
  openclawAuth: true,
  skills: true,
  chatSessions: true,
  agents: true,
  backgroundImage: true,
  cronTasks: true,
};

export interface ImportResult {
  success: boolean;
  restored: string[];
  skipped: string[];
  errors: Array<{ category: string; error: string }>;
}

export async function importBackup(
  manifest: BackupManifest,
  options: ImportOptions = DEFAULT_IMPORT_OPTIONS,
  onProgress?: ProgressCallback,
): Promise<ImportResult> {
  const result: ImportResult = { success: true, restored: [], skipped: [], errors: [] };
  const report = (stage: string, current = 0, total = 1) => {
    if (onProgress) onProgress({ stage, current, total });
  };

  // 1. Settings
  if (options.settings && manifest.settings) {
    report('settings');
    try {
      const settingsPath = join(app.getPath('userData'), 'settings.json');
      // Preserve gatewayToken — generate a new one on the new machine
      const existing = await readJsonFile(settingsPath);
      const merged = { ...manifest.settings };
      if (existing?.gatewayToken) {
        merged.gatewayToken = existing.gatewayToken;
      }
      await writeFile(settingsPath, JSON.stringify(merged, null, 2), 'utf-8');
      result.restored.push('settings');
    } catch (err) {
      result.errors.push({ category: 'settings', error: String(err) });
    }
  } else {
    result.skipped.push('settings');
  }

  // 2. Providers
  if (options.providers && manifest.providers) {
    report('providers');
    try {
      const providersPath = join(app.getPath('userData'), 'clawx-providers.json');
      await writeFile(providersPath, JSON.stringify(manifest.providers, null, 2), 'utf-8');
      result.restored.push('providers');
    } catch (err) {
      result.errors.push({ category: 'providers', error: String(err) });
    }
  } else {
    result.skipped.push('providers');
  }

  // 3. OpenClaw config
  if (options.openclawConfig && manifest.openclawConfig) {
    report('openclawConfig');
    try {
      await mkdir(OPENCLAW_DIR, { recursive: true });
      await writeFile(
        join(OPENCLAW_DIR, 'openclaw.json'),
        JSON.stringify(manifest.openclawConfig, null, 2),
        'utf-8',
      );
      result.restored.push('openclawConfig');
    } catch (err) {
      result.errors.push({ category: 'openclawConfig', error: String(err) });
    }
  } else {
    result.skipped.push('openclawConfig');
  }

  // 4. OpenClaw auth
  if (options.openclawAuth && manifest.openclawAuth) {
    report('openclawAuth');
    try {
      await mkdir(OPENCLAW_DIR, { recursive: true });
      await writeFile(
        join(OPENCLAW_DIR, 'auth.json'),
        JSON.stringify(manifest.openclawAuth, null, 2),
        'utf-8',
      );
      result.restored.push('openclawAuth');
    } catch (err) {
      result.errors.push({ category: 'openclawAuth', error: String(err) });
    }
  } else {
    result.skipped.push('openclawAuth');
  }

  // 5. Skills
  if (options.skills && manifest.skills.length > 0) {
    report('skills', 0, manifest.skills.length);
    try {
      const skillsDir = join(OPENCLAW_DIR, 'skills');
      await restoreDirectoryFiles(skillsDir, manifest.skills);
      result.restored.push('skills');
    } catch (err) {
      result.errors.push({ category: 'skills', error: String(err) });
    }
  } else {
    result.skipped.push('skills');
  }

  // 6. Chat sessions
  if (options.chatSessions && manifest.chatSessions.length > 0) {
    report('chatSessions', 0, manifest.chatSessions.length);
    try {
      const agentsDir = join(OPENCLAW_DIR, 'agents');
      await restoreDirectoryFiles(agentsDir, manifest.chatSessions);
      result.restored.push('chatSessions');
    } catch (err) {
      result.errors.push({ category: 'chatSessions', error: String(err) });
    }
  } else {
    result.skipped.push('chatSessions');
  }

  // 7. Agent workspace files (SOUL.md etc.)
  const manifestAgents = manifest.agents || [];
  if (options.agents && manifestAgents.length > 0) {
    report('agents', 0, manifestAgents.length);
    try {
      // Read the (possibly just-restored) openclaw.json to learn existing workspace paths
      const cfgPath = join(OPENCLAW_DIR, 'openclaw.json');
      const currentCfg = await readJsonFile(cfgPath) as {
        agents?: { list?: Array<{ id: string; workspace?: string }> };
      } | null;
      const existingList = currentCfg?.agents?.list || [];

      let agentsRestored = 0;
      for (const backupAgent of manifestAgents) {
        // Determine target workspace dir — match existing config entry or use conventional path
        const existing = existingList.find(a => a.id === backupAgent.id);
        const targetWorkspace = existing?.workspace || join(OPENCLAW_DIR, `workspace-${backupAgent.id}`);

        await restoreDirectoryFiles(targetWorkspace, backupAgent.workspaceFiles);
        agentsRestored++;
        report('agents', agentsRestored, manifestAgents.length);
      }
      result.restored.push('agents');
    } catch (err) {
      result.errors.push({ category: 'agents', error: String(err) });
    }
  } else {
    result.skipped.push('agents');
  }

  // 8. Background image/video
  if (options.backgroundImage && manifest.backgroundImage) {
    report('backgroundImage');
    try {
      const bgDir = join(app.getPath('userData'), 'backgrounds');
      await mkdir(bgDir, { recursive: true });
      const bgPath = join(bgDir, manifest.backgroundImage.path);
      await writeFile(bgPath, Buffer.from(manifest.backgroundImage.content, 'base64'));
      // Determine type from extension
      const bgExt = (manifest.backgroundImage.path.split('.').pop() || '').toLowerCase();
      const isVideo = ['mp4', 'webm', 'mov'].includes(bgExt);
      // Update settings to point to the new background path
      const settingsPath = join(app.getPath('userData'), 'settings.json');
      const currentSettings = await readJsonFile(settingsPath);
      if (currentSettings) {
        currentSettings.backgroundImage = bgPath;
        currentSettings.backgroundType = isVideo ? 'video' : 'image';
        await writeFile(settingsPath, JSON.stringify(currentSettings, null, 2), 'utf-8');
      }
      result.restored.push('backgroundImage');
    } catch (err) {
      result.errors.push({ category: 'backgroundImage', error: String(err) });
    }
  } else {
    result.skipped.push('backgroundImage');
  }

  // 9. Cron tasks — skip here, handled by renderer calling Gateway RPC
  if (options.cronTasks && manifest.cronTasks && manifest.cronTasks.length > 0) {
    result.restored.push('cronTasks');
  } else {
    result.skipped.push('cronTasks');
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Get backup summary without exporting (for preview).
 */
export async function getBackupSummary(): Promise<{
  settingsSize: number;
  providersCount: number;
  channelsCount: number;
  skillsCount: number;
  chatSessionsCount: number;
  agentsCount: number;
  hasBackgroundImage: boolean;
}> {
  const settingsPath = join(app.getPath('userData'), 'settings.json');
  const settings = await readJsonFile(settingsPath);

  const providersPath = join(app.getPath('userData'), 'clawx-providers.json');
  const providers = await readJsonFile(providersPath);

  const openclawConfig = await readJsonFile(join(OPENCLAW_DIR, 'openclaw.json'));

  // Count skills
  let skillsCount = 0;
  const skillsDir = join(OPENCLAW_DIR, 'skills');
  try {
    if (await fileExists(skillsDir)) {
      const entries = await readdir(skillsDir, { withFileTypes: true });
      skillsCount = entries.filter(e => e.isDirectory()).length;
    }
  } catch { /* empty */ }

  // Count chat sessions
  let chatSessionsCount = 0;
  const agentsDir = join(OPENCLAW_DIR, 'agents');
  try {
    if (await fileExists(agentsDir)) {
      const agents = await readdir(agentsDir, { withFileTypes: true });
      for (const agent of agents) {
        if (!agent.isDirectory()) continue;
        const sessionsDir = join(agentsDir, agent.name, 'sessions');
        try {
          if (await fileExists(sessionsDir)) {
            const files = await readdir(sessionsDir);
            chatSessionsCount += files.filter(f => f.endsWith('.jsonl') && !f.endsWith('.deleted.jsonl')).length;
          }
        } catch { /* empty */ }
      }
    }
  } catch { /* empty */ }

  // Count agents (from config, excluding the implicit 'main')
  let agentsCount = 0;
  const agentsCfg = openclawConfig?.agents as { list?: Array<{ id: string }> } | undefined;
  if (Array.isArray(agentsCfg?.list)) {
    agentsCount = agentsCfg!.list.length;
  }
  // Always count at least 1 for the implicit 'main' agent if its workspace exists
  if (agentsCount === 0) {
    const mainWorkspace = join(OPENCLAW_DIR, 'workspace-main');
    if (await fileExists(mainWorkspace)) {
      agentsCount = 1;
    }
  }

  // Count channels
  let channelsCount = 0;
  if (openclawConfig?.channels && typeof openclawConfig.channels === 'object') {
    channelsCount = Object.keys(openclawConfig.channels).length;
  }

  // Count providers
  let providersCount = 0;
  if (providers?.providerAccounts && typeof providers.providerAccounts === 'object') {
    providersCount = Object.keys(providers.providerAccounts).length;
  } else if (providers?.providers && typeof providers.providers === 'object') {
    providersCount = Object.keys(providers.providers).length;
  }

  return {
    settingsSize: settings ? JSON.stringify(settings).length : 0,
    providersCount,
    channelsCount,
    skillsCount,
    chatSessionsCount,
    agentsCount,
    hasBackgroundImage: !!(settings?.backgroundImage),
  };
}
