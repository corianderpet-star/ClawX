/**
 * Path Utilities
 * Cross-platform path resolution helpers
 */
import { app } from 'electron';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'fs';
import { logger } from './logger';

export {
  quoteForCmd,
  needsWinShell,
  prepareWinSpawn,
  normalizeNodeRequirePathForNodeOptions,
  appendNodeRequireToNodeOptions,
} from './win-shell';

/**
 * Expand ~ to home directory
 */
export function expandPath(path: string): string {
  if (path.startsWith('~')) {
    return path.replace('~', homedir());
  }
  return path;
}

/**
 * Get OpenClaw config directory
 */
export function getOpenClawConfigDir(): string {
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
 */
export function getClawPlusConfigDir(): string {
  return join(homedir(), '.clawx');
}

/**
 * Get ClawPlus logs directory
 */
export function getLogsDir(): string {
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
      // Verify dist file integrity — after pnpm updates node_modules/openclaw,
      // build/openclaw may hold a stale mix of old chunk files and a new entry.js.
      // If critical imports are missing, fall back to node_modules.
      if (isDistIntact(buildDir)) {
        return buildDir;
      }
      logger.warn(
        '[paths] build/openclaw dist integrity check failed (chunk files missing), ' +
          'falling back to node_modules/openclaw. Run "pnpm run build" or ' +
          '"zx scripts/bundle-openclaw.mjs" to rebuild.',
      );
    }
  }

  return nodeModulesDir;
}

/**
 * Light-weight integrity check for the bundled openclaw dist/ directory.
 * Reads the first few import specifiers from dist/entry.js and verifies the
 * referenced chunk files actually exist on disk. Returns false when the dist
 * directory contains a mismatch of old and new build artefacts.
 */
function isDistIntact(openclawDir: string): boolean {
  const entryPath = join(openclawDir, 'dist', 'entry.js');
  if (!existsSync(entryPath)) return false;
  try {
    const content = readFileSync(entryPath, 'utf-8');
    // Match relative import specifiers: from "./chunk-HASH.js"
    const importRegex = /from\s+["']\.\/([^"']+)["']/g;
    let match: RegExpExecArray | null;
    let checked = 0;
    while ((match = importRegex.exec(content)) !== null && checked < 5) {
      const importedFile = match[1];
      if (!existsSync(join(openclawDir, 'dist', importedFile))) {
        logger.debug(`[paths] dist integrity: missing ${importedFile}`);
        return false;
      }
      checked++;
    }
    return checked > 0; // entry.js must import at least one chunk
  } catch {
    return false;
  }
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
