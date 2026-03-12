/**
 * OpenClaw Package Updater
 *
 * Checks for the latest version of the OpenClaw package on npm
 * and downloads/installs it if the bundled version is outdated.
 *
 * All heavy I/O (tar parsing, file copy) is made async with periodic
 * `setImmediate` yields so the Electron main-process event loop stays
 * responsive and the renderer never appears "Not Responding".
 */
import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, rmSync, renameSync, readdirSync, copyFileSync, statSync, createReadStream, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import https from 'https';
import http from 'http';
import { createGunzip } from 'zlib';
import { logger } from '../utils/logger';
import { getOpenClawDir, getOpenClawStatus } from '../utils/paths';
import { isRegionOptimizedSync } from '../utils/uv-env';

/** npm registry URLs */
const NPM_REGISTRY = 'https://registry.npmjs.org';
const NPM_MIRROR_REGISTRY = 'https://registry.npmmirror.com';

export interface VersionCheckResult {
  currentVersion: string | undefined;
  latestVersion: string | undefined;
  isLatest: boolean;
  updateAvailable: boolean;
  error?: string;
}

export interface UpdateResult {
  success: boolean;
  oldVersion: string | undefined;
  newVersion: string | undefined;
  error?: string;
}

/** Progress info sent to the renderer during OpenClaw update. */
export interface UpdateProgress {
  stage: 'downloading' | 'extracting' | 'installing' | 'cleanup' | 'done';
  percent: number; // 0-100
  message: string;
  bytesDownloaded?: number;
  bytesTotal?: number;
  /** Detailed log line appended to the scrollable log area. */
  log?: string;
}

export type UpdateProgressCallback = (progress: UpdateProgress) => void;

/**
 * Choose the npm registry based on region.
 * Chinese users get the npmmirror to avoid network issues.
 */
function getNpmRegistryUrl(): string {
  try {
    if (isRegionOptimizedSync()) {
      return NPM_MIRROR_REGISTRY;
    }
  } catch {
    // fallback
  }
  return NPM_REGISTRY;
}

/**
 * Fetch JSON from a URL (follows redirects).
 */
function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 15000 }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJson(res.headers.location).then(resolve, reject);
        res.resume();
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        return;
      }
      let body = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('Request timeout')); });
  });
}

/**
 * Download a file from URL to a local path (follows redirects).
 * Optionally reports download progress via `onProgress(downloadedBytes, totalBytes)`.
 */
function downloadFile(
  url: string,
  dest: string,
  onProgress?: (downloaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, dest, onProgress).then(resolve, reject);
        res.resume();
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
        return;
      }
      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;

      // Track progress on each incoming chunk
      if (onProgress && totalBytes > 0) {
        res.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length;
          onProgress(downloadedBytes, totalBytes);
        });
      }

      const { createWriteStream } = require('fs') as typeof import('fs');
      const fileStream = createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => { fileStream.close(); resolve(); });
      fileStream.on('error', (err) => { fileStream.close(); reject(err); });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('Download timeout')); });
  });
}

/**
 * Compare two semver-like version strings.
 * Returns: -1 if a < b, 0 if equal, 1 if a > b.
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(Number);
  const partsB = b.replace(/^v/, '').split('.').map(Number);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const pa = partsA[i] ?? 0;
    const pb = partsB[i] ?? 0;
    if (pa < pb) return -1;
    if (pa > pb) return 1;
  }
  return 0;
}

/**
 * Check the latest version of OpenClaw available on npm.
 */
export async function checkLatestOpenClawVersion(): Promise<VersionCheckResult> {
  const status = getOpenClawStatus();
  const currentVersion = status.version;

  try {
    const registryUrl = getNpmRegistryUrl();
    const url = `${registryUrl}/openclaw/latest`;
    logger.info(`Checking latest OpenClaw version from ${url}`);

    const data = await fetchJson(url) as { version?: string };
    const latestVersion = data?.version;

    if (!latestVersion) {
      return {
        currentVersion,
        latestVersion: undefined,
        isLatest: true, // Assume latest if we can't determine
        updateAvailable: false,
        error: 'Could not determine latest version from registry',
      };
    }

    const isLatest = currentVersion ? compareVersions(currentVersion, latestVersion) >= 0 : false;

    logger.info(
      `OpenClaw version check: current=${currentVersion || 'unknown'}, latest=${latestVersion}, isLatest=${isLatest}`,
    );

    return {
      currentVersion,
      latestVersion,
      isLatest,
      updateAvailable: !isLatest,
    };
  } catch (error) {
    logger.warn('Failed to check latest OpenClaw version:', error);
    return {
      currentVersion,
      latestVersion: undefined,
      isLatest: true, // Assume latest on error to not block the user
      updateAvailable: false,
      error: String(error),
    };
  }
}

/**
 * Download and install the latest OpenClaw package.
 * Accepts an optional progress callback so the renderer can show a progress bar.
 */
export async function updateOpenClawPackage(onProgress?: UpdateProgressCallback): Promise<UpdateResult> {
  const status = getOpenClawStatus();
  const oldVersion = status.version;
  const openclawDir = getOpenClawDir();

  const report = (stage: UpdateProgress['stage'], percent: number, message: string, extra?: Partial<UpdateProgress>) => {
    onProgress?.({ stage, percent, message, ...extra });
  };

  try {
    // 1. Fetch package metadata to get tarball URL
    const registryUrl = getNpmRegistryUrl();
    const metaUrl = `${registryUrl}/openclaw/latest`;
    logger.info(`Fetching OpenClaw package metadata from ${metaUrl}`);
    report('downloading', 0, 'Fetching package info…', { log: `Registry: ${metaUrl}` });

    const meta = await fetchJson(metaUrl) as {
      version?: string;
      dist?: { tarball?: string; integrity?: string };
    };

    const latestVersion = meta?.version;
    const tarballUrl = meta?.dist?.tarball;

    if (!latestVersion || !tarballUrl) {
      return {
        success: false,
        oldVersion,
        newVersion: undefined,
        error: 'Could not get package tarball URL from registry',
      };
    }

    // If already on the latest, skip
    if (oldVersion && compareVersions(oldVersion, latestVersion) >= 0) {
      logger.info(`OpenClaw is already up to date (${oldVersion})`);
      report('done', 100, 'Already up to date');
      return {
        success: true,
        oldVersion,
        newVersion: oldVersion,
      };
    }

    logger.info(`Updating OpenClaw from ${oldVersion || 'unknown'} to ${latestVersion}`);

    // 2. Download tarball to temp location
    const tempDir = join(app.getPath('temp'), 'openclaw-update');
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    mkdirSync(tempDir, { recursive: true });

    const tarballPath = join(tempDir, 'openclaw.tgz');
    logger.info(`Downloading OpenClaw tarball from ${tarballUrl}`);
    report('downloading', 2, 'Downloading…', { log: `Tarball URL: ${tarballUrl}` });

    await downloadFile(tarballUrl, tarballPath, (downloaded, total) => {
      const pct = Math.round((downloaded / total) * 60); // download = 0-60%
      const dlMB = (downloaded / 1048576).toFixed(1);
      const totalMB = (total / 1048576).toFixed(1);
      report('downloading', pct, `Downloading ${dlMB}/${totalMB} MB`, {
        bytesDownloaded: downloaded,
        bytesTotal: total,
      });
    });

    report('extracting', 62, 'Extracting package…', { log: 'Download complete, extracting tarball…' });

    // 3. Extract tarball using Node.js built-in zlib + async tar parser
    const extractDir = join(tempDir, 'extracted');
    mkdirSync(extractDir, { recursive: true });

    try {
      await extractTgz(tarballPath, extractDir);
    } catch (tarError) {
      throw new Error(`Failed to extract tarball: ${tarError}`);
    }

    report('extracting', 72, 'Verifying package…', { log: 'Verifying extracted package…' });

    // npm tarballs extract to a 'package/' subdirectory
    const packageDir = join(extractDir, 'package');
    if (!existsSync(packageDir)) {
      throw new Error('Extracted tarball does not contain a "package" directory');
    }

    // 4. Verify the extracted package
    const newPkgJsonPath = join(packageDir, 'package.json');
    if (!existsSync(newPkgJsonPath)) {
      throw new Error('Extracted package missing package.json');
    }
    const newPkg = JSON.parse(readFileSync(newPkgJsonPath, 'utf-8'));
    if (newPkg.version !== latestVersion) {
      logger.warn(
        `Version mismatch: expected ${latestVersion}, got ${newPkg.version}`,
      );
    }

    report('installing', 75, 'Installing update…', { log: `Package verified: v${newPkg.version}` });

    // 5. Overlay new package files onto existing openclawDir.
    //    CRITICAL: preserve node_modules — the npm tarball only contains
    //    openclaw source (~few MB), not the 400MB+ dependency tree that was
    //    bundled at build time.  Replacing the whole dir would lose all deps.
    mkdirSync(openclawDir, { recursive: true });

    const overlayCount = await overlayDirAsync(
      packageDir,
      openclawDir,
      ['node_modules'], // dirs to skip in destination
      (filePath, copied) => {
        if (copied % 20 === 0) {
          const pct = 75 + Math.min(20, Math.round((copied / 200) * 20)); // 75-95%
          report('installing', pct, `Copying files… (${copied})`, { log: filePath });
        }
      },
    );

    report('cleanup', 95, 'Cleaning up…', { log: `Overlay complete: ${overlayCount} files updated` });
    logger.info(`Overlay complete: ${overlayCount} files updated in ${openclawDir}`);

    // 6. Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }

    logger.info(`OpenClaw updated successfully: ${oldVersion || 'unknown'} → ${latestVersion}`);
    report('done', 100, `Updated to v${latestVersion}`);

    return {
      success: true,
      oldVersion,
      newVersion: latestVersion,
    };
  } catch (error) {
    logger.error('Failed to update OpenClaw package:', error);
    report('done', 0, `Update failed: ${error}`, { log: `ERROR: ${error}` });

    return {
      success: false,
      oldVersion,
      newVersion: undefined,
      error: String(error),
    };
  }
}

/**
 * Overlay files from src onto dest, skipping specified directories in dest.
 * Returns the number of files copied.  Yields to the event loop periodically.
 *
 * This is used to update openclaw source files WITHOUT touching the bundled
 * node_modules directory (which is 400 MB+ and unchanged by minor updates).
 */
async function overlayDirAsync(
  src: string,
  dest: string,
  skipDirs: string[] = [],
  onFile?: (relativePath: string, totalCopied: number) => void,
): Promise<number> {
  let totalCopied = 0;

  async function walk(srcDir: string, destDir: string, relBase: string): Promise<void> {
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    const entries = readdirSync(srcDir);
    for (const entry of entries) {
      // Never overwrite protected directories already in dest
      if (skipDirs.includes(entry) && existsSync(join(destDir, entry))) {
        continue;
      }
      const srcPath = join(srcDir, entry);
      const destPath = join(destDir, entry);
      const relPath = relBase ? `${relBase}/${entry}` : entry;
      const st = statSync(srcPath);
      if (st.isDirectory()) {
        await walk(srcPath, destPath, relPath);
      } else {
        copyFileSync(srcPath, destPath);
        totalCopied++;
        onFile?.(relPath, totalCopied);
      }
      // Yield every 40 files to keep UI responsive
      if (totalCopied % 40 === 0) {
        await new Promise<void>((r) => setImmediate(r));
      }
    }
  }

  await walk(src, dest, '');
  return totalCopied;
}

// ---------------------------------------------------------------------------
// Minimal tar.gz extraction using only Node.js built-ins (zlib + raw tar parsing)
// This avoids spawning `tar` / `cmd.exe` which can ETIMEDOUT on portable installs.
// ---------------------------------------------------------------------------

/**
 * Extract a .tgz (gzipped tar) archive to a destination directory.
 * Uses Node.js streams: createReadStream → createGunzip → async tar block parser.
 */
function extractTgz(tgzPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    const input = createReadStream(tgzPath);
    const chunks: Buffer[] = [];

    input.pipe(gunzip);

    gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
    gunzip.on('error', (err) => reject(new Error(`Gunzip failed: ${err.message}`)));
    gunzip.on('end', () => {
      const tarData = Buffer.concat(chunks);
      parseTarAsync(tarData, destDir).then(resolve, reject);
    });
    input.on('error', (err) => reject(new Error(`Read failed: ${err.message}`)));
  });
}

/**
 * Minimal POSIX/UStar tar parser (async version).
 * Handles regular files and directories — sufficient for npm package tarballs.
 * Yields to the event loop every 50 entries to keep the main process responsive.
 */
async function parseTarAsync(data: Buffer, destDir: string): Promise<void> {
  let offset = 0;
  const BLOCK = 512;
  let entriesProcessed = 0;

  while (offset + BLOCK <= data.length) {
    // An all-zero 512-byte block signals end of archive
    const header = data.subarray(offset, offset + BLOCK);
    if (header.every((b) => b === 0)) break;

    // File name (0–100)
    const rawName = header.subarray(0, 100).toString('utf-8').replace(/\0+$/, '');
    // Prefix for USTAR (345–500)
    const prefix = header.subarray(345, 500).toString('utf-8').replace(/\0+$/, '');
    const name = prefix ? `${prefix}/${rawName}` : rawName;

    // File size in octal (124–136)
    const sizeStr = header.subarray(124, 136).toString('utf-8').replace(/\0+$/, '').trim();
    const size = parseInt(sizeStr, 8) || 0;

    // Type flag (156)
    const typeflag = String.fromCharCode(header[156]);

    const fullPath = join(destDir, name);

    if (typeflag === '5' || name.endsWith('/')) {
      // Directory
      mkdirSync(fullPath, { recursive: true });
    } else if (typeflag === '0' || typeflag === '\0') {
      // Regular file
      mkdirSync(dirname(fullPath), { recursive: true });
      const fileData = data.subarray(offset + BLOCK, offset + BLOCK + size);
      writeFileSync(fullPath, fileData);
    }
    // Skip other types (symlinks, etc.) — npm tarballs don't use them

    // Advance past the header + ceil(size / 512) data blocks
    const dataBlocks = Math.ceil(size / BLOCK);
    offset += BLOCK + dataBlocks * BLOCK;

    // Yield to event loop periodically to keep the app responsive
    entriesProcessed++;
    if (entriesProcessed % 50 === 0) {
      await new Promise<void>((r) => setImmediate(r));
    }
  }
}
