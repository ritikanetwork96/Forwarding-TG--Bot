import { Worker, type Job, UnrecoverableError } from 'bullmq';
import { env } from '../config/index.js';
import { getRedisClient, isRedisConnected } from './connection.js';
import { PUBLISH_QUEUE_NAME } from './queue.constants.js';
import type { PublishJobData, PublishJobResult } from './publish.types.js';
import { PublishService } from '../services/publish.service.js';
import { isTransientTelegramError } from '../telegram/normalizer.js';
import { logger } from '../utils/logger.js';

let publishWorker: Worker<PublishJobData, PublishJobResult> | null = null;
let isWorkerRunning = false;

/**
 * Worker processor function for a single destination publish job
 */
export async function processPublishJob(
  job: Job<PublishJobData, PublishJobResult>
): Promise<PublishJobResult> {
  const { messageId, destinationId, ruleId, publishMode, triggeredBy, userId } = job.data;
  const currentAttempt = job.attemptsMade + 1;
  const maxAttempts = job.opts.attempts || env.QUEUE_RETRY_ATTEMPTS;

  logger.info(
    `[Worker] Processing job [${job.id}]: post=${messageId} -> dest=${destinationId} (attempt ${currentAttempt}/${maxAttempts})`
  );

  // Invoke the single canonical publishing engine
  const result = await PublishService.publishSingleDestination({
    messageId,
    destinationId,
    publishMode,
    ruleId,
    triggeredBy,
    userId,
  });

  // Handle Idempotent Skip (Requirement 13)
  if (result.skipped) {
    logger.info(`[Worker] Job [${job.id}] skipped: ${result.skipReason}`);
    return result;
  }

  // Handle Failure & Retry Classification (Requirements 9, 10)
  if (!result.success && result.error) {
    const isTransient =
      isTransientTelegramError(result.error) ||
      result.error.code === 'TELEGRAM_RATE_LIMITED' ||
      result.error.code === 'TELEGRAM_TEMPORARY_UNAVAILABLE';

    if (!isTransient) {
      // Permanent failure: chat not found, bot kicked, not admin, missing permissions, invalid destination
      logger.warn(
        `[Worker] Permanent failure for job [${job.id}] (code: ${result.error.code}): ${result.error.message}. Aborting retries.`
      );
      throw new UnrecoverableError(result.error.message || 'Permanent Telegram publish failure');
    }

    // Transient failure: evaluate retry attempts
    if (currentAttempt < maxAttempts) {
      logger.warn(
        `[Worker] Transient error for job [${job.id}] (${result.error.message}). Scheduling BullMQ retry with exponential backoff.`
      );
      throw new Error(result.error.message || 'Transient Telegram publish failure');
    } else {
      logger.error(
        `[Worker] Job [${job.id}] exhausted all ${maxAttempts} attempts. Moving to failed state.`
      );
      throw new UnrecoverableError(`Exhausted all retries: ${result.error.message}`);
    }
  }

  logger.info(
    `[Worker] Job [${job.id}] successfully published post ${messageId} to destination ${destinationId} in ${result.executionTimeMs}ms`
  );
  return result;
}

/**
 * Initializes and starts the BullMQ publish worker
 */
export function startPublishWorker(
  customWorker?: Worker<PublishJobData, PublishJobResult>
): Worker<PublishJobData, PublishJobResult> {
  if (customWorker) {
    publishWorker = customWorker;
    isWorkerRunning = true;
    return publishWorker;
  }

  if (publishWorker) {
    return publishWorker;
  }

  const connection = getRedisClient();

  publishWorker = new Worker<PublishJobData, PublishJobResult>(
    PUBLISH_QUEUE_NAME,
    processPublishJob,
    {
      connection,
      concurrency: env.QUEUE_CONCURRENCY,
      limiter: {
        max: env.QUEUE_MAX_JOBS_PER_SECOND,
        duration: 1000,
      },
    }
  );

  publishWorker.on('completed', (job) => {
    logger.debug(`[Worker] Job [${job.id}] completed`);
  });

  publishWorker.on('failed', (job, err) => {
    logger.warn(`[Worker] Job [${job?.id}] failed: ${err.message}`);
  });

  publishWorker.on('error', (err: Error) => {
    logger.debug(
      `[Worker] PublishWorker offline: ${err.message || 'Redis connection unavailable'}`
    );
  });

  isWorkerRunning = true;
  logger.info(
    `BullMQ PublishWorker started on queue [${PUBLISH_QUEUE_NAME}] with concurrency=${env.QUEUE_CONCURRENCY}, rateLimit=${env.QUEUE_MAX_JOBS_PER_SECOND}/s`
  );

  return publishWorker;
}

/**
 * Returns current worker running status
 */
export function getWorkerStatus(): { status: 'running' | 'stopped'; concurrency: number } {
  const isRunning = Boolean(
    publishWorker && isWorkerRunning && publishWorker.isRunning() && isRedisConnected()
  );

  return {
    status: isRunning ? 'running' : 'stopped',
    concurrency: env.QUEUE_CONCURRENCY,
  };
}

/**
 * Gracefully shuts down the BullMQ publish worker
 */
export async function stopPublishWorker(): Promise<void> {
  if (publishWorker) {
    try {
      isWorkerRunning = false;
      await publishWorker.close();
    } catch (err) {
      logger.error('Error closing BullMQ publish worker:', err);
    } finally {
      publishWorker = null;
      logger.info('BullMQ PublishWorker stopped cleanly');
    }
  }
}
