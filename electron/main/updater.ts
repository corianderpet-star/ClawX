/**
 * Auto-Updater Module
 * Handles automatic application updates using electron-updater
 *
 * Update providers are configured in electron-builder.yml (OSS primary, GitHub fallback).
 * For prerelease channels (alpha, beta), the feed URL is overridden at runtime
 * to point at the channel-specific OSS directory (e.g. /alpha/, /beta/).
 */
import { autoUpdater, UpdateInfo, ProgressInfo, UpdateDownloadedEvent } from 'electron-updater';
import { BrowserWindow, app, ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { setQuitting } from './app-state';
import { isPortableMode, getPortableInstallType } from '../utils/portable';
import {
  downloadPortableUpdate,
  applyPortableUpdate,
  cleanupStaging,
  type PortableProgress,
} from '../utils/portable-updater';

/** Base CDN URL (without trailing channel path) */
const OSS_BASE_URL = 'http://zgonline.top';

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  info?: UpdateInfo;
  progress?: ProgressInfo;
  error?: string;
}

export interface UpdaterEvents {
  'status-changed': (status: UpdateStatus) => void;
  'checking-for-update': () => void;
  'update-available': (info: UpdateInfo) => void;
  'update-not-available': (info: UpdateInfo) => void;
  'download-progress': (progress: ProgressInfo) => void;
  'update-downloaded': (event: UpdateDownloadedEvent) => void;
  'error': (error: Error) => void;
}

/**
 * Detect the update channel from a semver version string.
 * e.g. "0.1.8-alpha.0" → "alpha", "1.0.0-beta.1" → "beta", "1.0.0" → "latest"
 */
function detectChannel(version: string): string {
  const match = version.match(/-([a-zA-Z]+)/);
  return match ? match[1] : 'latest';
}

export class AppUpdater extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private status: UpdateStatus = { status: 'idle' };
  private autoInstallTimer: NodeJS.Timeout | null = null;
  private autoInstallCountdown = 0;
  /** Tracks auto-download preference for both standard and portable modes. */
  private _autoDownloadEnabled = false;

  /**
   * `true` when the app is a dir-portable installation (no NSIS uninstaller).
   * In that case we download the `.zip` artifact and apply it ourselves.
   *
   * For nsis-portable installations the standard electron-updater flow works
   * because the NSIS installer on the server detects the existing `.portable`
   * marker and handles everything correctly.
   */
  private get usePortableZipFlow(): boolean {
    return isPortableMode() && getPortableInstallType() !== 'nsis';
  }

  /** Delay (in seconds) before auto-installing a downloaded update. */
  private static readonly AUTO_INSTALL_DELAY_SECONDS = 5;

  constructor() {
    super();
    
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    
    autoUpdater.logger = {
      info: (msg: string) => logger.info('[Updater]', msg),
      warn: (msg: string) => logger.warn('[Updater]', msg),
      error: (msg: string) => logger.error('[Updater]', msg),
      debug: (msg: string) => logger.debug('[Updater]', msg),
    };

    // Override feed URL for prerelease channels so that
    // alpha -> /alpha/alpha-mac.yml, beta -> /beta/beta-mac.yml, etc.
    const version = app.getVersion();
    const channel = detectChannel(version);
    const feedUrl = `${OSS_BASE_URL}/${channel}`;

    logger.info(`[Updater] Version: ${version}, channel: ${channel}, feedUrl: ${feedUrl}`);

    // Set channel so electron-updater requests the correct yml filename.
    // e.g. channel "alpha" → requests alpha-mac.yml, channel "latest" → requests latest-mac.yml
    autoUpdater.channel = channel;

    autoUpdater.setFeedURL({
      provider: 'generic',
      url: feedUrl,
      useMultipleRangeRequest: false,
    });

    this.setupListeners();

    // Clean stale update-staging from a previous interrupted portable update.
    if (isPortableMode()) {
      cleanupStaging();
    }
  }

  /**
   * Set the main window for sending update events
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Get current update status
   */
  getStatus(): UpdateStatus {
    return this.status;
  }

  /**
   * Setup auto-updater event listeners
   */
  private setupListeners(): void {
    autoUpdater.on('checking-for-update', () => {
      this.updateStatus({ status: 'checking' });
      this.emit('checking-for-update');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.updateStatus({ status: 'available', info });
      this.emit('update-available', info);

      // In dir-portable mode, autoUpdater.autoDownload is always false
      // (we must not let it download the NSIS exe). Trigger our own zip download.
      // For nsis-portable, the standard electron-updater flow handles everything.
      if (this.usePortableZipFlow && this._autoDownloadEnabled && info.version) {
        this.downloadUpdate().catch((err) => {
          logger.error('[Updater] Portable auto-download failed:', err);
        });
      }
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.updateStatus({ status: 'not-available', info });
      this.emit('update-not-available', info);
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.updateStatus({ status: 'downloading', progress });
      this.emit('download-progress', progress);
    });

    autoUpdater.on('update-downloaded', (event: UpdateDownloadedEvent) => {
      this.updateStatus({ status: 'downloaded', info: event });
      this.emit('update-downloaded', event);

      if (this._autoDownloadEnabled) {
        this.startAutoInstallCountdown();
      }
    });

    autoUpdater.on('error', (error: Error) => {
      this.updateStatus({ status: 'error', error: error.message });
      this.emit('error', error);
    });
  }

  /**
   * Update status and notify renderer
   */
  private updateStatus(newStatus: Partial<UpdateStatus>): void {
    this.status = {
      status: newStatus.status ?? this.status.status,
      info: newStatus.info,
      progress: newStatus.progress,
      error: newStatus.error,
    };
    this.sendToRenderer('update:status-changed', this.status);
  }

  /**
   * Send event to renderer process
   */
  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * Check for updates.
   * electron-updater automatically tries providers defined in electron-builder.yml in order.
   *
   * In dev mode (not packed), autoUpdater.checkForUpdates() silently returns
   * null without emitting any events, so we must detect this and force a
   * final status so the UI never gets stuck in 'checking'.
   */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      const result = await autoUpdater.checkForUpdates();

      // In dev mode (app not packaged), autoUpdater silently returns null
      // without emitting ANY events (not even checking-for-update).
      // Detect this and force an error so the UI never stays silent.
      if (result == null) {
        this.updateStatus({
          status: 'error',
          error: 'Update check skipped (dev mode – app is not packaged)',
        });
        return null;
      }

      // Safety net: if events somehow didn't fire, force a final state.
      if (this.status.status === 'checking' || this.status.status === 'idle') {
        this.updateStatus({ status: 'not-available' });
      }

      return result.updateInfo || null;
    } catch (error) {
      logger.error('[Updater] Check for updates failed:', error);
      this.updateStatus({ status: 'error', error: (error as Error).message || String(error) });
      throw error;
    }
  }

  /**
   * Download available update.
   *
   * - dir-portable  → downloads the `.zip` artifact and extracts it locally.
   * - nsis-portable → standard flow (downloads the same NSIS exe from CDN).
   * - standard      → standard flow.
   */
  async downloadUpdate(): Promise<void> {
    if (this.usePortableZipFlow) {
      return this.downloadPortableZip();
    }
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      logger.error('[Updater] Download update failed:', error);
      throw error;
    }
  }

  /**
   * Download the portable zip, extract it, and emit standard updater events
   * so the renderer UI stays identical.
   */
  private async downloadPortableZip(): Promise<void> {
    const version = this.status.info?.version;
    if (!version) {
      throw new Error('No update version info available. Check for updates first.');
    }

    logger.info(`[Updater] Downloading portable update v${version}`);

    try {
      await downloadPortableUpdate(version, (progress: PortableProgress) => {
        // Map portable progress to electron-updater ProgressInfo shape
        const mapped: ProgressInfo = {
          percent: progress.percent,
          bytesPerSecond: progress.bytesPerSecond,
          transferred: progress.transferred,
          total: progress.total,
          delta: 0,
        };
        this.updateStatus({ status: 'downloading', progress: mapped });
        this.emit('download-progress', mapped);
      });

      // Signal download complete with the same event shape
      this.updateStatus({ status: 'downloaded', info: this.status.info });
      this.emit('update-downloaded', this.status.info);

      if (this._autoDownloadEnabled) {
        this.startAutoInstallCountdown();
      }
    } catch (error) {
      logger.error('[Updater] Portable download failed:', error);
      this.updateStatus({ status: 'error', error: (error as Error).message || String(error) });
      throw error;
    }
  }

  /**
   * Install update and restart.
   *
   * On macOS, electron-updater delegates to Squirrel.Mac (ShipIt). The
   * native quitAndInstall() spawns ShipIt then internally calls app.quit().
   * However, the tray close handler in index.ts intercepts window close
   * and hides to tray unless isQuitting is true. Squirrel's internal quit
   * sometimes fails to trigger before-quit in time, so we set isQuitting
   * BEFORE calling quitAndInstall(). This lets the native quit flow close
   * the window cleanly while ShipIt runs independently to replace the app.
   */
  quitAndInstall(): void {
    logger.info('[Updater] quitAndInstall called');
    if (this.usePortableZipFlow) {
      logger.info('[Updater] Dir-portable mode — applying zip update and restarting');
      applyPortableUpdate();
      return;
    }
    // nsis-portable and standard installs both use the native NSIS installer.
    setQuitting();
    autoUpdater.quitAndInstall();
  }

  /**
   * Start a countdown that auto-installs the downloaded update.
   * Sends `update:auto-install-countdown` events to the renderer each second.
   */
  private startAutoInstallCountdown(): void {
    this.clearAutoInstallTimer();
    this.autoInstallCountdown = AppUpdater.AUTO_INSTALL_DELAY_SECONDS;
    this.sendToRenderer('update:auto-install-countdown', { seconds: this.autoInstallCountdown });

    this.autoInstallTimer = setInterval(() => {
      this.autoInstallCountdown--;
      this.sendToRenderer('update:auto-install-countdown', { seconds: this.autoInstallCountdown });

      if (this.autoInstallCountdown <= 0) {
        this.clearAutoInstallTimer();
        this.quitAndInstall();
      }
    }, 1000);
  }

  cancelAutoInstall(): void {
    this.clearAutoInstallTimer();
    this.sendToRenderer('update:auto-install-countdown', { seconds: -1, cancelled: true });
  }

  private clearAutoInstallTimer(): void {
    if (this.autoInstallTimer) {
      clearInterval(this.autoInstallTimer);
      this.autoInstallTimer = null;
    }
  }

  /**
   * Set update channel (stable, beta, dev)
   */
  setChannel(channel: 'stable' | 'beta' | 'dev'): void {
    autoUpdater.channel = channel;
  }

  /**
   * Set auto-download preference.
   *
   * In dir-portable mode we never set `autoUpdater.autoDownload = true`
   * because that would trigger the NSIS `.exe` download.  Instead we store
   * the flag and trigger our own zip download in the `update-available`
   * handler.  For nsis-portable the standard flow is safe.
   */
  setAutoDownload(enable: boolean): void {
    this._autoDownloadEnabled = enable;
    if (!this.usePortableZipFlow) {
      autoUpdater.autoDownload = enable;
    }
  }

  /**
   * Get current version
   */
  getCurrentVersion(): string {
    return app.getVersion();
  }
}

/**
 * Register IPC handlers for update operations
 */
export function registerUpdateHandlers(
  updater: AppUpdater,
  mainWindow: BrowserWindow
): void {
  updater.setMainWindow(mainWindow);

  // Get current update status
  ipcMain.handle('update:status', () => {
    return updater.getStatus();
  });

  // Get current version
  ipcMain.handle('update:version', () => {
    return updater.getCurrentVersion();
  });

  // Check for updates – always return final status so the renderer
  // never gets stuck in 'checking' waiting for a push event.
  ipcMain.handle('update:check', async () => {
    try {
      await updater.checkForUpdates();
      return { success: true, status: updater.getStatus() };
    } catch (error) {
      return { success: false, error: String(error), status: updater.getStatus() };
    }
  });

  // Download update
  ipcMain.handle('update:download', async () => {
    try {
      await updater.downloadUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Install update and restart
  ipcMain.handle('update:install', () => {
    updater.quitAndInstall();
    return { success: true };
  });

  // Set update channel
  ipcMain.handle('update:setChannel', (_, channel: 'stable' | 'beta' | 'dev') => {
    updater.setChannel(channel);
    return { success: true };
  });

  // Set auto-download preference
  ipcMain.handle('update:setAutoDownload', (_, enable: boolean) => {
    updater.setAutoDownload(enable);
    return { success: true };
  });

  // Cancel pending auto-install countdown
  ipcMain.handle('update:cancelAutoInstall', () => {
    updater.cancelAutoInstall();
    return { success: true };
  });

}

// Export singleton instance
export const appUpdater = new AppUpdater();
