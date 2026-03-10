import { logger } from '../utils/logger';

type HealthResult = { ok: boolean; error?: string };

/**
 * Default time (ms) after the last pong before considering the connection dead.
 * Two missed ping intervals (2 × 30 s) plus a generous margin.
 */
const DEFAULT_PONG_TIMEOUT_MS = 75_000;

export class GatewayConnectionMonitor {
  private pingInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastPongAt: number = Date.now();
  private pongTimeoutMs: number = DEFAULT_PONG_TIMEOUT_MS;

  /**
   * Start sending WebSocket pings at a regular interval.
   * After each ping, check if a pong was received within the timeout window.
   * If not, call `onDead` so the manager can tear down the zombie socket.
   */
  startPing(options: {
    sendPing: () => void;
    onDead: () => void;
    intervalMs?: number;
    pongTimeoutMs?: number;
  }): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    const intervalMs = options.intervalMs ?? 30_000;
    this.pongTimeoutMs = options.pongTimeoutMs ?? DEFAULT_PONG_TIMEOUT_MS;
    this.lastPongAt = Date.now();

    this.pingInterval = setInterval(() => {
      options.sendPing();

      // Check if the last pong is too old — connection is likely dead.
      const silenceMs = Date.now() - this.lastPongAt;
      if (silenceMs > this.pongTimeoutMs) {
        logger.warn(
          `No pong received for ${Math.round(silenceMs / 1000)}s (threshold ${Math.round(this.pongTimeoutMs / 1000)}s), treating connection as dead`,
        );
        options.onDead();
      }
    }, intervalMs);
  }

  /**
   * Called when a WebSocket pong frame is received.
   */
  recordPong(): void {
    this.lastPongAt = Date.now();
  }

  /**
   * Check if the connection appears stale (no recent pong).
   * Useful for proactive checks after system resume.
   */
  isConnectionStale(thresholdMs?: number): boolean {
    const threshold = thresholdMs ?? this.pongTimeoutMs;
    return Date.now() - this.lastPongAt > threshold;
  }

  startHealthCheck(options: {
    shouldCheck: () => boolean;
    checkHealth: () => Promise<HealthResult>;
    onUnhealthy: (errorMessage: string) => void;
    onError: (error: unknown) => void;
    intervalMs?: number;
  }): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      if (!options.shouldCheck()) {
        return;
      }

      try {
        const health = await options.checkHealth();
        if (!health.ok) {
          const errorMessage = health.error ?? 'Health check failed';
          logger.warn(`Gateway health check failed: ${errorMessage}`);
          options.onUnhealthy(errorMessage);
        }
      } catch (error) {
        logger.error('Gateway health check error:', error);
        options.onError(error);
      }
    }, options.intervalMs ?? 30000);
  }

  clear(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}
