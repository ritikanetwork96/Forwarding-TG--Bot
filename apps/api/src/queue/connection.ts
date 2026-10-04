import { Redis, type RedisOptions } from 'ioredis';
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';

export type RedisConnectionStatus = 'connected' | 'disconnected' | 'connecting';

let redisClient: Redis | null = null;
let currentStatus: RedisConnectionStatus = 'disconnected';
let hasLoggedFailure = false;

/**
 * Returns clean sanitized options for Redis connection
 */
export function getRedisOptions(): RedisOptions {
  return {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      // Exponential reconnect with max backoff of 5000ms
      const delay = Math.min(times * 500, 5000);
      return delay;
    },
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
      return targetErrors.some((t) => err.message.includes(t));
    },
    lazyConnect: true,
  };
}

/**
 * Initializes and establishes the shared Redis client connection.
 * Gracefully handles connectivity issues without bringing down the application.
 */
export async function initRedisConnection(customClient?: Redis): Promise<Redis> {
  if (customClient) {
    redisClient = customClient;
    currentStatus = 'connected';
    return redisClient;
  }

  if (redisClient) {
    return redisClient;
  }

  currentStatus = 'connecting';
  const options = getRedisOptions();

  try {
    const client = new Redis(env.REDIS_URL, options);

    client.on('connect', () => {
      currentStatus = 'connecting';
      logger.info('Connecting to Redis service...');
    });

    client.on('ready', () => {
      currentStatus = 'connected';
      hasLoggedFailure = false;
      logger.info('Redis connection established and ready');
    });

    client.on('error', (err: Error) => {
      currentStatus = 'disconnected';
      if (!hasLoggedFailure) {
        hasLoggedFailure = true;
        logger.warn(
          `Redis connection unavailable: ${err.message}. Automatic queue jobs will wait until Redis is reachable.`
        );
      }
    });

    client.on('close', () => {
      currentStatus = 'disconnected';
    });

    redisClient = client;

    // Attempt initial connect with short timeout so server startup is not blocked
    try {
      await Promise.race([
        client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis connection attempt timed out')), 2000)
        ),
      ]);
    } catch (connectErr) {
      currentStatus = 'disconnected';
      if (!hasLoggedFailure) {
        hasLoggedFailure = true;
        const msg = connectErr instanceof Error ? connectErr.message : String(connectErr);
        logger.warn(
          `Initial Redis connect failed: ${msg}. Application will continue running; Redis will auto-reconnect when available.`
        );
      }
    }

    return redisClient;
  } catch (err) {
    currentStatus = 'disconnected';
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Could not create Redis client: ${msg}`);
    // Create lazy disconnected client as fallback
    redisClient = new Redis(env.REDIS_URL, { ...options, lazyConnect: true });
    return redisClient;
  }
}

/**
 * Returns the active Redis client, creating one lazily if needed
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const options = getRedisOptions();
    redisClient = new Redis(env.REDIS_URL, options);
    redisClient.on('error', (err: Error) => {
      currentStatus = 'disconnected';
      if (!hasLoggedFailure) {
        hasLoggedFailure = true;
        logger.warn(`Redis connection error: ${err.message}`);
      }
    });
    redisClient.on('ready', () => {
      currentStatus = 'connected';
      hasLoggedFailure = false;
    });
  }
  return redisClient;
}

/**
 * Returns current Redis connection state
 */
export function getRedisConnectionStatus(): RedisConnectionStatus {
  if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
    return 'connected';
  }
  return currentStatus;
}

/**
 * Checks whether Redis is currently connected and operational
 */
export function isRedisConnected(): boolean {
  return getRedisConnectionStatus() === 'connected';
}

/**
 * Sets a custom Redis client (used for in-memory mocks during unit testing)
 */
export function setCustomRedisClient(client: Redis | null): void {
  redisClient = client;
  currentStatus = client ? 'connected' : 'disconnected';
}

/**
 * Gracefully terminates the Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    } finally {
      redisClient = null;
      currentStatus = 'disconnected';
      logger.info('Redis connection closed cleanly');
    }
  }
}
