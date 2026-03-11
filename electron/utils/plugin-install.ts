/**
 * Plugin Installation Utilities
 *
 * Shared module for installing bundled channel plugins (QQBot, DingTalk)
 * from the app's bundled resources to ~/.openclaw/extensions/.
 *
 * Used both at startup (auto-install) and during channel configuration (on-demand).
 */
import { app } from 'electron';
import { existsSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { logger } from './logger';

export interface PluginInstallResult {
  installed: boolean;
  warning?: string;
}

function getPluginCandidateSources(pluginName: string): string[] {
  return app.isPackaged
    ? [
      join(process.resourcesPath, 'openclaw-plugins', pluginName),
      join(process.resourcesPath, 'app.asar.unpacked', 'build', 'openclaw-plugins', pluginName),
      join(process.resourcesPath, 'app.asar.unpacked', 'openclaw-plugins', pluginName),
    ]
    : [
      join(app.getAppPath(), 'build', 'openclaw-plugins', pluginName),
      join(process.cwd(), 'build', 'openclaw-plugins', pluginName),
      join(__dirname, `../../build/openclaw-plugins/${pluginName}`),
    ];
}

function installPlugin(pluginName: string): PluginInstallResult {
  const targetDir = join(homedir(), '.openclaw', 'extensions', pluginName);
  const targetManifest = join(targetDir, 'openclaw.plugin.json');

  if (existsSync(targetManifest)) {
    logger.info(`${pluginName} plugin already installed`);
    return { installed: true };
  }

  const candidateSources = getPluginCandidateSources(pluginName);
  const sourceDir = candidateSources.find((dir) => existsSync(join(dir, 'openclaw.plugin.json')));

  if (!sourceDir) {
    const warning = `Bundled ${pluginName} plugin mirror not found. Checked: ${candidateSources.join(' | ')}`;
    logger.warn(warning);
    return { installed: false, warning };
  }

  try {
    mkdirSync(join(homedir(), '.openclaw', 'extensions'), { recursive: true });
    rmSync(targetDir, { recursive: true, force: true });
    cpSync(sourceDir, targetDir, { recursive: true, dereference: true });

    if (!existsSync(targetManifest)) {
      return { installed: false, warning: `Failed to install ${pluginName} plugin mirror (manifest missing).` };
    }

    logger.info(`Installed ${pluginName} plugin from bundled mirror: ${sourceDir}`);
    return { installed: true };
  } catch (error) {
    logger.warn(`Failed to install ${pluginName} plugin from bundled mirror:`, error);
    return { installed: false, warning: `Failed to install bundled ${pluginName} plugin mirror` };
  }
}

/** Ensure the DingTalk channel plugin is installed to ~/.openclaw/extensions/dingtalk */
export async function ensureDingTalkPluginInstalled(): Promise<PluginInstallResult> {
  return installPlugin('dingtalk');
}

/** Ensure the QQBot channel plugin is installed to ~/.openclaw/extensions/qqbot */
export async function ensureQQBotPluginInstalled(): Promise<PluginInstallResult> {
  return installPlugin('qqbot');
}

/**
 * Pre-install all bundled channel plugins.
 * Called at app startup so plugins are available immediately
 * when the gateway starts, without waiting for the user to
 * configure a channel first.
 */
export async function ensureAllBundledPluginsInstalled(): Promise<void> {
  const plugins = ['qqbot', 'dingtalk'];

  for (const pluginName of plugins) {
    try {
      const result = installPlugin(pluginName);
      if (!result.installed && result.warning) {
        logger.warn(`Startup plugin install (${pluginName}): ${result.warning}`);
      }
    } catch (error) {
      logger.warn(`Startup plugin install (${pluginName}) failed:`, error);
    }
  }
}
