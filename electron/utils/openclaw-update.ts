/**
 * OpenClaw Package Update Utilities
 * Checks for updates from npm registry and handles in-place package updates.
 *
 * Update strategy:
 * - Downloads the npm tarball for the latest version
 * - Extracts core files (dist/, assets/, skills/, openclaw.mjs, etc.)
 * - Preserves the existing flattened node_modules (dependencies)
 * - This works for patch/minor updates; major dependency changes may require a full app update
 */
import { net, BrowserWindow } from 'electron';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  copyFileSync,
  readdirSync,
  statSync,
} from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { tmpdir } from 'os';
import { getOpenClawDir, getOpenClawStatus } from './paths';
import { logger } from './logger';

const NPM_REGISTRY_URL = 'https://registry.npmjs.org/openclaw';

// ─── Public types ───────────────────────────────────────────────────────────

export interface OpenClawUpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
}

export interface OpenClawUpdateProgress {
  phase: 'checking' | 'downloading' | 'extracting' | 'installing' | 'done' | 'error';
  percent: number;
  message: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compare two semver version strings.
 * Returns > 0 if a > b, < 0 if a < b, 0 if equal.
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(Number);
  const partsB = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
}

/**
 * Fetch JSON from a URL using Electron's net module (proxy-aware).
 */
function fetchJson(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    let data = '';

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} from ${url}`));
        return;
      }
      response.on('data', (chunk) => {
        data += chunk.toString();
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    request.on('error', reject);
    request.end();
  });
}

/**
 * Download a file with progress tracking via Electron net (proxy-aware).
 */
function downloadFile(
  url: string,
  destPath: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = net.request(url);

    request.on('response', (response) => {
      // Follow redirects (npm CDN often redirects)
      if (
        (response.statusCode === 301 || response.statusCode === 302) &&
        response.headers['location']
      ) {
        const loc = response.headers['location'];
        const target = Array.isArray(loc) ? loc[0] : loc;
        downloadFile(target, destPath, onProgress).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const clHeader = response.headers['content-length'];
      const totalSize = clHeader
        ? parseInt(Array.isArray(clHeader) ? clHeader[0] : clHeader, 10)
        : 0;
      let downloadedSize = 0;

      const fileStream = createWriteStream(destPath);

      response.on('data', (chunk) => {
        fileStream.write(chunk);
        downloadedSize += chunk.length;
        if (totalSize > 0) {
          onProgress(Math.round((downloadedSize / totalSize) * 100));
        }
      });

      response.on('end', () => {
        fileStream.end();
        fileStream.on('finish', () => resolve());
      });

      response.on('error', (err) => {
        fileStream.destroy();
        reject(err);
      });
    });

    request.on('error', reject);
    request.end();
  });
}

/**
 * Copy a directory recursively.
 */
function copyDirRecursive(src: string, dest: string): void {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Extract a .tgz archive using the system tar command.
 * tar is available on Windows 10+, macOS, and Linux by default.
 */
function extractTgz(tgzPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    const cmd =
      process.platform === 'win32'
        ? `tar -xzf "${tgzPath}" -C "${destDir}"`
        : `tar -xzf '${tgzPath}' -C '${destDir}'`;

    exec(cmd, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check for OpenClaw package updates from the npm registry.
 */
export async function checkOpenClawUpdate(): Promise<OpenClawUpdateCheckResult> {
  const status = getOpenClawStatus();
  const currentVersion = status.version || '0.0.0';

  logger.info(`[openclaw-update] Checking update, current version: ${currentVersion}`);

  try {
    const data = (await fetchJson(`${NPM_REGISTRY_URL}/latest`)) as { version: string };
    const latestVersion = data.version;
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    logger.info(
      `[openclaw-update] Latest version: ${latestVersion}, hasUpdate: ${hasUpdate}`,
    );

    return { currentVersion, latestVersion, hasUpdate };
  } catch (error) {
    logger.error('[openclaw-update] Failed to check update:', error);
    // On network errors, report no update available rather than blocking setup
    return { currentVersion, latestVersion: currentVersion, hasUpdate: false };
  }
}

/**
 * Download and install the latest OpenClaw package.
 *
 * Progress events are emitted to the callback and optionally forwarded
 * to the given BrowserWindow via the `openclaw:update-progress` IPC channel.
 */
export async function updateOpenClaw(
  onProgress: (progress: OpenClawUpdateProgress) => void,
  mainWindow?: BrowserWindow | null,
): Promise<boolean> {
  const emit = (p: OpenClawUpdateProgress) => {
    onProgress(p);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('openclaw:update-progress', p);
    }
  };

  try {
    // ── Phase 1: Fetch registry metadata ──────────────────────────────────
    emit({ phase: 'checking', percent: 0, message: 'Fetching latest version info...' });

    const data = (await fetchJson(`${NPM_REGISTRY_URL}/latest`)) as {
      version: string;
      dist: { tarball: string; shasum: string };
    };
    const latestVersion = data.version;
    const tarballUrl = data.dist.tarball;

    logger.info(
      `[openclaw-update] Updating to v${latestVersion}, tarball: ${tarballUrl}`,
    );

    // ── Phase 2: Download ─────────────────────────────────────────────────
    emit({ phase: 'downloading', percent: 0, message: `Downloading v${latestVersion}...` });

    const tempDir = join(tmpdir(), `openclaw-update-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    const tgzPath = join(tempDir, 'openclaw.tgz');

    await downloadFile(tarballUrl, tgzPath, (percent) => {
      emit({
        phase: 'downloading',
        percent,
        message: `Downloading v${latestVersion}... ${percent}%`,
      });
    });

    // ── Phase 3: Extract ──────────────────────────────────────────────────
    emit({ phase: 'extracting', percent: 0, message: 'Extracting package...' });

    const extractDir = join(tempDir, 'extracted');
    await extractTgz(tgzPath, extractDir);

    emit({ phase: 'extracting', percent: 100, message: 'Extracted successfully' });

    // ── Phase 4: Install (copy core files, preserve node_modules) ─────────
    emit({ phase: 'installing', percent: 0, message: 'Installing update...' });

    const openclawDir = getOpenClawDir();
    const packageDir = join(extractDir, 'package');

    if (!existsSync(packageDir)) {
      throw new Error('Extracted package directory not found');
    }

    const entries = readdirSync(packageDir);
    const totalEntries = entries.length;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Keep existing flattened node_modules intact
      if (entry === 'node_modules') continue;

      const srcPath = join(packageDir, entry);
      const destPath = join(openclawDir, entry);

      if (statSync(srcPath).isDirectory()) {
        if (existsSync(destPath)) {
          rmSync(destPath, { recursive: true, force: true });
        }
        copyDirRecursive(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }

      const percent = Math.round(((i + 1) / totalEntries) * 100);
      emit({ phase: 'installing', percent, message: `Installing: ${entry}` });
    }

    // ── Cleanup ───────────────────────────────────────────────────────────
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup errors */
    }

    emit({ phase: 'done', percent: 100, message: `Updated to v${latestVersion}` });
    logger.info(`[openclaw-update] Successfully updated to v${latestVersion}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[openclaw-update] Update failed:', error);
    emit({ phase: 'error', percent: 0, message: errorMessage });
    return false;
  }
}
