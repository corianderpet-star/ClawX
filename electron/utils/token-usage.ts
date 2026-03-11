import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { getOpenClawConfigDir } from './paths';
import { logger } from './logger';
import { parseUsageEntriesFromJsonl, type TokenUsageHistoryEntry } from './token-usage-core';

export { parseUsageEntriesFromJsonl, type TokenUsageHistoryEntry } from './token-usage-core';

// ── In-memory cache ─────────────────────────────────────────────
const CACHE_TTL_MS = 30_000; // 30 seconds
let cachedResult: { entries: TokenUsageHistoryEntry[]; timestamp: number } | null = null;

/** Invalidate the cache (e.g. after a session finishes). */
export function invalidateTokenUsageCache(): void {
  cachedResult = null;
}

// ── File discovery ──────────────────────────────────────────────

interface SessionFileInfo {
  filePath: string;
  sessionId: string;
  agentId: string;
  mtimeMs: number;
}

async function listRecentSessionFiles(maxFiles = 50): Promise<SessionFileInfo[]> {
  const openclawDir = getOpenClawConfigDir();
  const agentsDir = join(openclawDir, 'agents');

  try {
    const agentEntries = await readdir(agentsDir);
    // Discover files across all agents in parallel
    const perAgentResults = await Promise.all(
      agentEntries.map(async (agentId): Promise<SessionFileInfo[]> => {
        const sessionsDir = join(agentsDir, agentId, 'sessions');
        try {
          const sessionEntries = await readdir(sessionsDir);
          const jsonlFiles = sessionEntries.filter(
            (f) => f.endsWith('.jsonl') && !f.includes('.deleted.'),
          );
          // Stat all files in this agent dir in parallel
          const settled = await Promise.allSettled(
            jsonlFiles.map(async (fileName) => {
              const filePath = join(sessionsDir, fileName);
              const fileStat = await stat(filePath);
              return {
                filePath,
                sessionId: fileName.replace(/\.jsonl$/, ''),
                agentId,
                mtimeMs: fileStat.mtimeMs,
              };
            }),
          );
          return settled
            .filter((r): r is PromiseFulfilledResult<SessionFileInfo> => r.status === 'fulfilled')
            .map((r) => r.value);
        } catch {
          return [];
        }
      }),
    );

    const files = perAgentResults.flat();
    files.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return files.slice(0, maxFiles);
  } catch {
    return [];
  }
}

// ── Public API ──────────────────────────────────────────────────

export async function getRecentTokenUsageHistory(limit?: number): Promise<TokenUsageHistoryEntry[]> {
  const maxEntries = typeof limit === 'number' && Number.isFinite(limit)
    ? Math.max(Math.floor(limit), 0)
    : 500; // sensible default cap

  // Return cached result if still fresh
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL_MS) {
    return cachedResult.entries.slice(0, maxEntries);
  }

  const files = await listRecentSessionFiles();

  // Read all session files in parallel (bounded by listRecentSessionFiles maxFiles)
  const settled = await Promise.allSettled(
    files.map(async (file) => {
      const content = await readFile(file.filePath, 'utf8');
      return parseUsageEntriesFromJsonl(content, {
        sessionId: file.sessionId,
        agentId: file.agentId,
      });
    }),
  );

  const results: TokenUsageHistoryEntry[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results.push(...result.value);
    }
  }

  results.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  // Cache the full result set
  cachedResult = { entries: results, timestamp: Date.now() };

  return results.slice(0, maxEntries);
}
