import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';

let keepAliveInterval: NodeJS.Timeout | null = null;

export class KeepAliveService {
  /**
   * Starts the background heartbeat ping to prevent Render free-tier instances from idling/sleeping.
   * Render free tier puts services to sleep after 15 minutes of inbound HTTP inactivity.
   * Pinging every 10 minutes guarantees 24/7 active status and zero bot downtime.
   */
  public static start(): void {
    const rawUrl = env.RENDER_EXTERNAL_URL || process.env.RENDER_EXTERNAL_URL || '';
    if (!rawUrl) {
      logger.info('Keep-alive service: RENDER_EXTERNAL_URL not set. Running in standard host mode.');
      return;
    }

    const cleanBase = rawUrl.replace(/\/+$/, '');
    const pingTarget = `${cleanBase}/api/health`;
    const intervalMs = env.KEEP_ALIVE_INTERVAL_MS || 10 * 60 * 1000; // 10 minutes

    logger.info(`Starting Render Keep-Alive Heartbeat -> ${pingTarget} (every ${Math.round(intervalMs / 60000)}m)`);

    const ping = async () => {
      try {
        const response = await fetch(pingTarget, {
          headers: { 'User-Agent': 'Render-KeepAlive-Heartbeat/1.0' },
        });
        if (response.ok) {
          logger.debug(`Render keep-alive ping successful (Status: ${response.status})`);
        } else {
          logger.warn(`Render keep-alive ping returned non-200: ${response.status}`);
        }
      } catch (err: unknown) {
        logger.warn(`Render keep-alive ping error:`, err instanceof Error ? err.message : String(err));
      }
    };

    // Run first ping after 3 minutes, then every interval
    setTimeout(() => {
      void ping();
      keepAliveInterval = setInterval(() => {
        void ping();
      }, intervalMs);

      if (keepAliveInterval.unref) {
        keepAliveInterval.unref();
      }
    }, 3 * 60 * 1000);
  }

  public static stop(): void {
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
      logger.info('Render Keep-Alive Heartbeat stopped');
    }
  }
}
