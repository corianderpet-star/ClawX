/**
 * Portable Mode (U盘便携版)
 *
 * Detects whether the app is running in portable mode and provides helpers to
 * resolve all data / config paths relative to the application root so that
 * everything lives on the same removable drive.
 *
 * Portable mode is activated when a marker file named `.portable` (or
 * `portable.dat`) exists next to the application executable, **or** when the
 * `CLAWPLUS_PORTABLE` environment variable is set to `1`.
 *
 * Directory layout on the USB drive:
 *
 *   E:\                             ← drive root (letter may change)
 *   └─ ClawPlus\                    ← appRootDir (= app.getAppPath() parent)
 *      ├─ ClawPlus.exe
 *      ├─ resources\
 *      │  ├─ openclaw\              ← OpenClaw runtime (extraResources)
 *      │  ├─ portable_python\       ← portable Python environment (extraResources)
 *      │  └─ bin\                   ← uv / helper binaries
 *      ├─ LocalData\                ← ALL user data lives here
 *      │  ├─ electron-userData\     ← Electron's userData (settings, caches)
 *      │  ├─ .openclaw\             ← OpenClaw config / memory / agents
 *      │  ├─ .clawx\               ← ClawPlus config
 *      │  ├─ logs\                  ← log files
 *      │  └─ secrets\               ← provider API keys (portable fallback)
 *      └─ .portable                 ← marker file (presence enables portable)
 */

import { app } from 'electron';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { logger } from './logger';

/**
 * How the portable edition was created.
 *
 * - `'dir'`  — directory build (`package:portable`), no NSIS uninstaller or
 *              registry entries.  Updates must use the `.zip` download path.
 * - `'nsis'` — NSIS installer with PORTABLE_BUILD=1 (`package:portable:nsis`).
 *              The installation has registry entries and an uninstaller, so the
 *              standard `electron-updater` NSIS update flow works as-is.
 * - `null`   — not in portable mode, or the `.portable` marker has no type tag.
 */
export type PortableInstallType = 'dir' | 'nsis' | null;

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Cached result so we only detect once per process lifetime. */
let _isPortable: boolean | null = null;
/** Cached portable root. */
let _portableRoot: string | null = null;

/**
 * Determine the "application root directory".
 *
 * - **Packaged (win-unpacked / nsis portable):** The directory that contains
 *   the main executable, e.g. `E:\ClawPlus\`.
 * - **Development:** The repository root (`process.cwd()`).
 */
function resolveAppRootDir(): string {
  if (app.isPackaged) {
    // On Windows the exe sits at e.g. E:\ClawPlus\ClawPlus.exe
    // process.resourcesPath = E:\ClawPlus\resources
    // So the app root is one level above resourcesPath.
    return dirname(process.resourcesPath);
  }
  return process.cwd();
}

/**
 * Returns `true` when the app is running in portable / USB mode.
 *
 * Detection order:
 * 1. Environment variable `CLAWPLUS_PORTABLE=1`
 * 2. Marker file `.portable` or `portable.dat` next to the executable.
 */
export function isPortableMode(): boolean {
  if (_isPortable !== null) return _isPortable;

  const appRoot = resolveAppRootDir();

  if (process.env.CLAWPLUS_PORTABLE === '1') {
    _isPortable = true;
    _portableRoot = appRoot;
    return true;
  }

  const markers = ['.portable', 'portable.dat'];
  for (const m of markers) {
    if (existsSync(join(appRoot, m))) {
      _isPortable = true;
      _portableRoot = appRoot;
      return true;
    }
  }

  _isPortable = false;
  return false;
}

/** Cached install type. */
let _installType: PortableInstallType | undefined;

/**
 * Determine how the portable installation was created.
 *
 * Reads the first line of the `.portable` marker file.  The build scripts
 * write either `dir` or `nsis` as the first line; the rest is a human
 * comment.  Returns `null` if not in portable mode or if the file does not
 * contain a recognised tag (for backward compatibility).
 */
export function getPortableInstallType(): PortableInstallType {
  if (_installType !== undefined) return _installType;
  if (!isPortableMode() || !_portableRoot) {
    _installType = null;
    return null;
  }

  for (const m of ['.portable', 'portable.dat']) {
    const markerPath = join(_portableRoot, m);
    if (existsSync(markerPath)) {
      try {
        const firstLine = readFileSync(markerPath, 'utf-8').split(/\r?\n/)[0].trim().toLowerCase();
        if (firstLine === 'dir' || firstLine === 'nsis') {
          _installType = firstLine;
          return _installType;
        }
      } catch { /* ignore read errors */ }
    }
  }

  // Fallback: older .portable files without a type tag → treat as 'dir'
  _installType = 'dir';
  return _installType;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/**
 * Get the portable application root directory.
 * Throws if called when not in portable mode.
 */
export function getPortableRoot(): string {
  if (!isPortableMode() || !_portableRoot) {
    throw new Error('getPortableRoot() called but app is not in portable mode');
  }
  return _portableRoot;
}

/**
 * The top-level data directory on the USB drive: `<appRoot>/LocalData`.
 * All mutable user data is stored under this directory so that removing the
 * drive takes everything with it.
 */
export function getPortableDataDir(): string {
  return join(getPortableRoot(), 'LocalData');
}

/** Electron's userData directory in portable mode. */
export function getPortableUserDataDir(): string {
  return join(getPortableDataDir(), 'electron-userData');
}

/** OpenClaw config directory (`~/.openclaw` equivalent). */
export function getPortableOpenClawConfigDir(): string {
  return join(getPortableDataDir(), '.openclaw');
}

/** ClawPlus config directory (`~/.clawx` equivalent). */
export function getPortableClawPlusConfigDir(): string {
  return join(getPortableDataDir(), '.clawx');
}

/** Logs directory in portable mode. */
export function getPortableLogsDir(): string {
  return join(getPortableDataDir(), 'logs');
}

/** Secrets directory (fallback when OS keychain is unavailable). */
export function getPortableSecretsDir(): string {
  return join(getPortableDataDir(), 'secrets');
}

/** Portable Python environment directory (extraResources). */
export function getPortablePythonDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'portable_python');
  }
  return join(resolveAppRootDir(), 'portable_python');
}

// ---------------------------------------------------------------------------
// Initialisation (call from main process BEFORE app.whenReady)
// ---------------------------------------------------------------------------

/**
 * Bootstrap portable mode:
 *
 * 1. Detect portable marker.
 * 2. Create `LocalData` hierarchy if missing.
 * 3. Call `app.setPath()` to redirect Electron's own data paths.
 * 4. Set `CLAWPLUS_PORTABLE_DATA` env var for child processes.
 *
 * **Must be called as early as possible** in the main process, before
 * `app.whenReady()` and before any code that reads `app.getPath('userData')`.
 */
export function initPortableMode(): boolean {
  if (!isPortableMode()) {
    return false;
  }

  const dataDir = getPortableDataDir();
  const userDataDir = getPortableUserDataDir();
  const openclawDir = getPortableOpenClawConfigDir();
  const clawxDir = getPortableClawPlusConfigDir();
  const logsDir = getPortableLogsDir();
  const secretsDir = getPortableSecretsDir();

  // Ensure all directories exist
  for (const dir of [dataDir, userDataDir, openclawDir, clawxDir, logsDir, secretsDir]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Redirect Electron built-in paths
  app.setPath('userData', userDataDir);
  app.setPath('appData', dataDir);
  // sessionData defaults to userData; keep it co-located
  try {
    app.setPath('sessionData', join(userDataDir, 'Session'));
  } catch {
    // sessionData path API may not exist in older Electron versions
  }
  app.setPath('logs', logsDir);
  app.setPath('temp', join(dataDir, 'temp'));
  // crashDumps
  try {
    app.setPath('crashDumps', join(dataDir, 'crashes'));
  } catch {
    // ignore
  }

  // Expose to child processes so they can detect portable mode too
  process.env.CLAWPLUS_PORTABLE = '1';
  process.env.CLAWPLUS_PORTABLE_DATA = dataDir;

  // Log (logger may not be initialised yet, use console as fallback)
  const msg = `[Portable] Activated — root="${_portableRoot}", data="${dataDir}"`;
  try {
    logger.info(msg);
  } catch {
    console.log(msg);
  }

  return true;
}

// ---------------------------------------------------------------------------
// Child-process environment helpers
// ---------------------------------------------------------------------------

/**
 * Build environment variable overrides that trick a child process into writing
 * its data under `LocalData` instead of the real user home directory.
 *
 * For OpenClaw this means `~/.openclaw` resolves to `<LocalData>/.openclaw`.
 *
 * Usage:
 * ```ts
 * const env = { ...process.env, ...getPortableChildEnv() };
 * utilityProcess.fork(script, args, { env });
 * ```
 */
export function getPortableChildEnv(): Record<string, string> {
  if (!isPortableMode()) return {};

  const dataDir = getPortableDataDir();

  const env: Record<string, string> = {
    // These two variables control where most CLI tools resolve "~"
    HOME: dataDir,           // macOS / Linux
    USERPROFILE: dataDir,    // Windows

    // Explicit OpenClaw / ClawPlus overrides (in case they support XDG-style)
    OPENCLAW_HOME: getPortableOpenClawConfigDir(),
    CLAWPLUS_DATA: dataDir,
    CLAWPLUS_PORTABLE: '1',
    CLAWPLUS_PORTABLE_DATA: dataDir,
  };

  // Also redirect XDG dirs to keep Linux fully sandboxed on the drive
  if (process.platform === 'linux') {
    env.XDG_CONFIG_HOME = join(dataDir, '.config');
    env.XDG_DATA_HOME = join(dataDir, '.local', 'share');
    env.XDG_CACHE_HOME = join(dataDir, '.cache');
    env.XDG_STATE_HOME = join(dataDir, '.local', 'state');
  }

  return env;
}

/**
 * If a portable Python environment exists in extraResources, return its
 * directory path so it can be prepended to PATH.  Returns `undefined` when
 * no portable Python is bundled.
 */
export function getPortablePythonBinDir(): string | undefined {
  const pyDir = getPortablePythonDir();
  if (!existsSync(pyDir)) return undefined;

  // Depending on platform the python binary lives in different sub-dirs
  if (process.platform === 'win32') {
    // Typical layout: portable_python/python.exe
    // or portable_python/Scripts/python.exe
    if (existsSync(join(pyDir, 'python.exe'))) return pyDir;
    if (existsSync(join(pyDir, 'Scripts', 'python.exe'))) return join(pyDir, 'Scripts');
    // Fall back to root dir
    return pyDir;
  }
  // Linux / macOS
  if (existsSync(join(pyDir, 'bin', 'python3'))) return join(pyDir, 'bin');
  if (existsSync(join(pyDir, 'bin', 'python'))) return join(pyDir, 'bin');
  return pyDir;
}

/**
 * Convenience: create the `.portable` marker file so the next launch
 * automatically enters portable mode.
 */
export function createPortableMarker(): void {
  const markerPath = join(resolveAppRootDir(), '.portable');
  if (!existsSync(markerPath)) {
    writeFileSync(markerPath, 'ClawPlus portable mode marker\n', 'utf-8');
  }
}
