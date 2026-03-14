/**
 * OpenClaw Package Update Utilities
 * Checks for updates from npm registry and handles in-place package updates.
 *
 * Update strategy:
 * - Downloads the npm tarball for the latest version
 * - Extracts core files (dist/, assets/, skills/, openclaw.mjs, etc.)
 * - Preserves the existing flattened node_modules (dependencies)
 * - Detects dependency changes between old and new package.json
 * - When new/changed dependencies are found, runs npm install --production
 *   to ensure all required packages are available
 */
import { net, BrowserWindow } from 'electron';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  copyFileSync,
  readdirSync,
  readFileSync,
  statSync,
  renameSync,
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

/**
 * Read the dependencies (and optionally peerDependencies) from a package.json.
 * Returns a flat record of name→version, or an empty object on failure.
 */
function readPackageDeps(pkgJsonPath: string): Record<string, string> {
  try {
    const raw = readFileSync(pkgJsonPath, 'utf-8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
    };
    return pkg.dependencies ?? {};
  } catch {
    return {};
  }
}

/**
 * Detect whether the new package.json has dependencies that are missing
 * or have changed version compared to the old one.
 */
function hasDependencyChanges(
  oldDeps: Record<string, string>,
  newDeps: Record<string, string>,
): boolean {
  for (const [name, version] of Object.entries(newDeps)) {
    if (!oldDeps[name] || oldDeps[name] !== version) {
      return true;
    }
  }
  return false;
}

/**
 * Run `npm install --production` in the given directory to ensure all
 * dependencies declared in package.json are present in node_modules.
 * Uses process.execPath with ELECTRON_RUN_AS_NODE for packaged apps
 * where npm may not be in PATH.
 */
function installDependencies(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Try npm first, fall back to npx, finally fall back to node-based install
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const cmd = `"${npmCmd}" install --production --no-audit --no-fund`;

    logger.info(`[openclaw-update] Running dependency install in ${cwd}`);
    exec(cmd, { cwd, timeout: 120_000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        logger.warn(`[openclaw-update] npm install failed, stderr: ${stderr}`);
        reject(error);
      } else {
        logger.info(`[openclaw-update] npm install completed successfully`);
        if (stdout) logger.debug(`[openclaw-update] npm stdout: ${stdout.trim()}`);
        resolve();
      }
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

    // ── Phase 4: Install (copy core files, handle dependency changes) ─────
    emit({ phase: 'installing', percent: 0, message: 'Installing update...' });

    const openclawDir = getOpenClawDir();
    const packageDir = join(extractDir, 'package');

    // Snapshot old dependencies before overwriting package.json
    const oldPkgJsonPath = join(openclawDir, 'package.json');
    const oldDeps = readPackageDeps(oldPkgJsonPath);
    const newPkgJsonPath = join(packageDir, 'package.json');
    const newDeps = readPackageDeps(newPkgJsonPath);
    const depsChanged = hasDependencyChanges(oldDeps, newDeps);

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
          // On Windows, rmSync can fail with ENOTEMPTY/EBUSY when files are
          // locked by the Gateway or other processes.  Attempt a rename-first
          // strategy: move the old directory out of the way, copy the new
          // content, then best-effort cleanup the renamed directory.
          const trashPath = `${destPath}.__old_${Date.now()}`;
          let removed = false;
          try {
            renameSync(destPath, trashPath);
            removed = true;
          } catch {
            // Rename failed (e.g. cross-volume or locked).  Fall back to
            // direct removal with a lenient catch.
            try {
              rmSync(destPath, { recursive: true, force: true });
              removed = true;
            } catch (rmErr) {
              // Could not remove — we'll overwrite via merge copy instead.
              logger.warn(
                `[openclaw-update] Could not remove ${entry}, will merge-copy: ${rmErr}`,
              );
            }
          }
          // Best-effort cleanup of the renamed-away directory
          if (removed) {
            try {
              rmSync(trashPath, { recursive: true, force: true });
            } catch {
              /* ignore – OS will clean up eventually */
            }
          }
        }
        copyDirRecursive(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }

      const percent = Math.round(((i + 1) / totalEntries) * 100);
      emit({ phase: 'installing', percent, message: `Installing: ${entry}` });
    }

    // ── Phase 5: Install dependencies if needed ──────────────────────────
    if (depsChanged) {
      const addedOrChanged = Object.entries(newDeps)
        .filter(([name, ver]) => !oldDeps[name] || oldDeps[name] !== ver)
        .map(([name, ver]) => `${name}@${ver}`);
      logger.info(
        `[openclaw-update] Dependencies changed (${addedOrChanged.join(', ')}), running npm install...`,
      );
      emit({
        phase: 'installing',
        percent: 90,
        message: 'Installing new dependencies...',
      });
      try {
        await installDependencies(openclawDir);
        emit({
          phase: 'installing',
          percent: 100,
          message: 'Dependencies installed successfully',
        });
      } catch (depError) {
        const depMsg = depError instanceof Error ? depError.message : String(depError);
        logger.error(`[openclaw-update] Dependency install failed: ${depMsg}`);
        // Don't fail the entire update — the core files are already updated.
        // Log the issue and let the user know they may need manual intervention.
        emit({
          phase: 'installing',
          percent: 95,
          message: `Warning: dependency install failed (${depMsg}). Gateway may need manual npm install.`,
        });
      }
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
