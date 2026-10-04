import { Queue, type Job, type JobsOptions } from 'bullmq';
import { env } from '../config/index.js';
import { getRedisClient, isRedisConnected } from './connection.js';
import { PUBLISH_QUEUE_NAME, PUBLISH_JOB_NAME } from './queue.constants.js';
import type { PublishJobData, PublishJobResult } from './publish.types.js';
import type { QueueJobCounts } from '@telegram-forwarder/shared';
import { logger } from '../utils/logger.js';

let publishQueue: Queue<PublishJobData, PublishJobResult> | null = null;

/**
 * Builds default BullMQ job options with exponential backoff and sane retention
 */
export function getDefaultJobOptions(jobId?: string): JobsOptions {
  return {
    jobId,
    attempts: env.QUEUE_RETRY_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: env.QUEUE_BACKOFF_DELAY_MS,
    },
    removeOnComplete: {
      count: env.QUEUE_COMPLETED_RETENTION,
    },
    removeOnFail: {
      count: env.QUEUE_FAILED_RETENTION,
    },
  };
}

/**
 * Initializes the BullMQ publish queue instance
 */
export function initPublishQueue(
  customQueue?: Queue<PublishJobData, PublishJobResult>
): Queue<PublishJobData, PublishJobResult> {
  if (customQueue) {
    publishQueue = customQueue;
    return publishQueue;
  }

  if (publishQueue) {
    return publishQueue;
  }

  const connection = getRedisClient();

  publishQueue = new Queue<PublishJobData, PublishJobResult>(PUBLISH_QUEUE_NAME, {
    connection,
    defaultJobOptions: getDefaultJobOptions(),
  });

  publishQueue.on('error', (err: Error) => {
    logger.debug(`BullMQ PublishQueue offline: ${err.message || 'Redis connection unavailable'}`);
  });

  logger.info(`BullMQ Queue [${PUBLISH_QUEUE_NAME}] initialized`);
  return publishQueue;
}

/**
 * Returns the active queue instance, initializing if necessary
 */
export function getPublishQueue(): Queue<PublishJobData, PublishJobResult> {
  if (!publishQueue) {
    return initPublishQueue();
  }
  return publishQueue;
}

/**
 * Generates a deterministic Job ID for idempotency and duplicate prevention
 */
export function generateJobId(data: PublishJobData): string {
  if (data.triggeredBy === 'retry') {
    return `publish:${data.messageId}:${data.destinationId}:retry-${Date.now()}`;
  }
  return `publish:${data.messageId}:${data.destinationId}`;
}

/**
 * Enqueues a single destination publishing job into BullMQ
 */
export async function enqueuePublishJob(
  data: PublishJobData,
  opts?: { customJobId?: string }
): Promise<Job<PublishJobData, PublishJobResult> | null> {
  const queue = getPublishQueue();
  const jobId = opts?.customJobId || generateJobId(data);

  try {
    const job = await queue.add(
      PUBLISH_JOB_NAME,
      {
        ...data,
        enqueuedAt: new Date().toISOString(),
      },
      {
        ...getDefaultJobOptions(jobId),
        jobId,
      }
    );

    logger.debug(
      `Enqueued job [${job.id}] for message ${data.messageId} -> destination ${data.destinationId}`
    );
    return job;
  } catch (err) {
    logger.error(`Failed to enqueue job for destination ${data.destinationId}:`, err);
    throw err;
  }
}

/**
 * Enqueues multiple publish jobs (One Job = One Destination)
 */
export async function enqueuePublishJobs(
  jobDataList: PublishJobData[]
): Promise<Array<Job<PublishJobData, PublishJobResult> | null>> {
  const results: Array<Job<PublishJobData, PublishJobResult> | null> = [];
  for (const item of jobDataList) {
    const job = await enqueuePublishJob(item);
    results.push(job);
  }
  return results;
}

/**
 * Retrieves aggregate job counts across waiting, active, completed, failed, delayed, paused
 */
export async function getQueueCounts(): Promise<QueueJobCounts> {
  if (!publishQueue || !isRedisConnected()) {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    };
  }

  try {
    const counts = await publishQueue.getJobCounts();

    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: counts.paused || 0,
    };
  } catch (err) {
    logger.warn('Could not read queue job counts:', err);
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    };
  }
}

/**
 * Gracefully closes the BullMQ publish queue
 */
export async function closePublishQueue(): Promise<void> {
  if (publishQueue) {
    try {
      await publishQueue.close();
    } catch (err) {
      logger.error('Error closing BullMQ publish queue:', err);
    } finally {
      publishQueue = null;
      logger.info(`BullMQ Queue [${PUBLISH_QUEUE_NAME}] closed cleanly`);
    }
  }
}
