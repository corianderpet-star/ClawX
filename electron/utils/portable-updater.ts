/**
 * Portable Update Logic
 *
 * Provides update mechanism for portable/USB installations where the
 * standard NSIS installer-based update (`electron-updater` → `quitAndInstall()`)
 * cannot be used because the NSIS installer would write to a registry-based
 * install location rather than the current USB drive directory.
 *
 * Flow:
 *   1. Version check → reuses `electron-updater`'s `checkForUpdates()` as-is
 *   2. Download      → fetches the portable `.zip` artifact from the same CDN
 *   3. Extract       → PowerShell `Expand-Archive` into a staging directory
 *   4. Apply         → spawns a detached `.cmd` script that waits for the app
 *                       to exit, `robocopy`s new files over old ones (preserving
 *                       `LocalData/` and `.portable`), then restarts the app.
 *
 * The UI (renderer) does NOT need any changes — the `AppUpdater` class in
 * `updater.ts` delegates to these functions when `isPortableMode()` is true,
 * emitting the same status / progress events.
 */

import { app, net } from 'electron';
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  statSync,
  createWriteStream,
} from 'fs';
import { join } from 'path';
import { execSync, spawn } from 'child_process';
import { getPortableRoot, getPortableDataDir } from './portable';
import { logger } from './logger';
import { setQuitting } from '../main/app-state';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base CDN URL (same as updater.ts) */
const OSS_BASE_URL = 'http://zgonline.top';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectChannel(version: string): string {
  const match = version.match(/-([a-zA-Z]+)/);
  return match ? match[1] : 'latest';
}

function getStagingDir(): string {
  return join(getPortableDataDir(), 'update-staging');
}

/** Build the portable zip filename that electron-builder produces. */
function getZipFileName(version: string): string {
  const archSuffix = process.arch === 'arm64' ? 'arm64' : 'x64';
  return `ClawPlus-${version}-win-${archSuffix}.zip`;
}

/** Full download URL for the portable zip on the CDN. */
function getZipUrl(version: string): string {
  const channel = detectChannel(version);
  return `${OSS_BASE_URL}/${channel}/${getZipFileName(version)}`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Path to the extracted update, set after a successful download+extract. */
let _extractedDir: string | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PortableProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

/**
 * Download and extract the portable update zip.
 *
 * @param version  Target version string (e.g. "0.1.24-alpha.14")
 * @param onProgress  Progress callback, compatible with electron-updater ProgressInfo
 */
export async function downloadPortableUpdate(
  version: string,
  onProgress?: (progress: PortableProgress) => void,
): Promise<string> {
  const url = getZipUrl(version);
  const stagingDir = getStagingDir();

  logger.info(`[PortableUpdater] Downloading portable update: ${url}`);

  // Clean previous staging
  if (existsSync(stagingDir)) {
    rmSync(stagingDir, { recursive: true, force: true });
  }
  mkdirSync(stagingDir, { recursive: true });

  const zipPath = join(stagingDir, getZipFileName(version));

  // ── Step 1: Download ──────────────────────────────────────────
  await downloadFile(url, zipPath, onProgress);

  const zipSize = statSync(zipPath).size;
  logger.info(`[PortableUpdater] Download complete: ${formatSize(zipSize)}`);

  // ── Step 2: Extract ───────────────────────────────────────────
  const extractDir = join(stagingDir, 'extracted');
  mkdirSync(extractDir, { recursive: true });

  logger.info(`[PortableUpdater] Extracting to: ${extractDir}`);

  try {
    // PowerShell 5.1+ Expand-Archive is available on Windows 10+
    execSync(
      `powershell -NoProfile -NonInteractive -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${extractDir}' -Force"`,
      { windowsHide: true, timeout: 600_000 }, // 10 min timeout for large zips
    );
  } catch (err) {
    logger.error('[PortableUpdater] Extraction failed:', err);
    throw new Error(`Failed to extract update archive: ${err}`);
  }

  // Verify the extraction produced a valid app directory
  if (!existsSync(join(extractDir, 'ClawPlus.exe'))) {
    throw new Error('Extracted update does not contain ClawPlus.exe — the zip may be corrupt.');
  }

  // Free disk space by removing the zip (extracted files are enough)
  try {
    rmSync(zipPath, { force: true });
  } catch { /* best-effort */ }

  _extractedDir = extractDir;
  logger.info('[PortableUpdater] Update ready to install.');

  return extractDir;
}

/**
 * Apply the previously downloaded update and restart.
 *
 * Spawns a detached `.cmd` script that:
 *   1. Waits for `ClawPlus.exe` to exit.
 *   2. Uses `robocopy /E /XD LocalData /XF .portable` to mirror new files.
 *   3. Launches the new `ClawPlus.exe`.
 *   4. Cleans up the staging directory.
 */
export function applyPortableUpdate(): void {
  if (!_extractedDir || !existsSync(_extractedDir)) {
    throw new Error('No extracted update available. Call downloadPortableUpdate() first.');
  }

  const appRoot = getPortableRoot();
  const stagingDir = getStagingDir();

  logger.info(`[PortableUpdater] Applying update: ${_extractedDir} → ${appRoot}`);

  // Write the update script
  const scriptContent = generateUpdateScript(_extractedDir, appRoot, stagingDir);
  const scriptPath = join(stagingDir, 'apply-update.cmd');
  writeFileSync(scriptPath, scriptContent, 'utf-8');

  // Spawn detached so it survives our process exit
  const child = spawn('cmd.exe', ['/c', scriptPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    cwd: stagingDir,
  });
  child.unref();

  // Exit the application
  setQuitting();
  app.quit();
}

/**
 * Whether a portable update has been downloaded and extracted, ready to install.
 */
export function hasPortableUpdateReady(): boolean {
  return !!_extractedDir && existsSync(join(_extractedDir, 'ClawPlus.exe'));
}

/**
 * Clean up leftover staging files (e.g. after a failed download or on app start).
 */
export function cleanupStaging(): void {
  const stagingDir = getStagingDir();
  if (existsSync(stagingDir)) {
    try {
      rmSync(stagingDir, { recursive: true, force: true });
      logger.info('[PortableUpdater] Cleaned up staging directory.');
    } catch (err) {
      logger.warn('[PortableUpdater] Failed to clean staging:', err);
    }
  }
  _extractedDir = null;
}

// ---------------------------------------------------------------------------
// Internal: HTTP download with progress
// ---------------------------------------------------------------------------

function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (progress: PortableProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const request = net.request({ url, method: 'GET' });

    request.on('response', (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        reject(new Error(`Download failed: HTTP ${response.statusCode}`));
        return;
      }

      const contentLength = response.headers['content-length'];
      const totalSize = contentLength
        ? parseInt(Array.isArray(contentLength) ? contentLength[0] : contentLength, 10)
        : 0;
      let downloaded = 0;

      const fileStream = createWriteStream(destPath);

      response.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        fileStream.write(chunk);

        if (onProgress && totalSize > 0) {
          const elapsed = (Date.now() - startTime) / 1000 || 1;
          onProgress({
            percent: Math.min(99, Math.round((downloaded / totalSize) * 100)),
            bytesPerSecond: Math.round(downloaded / elapsed),
            transferred: downloaded,
            total: totalSize,
          });
        }
      });

      response.on('end', () => {
        fileStream.end(() => resolve());
      });

      response.on('error', (err: Error) => {
        fileStream.destroy();
        reject(err);
      });
    });

    request.on('error', (err: Error) => {
      reject(err);
    });

    request.end();
  });
}

// ---------------------------------------------------------------------------
// Internal: Update script generation
// ---------------------------------------------------------------------------

function generateUpdateScript(
  extractDir: string,
  appRoot: string,
  stagingDir: string,
): string {
  // Normalise paths for CMD (forward slashes → backslashes)
  const src = extractDir.replace(/\//g, '\\');
  const dst = appRoot.replace(/\//g, '\\');
  const stg = stagingDir.replace(/\//g, '\\');

  return `@echo off
chcp 65001 > nul 2>&1
title ClawPlus Portable Update

echo =============================================
echo   ClawPlus Portable Update
echo =============================================
echo.
echo Waiting for ClawPlus to exit...

:waitloop
tasklist /FI "IMAGENAME eq ClawPlus.exe" 2>nul | find /i "ClawPlus.exe" > nul
if "%errorlevel%"=="0" (
    timeout /t 1 /nobreak > nul
    goto waitloop
)

echo ClawPlus has exited. Applying update...
echo.

:: robocopy mirrors new files into the app directory.
::   /E   = include subdirectories (including empty)
::   /XD  = exclude directories — preserve user data & portable marker
::   /XF  = exclude files       — preserve portable marker & readme
::   /R:3 = retry 3 times   /W:1 = wait 1 s between retries
robocopy "${src}" "${dst}" /E /XD "LocalData" /XF ".portable" "README-portable.txt" "portable.dat" /R:3 /W:1 /NFL /NDL /NJH /NJS

:: robocopy exit codes 0-7 are all success; 8+ means error.
if %errorlevel% GEQ 8 (
    echo.
    echo ERROR: File copy failed ^(exit code %errorlevel%^).
    echo The update was NOT applied. Please try updating again.
    echo.
    pause
    exit /b 1
)

echo.
echo Update applied successfully!
echo Starting ClawPlus...

start "" "${dst}\\ClawPlus.exe"

:: Give the app a moment to start, then clean up staging
timeout /t 5 /nobreak > nul
rd /s /q "${stg}" 2>nul

exit /b 0
`;
}
