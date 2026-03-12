/**
 * Path Utilities
 * Cross-platform path resolution helpers
 */
import { app } from 'electron';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'fs';
import { logger } from './logger';
import {
  isPortableMode,
  getPortableDataDir,
  getPortableOpenClawConfigDir,
  getPortableClawPlusConfigDir,
  getPortableLogsDir,
} from './portable';

export {
  quoteForCmd,
  needsWinShell,
  prepareWinSpawn,
  normalizeNodeRequirePathForNodeOptions,
  appendNodeRequireToNodeOptions,
} from './win-shell';

/**
 * Expand ~ to home directory.
 * In portable mode, ~ expands to the portable data directory so that
 * workspace paths like `~/.openclaw/agents/...` resolve correctly.
 */
export function expandPath(path: string): string {
  if (path.startsWith('~')) {
    if (isPortableMode()) {
      return path.replace('~', getPortableDataDir());
    }
    return path.replace('~', homedir());
  }
  return path;
}

/**
 * Get OpenClaw config directory
 * In portable mode this resolves to <LocalData>/.openclaw
 */
export function getOpenClawConfigDir(): string {
  if (isPortableMode()) return getPortableOpenClawConfigDir();
  return join(homedir(), '.openclaw');
}

/**
 * Get OpenClaw skills directory
 */
export function getOpenClawSkillsDir(): string {
  return join(getOpenClawConfigDir(), 'skills');
}

/**
 * Get ClawPlus config directory
 * In portable mode this resolves to <LocalData>/.clawx
 */
export function getClawPlusConfigDir(): string {
  if (isPortableMode()) return getPortableClawPlusConfigDir();
  return join(homedir(), '.clawx');
}

/**
 * Get ClawPlus logs directory
 * In portable mode this resolves to <LocalData>/logs
 */
export function getLogsDir(): string {
  if (isPortableMode()) return getPortableLogsDir();
  return join(app.getPath('userData'), 'logs');
}

/**
 * Get ClawPlus data directory
 */
export function getDataDir(): string {
  return app.getPath('userData');
}

/**
 * Ensure directory exists
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get resources directory (for bundled assets)
 */
export function getResourcesDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources');
  }
  return join(__dirname, '../../resources');
}

/**
 * Get preload script path
 */
export function getPreloadPath(): string {
  return join(__dirname, '../preload/index.js');
}

/**
 * Get OpenClaw package directory
 * - Production (packaged): from resources/openclaw (copied by electron-builder extraResources)
 * - Development: prefers build/openclaw when it exists and carries a newer
 *   version than node_modules/openclaw, so dev always runs the latest bundled
 *   runtime (e.g. forward-compat model support).
 */
export function getOpenClawDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'openclaw');
  }

  const nodeModulesDir = join(__dirname, '../../node_modules/openclaw');
  const buildDir = join(__dirname, '../../build/openclaw');

  // Prefer build/openclaw if it exists and has a newer (or equal) version.
  if (existsSync(join(buildDir, 'openclaw.mjs'))) {
    const buildVer = readPackageVersion(join(buildDir, 'package.json'));
    const nmVer = readPackageVersion(join(nodeModulesDir, 'package.json'));
    if (buildVer && (!nmVer || buildVer >= nmVer)) {
      return buildDir;
    }
  }

  return nodeModulesDir;
}

/** Read the `version` field from a package.json, or return undefined. */
function readPackageVersion(pkgPath: string): string | undefined {
  try {
    const raw = readFileSync(pkgPath, 'utf-8');
    const data = JSON.parse(raw) as { version?: string };
    return data.version;
  } catch {
    return undefined;
  }
}

/**
 * Get OpenClaw package directory resolved to a real path.
 * Useful when consumers need deterministic module resolution under pnpm symlinks.
 */
export function getOpenClawResolvedDir(): string {
  const dir = getOpenClawDir();
  if (!existsSync(dir)) {
    return dir;
  }
  try {
    return realpathSync(dir);
  } catch {
    return dir;
  }
}

/**
 * Get OpenClaw entry script path (openclaw.mjs)
 */
export function getOpenClawEntryPath(): string {
  return join(getOpenClawDir(), 'openclaw.mjs');
}

/**
 * Get ClawHub CLI entry script path (clawdhub.js)
 */
export function getClawHubCliEntryPath(): string {
  return join(app.getAppPath(), 'node_modules', 'clawhub', 'bin', 'clawdhub.js');
}

/**
 * Get ClawHub CLI binary path (node_modules/.bin)
 */
export function getClawHubCliBinPath(): string {
  const binName = process.platform === 'win32' ? 'clawhub.cmd' : 'clawhub';
  return join(app.getAppPath(), 'node_modules', '.bin', binName);
}

/**
 * Check if OpenClaw package exists
 */
export function isOpenClawPresent(): boolean {
  const dir = getOpenClawDir();
  const pkgJsonPath = join(dir, 'package.json');
  return existsSync(dir) && existsSync(pkgJsonPath);
}

/**
 * Check if OpenClaw is built (has dist folder)
 * For the npm package, this should always be true since npm publishes the built dist.
 */
export function isOpenClawBuilt(): boolean {
  const dir = getOpenClawDir();
  const distDir = join(dir, 'dist');
  const hasDist = existsSync(distDir);
  return hasDist;
}

/**
 * Get OpenClaw status for environment check
 */
export interface OpenClawStatus {
  packageExists: boolean;
  isBuilt: boolean;
  entryPath: string;
  dir: string;
  version?: string;
}

export function getOpenClawStatus(): OpenClawStatus {
  const dir = getOpenClawDir();
  let version: string | undefined;

  // Try to read version from package.json
  try {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      version = pkg.version;
    }
  } catch {
    // Ignore version read errors
  }

  const status: OpenClawStatus = {
    packageExists: isOpenClawPresent(),
    isBuilt: isOpenClawBuilt(),
    entryPath: getOpenClawEntryPath(),
    dir,
    version,
  };

  logger.info('OpenClaw status:', status);
  return status;
}
