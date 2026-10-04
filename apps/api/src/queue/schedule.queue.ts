import { Queue, type Job, type JobsOptions } from 'bullmq';
import { env } from '../config/index.js';
import { getRedisClient, isRedisConnected } from './connection.js';
import { SCHEDULE_QUEUE_NAME, SCHEDULE_JOB_NAME } from './queue.constants.js';
import type { ScheduleJobData, ScheduleJobResult } from './schedule.types.js';
import type { QueueJobCounts } from '@telegram-forwarder/shared';
import { logger } from '../utils/logger.js';

let scheduleQueue: Queue<ScheduleJobData, ScheduleJobResult> | null = null;

export function getScheduleJobId(scheduledPostId: string): string {
  return `schedule:${scheduledPostId}`;
}

export function getDefaultScheduleJobOptions(jobId: string, delayMs = 0): JobsOptions {
  return {
    jobId,
    delay: Math.max(0, delayMs),
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

export function initScheduleQueue(
  customQueue?: Queue<ScheduleJobData, ScheduleJobResult>
): Queue<ScheduleJobData, ScheduleJobResult> {
  if (customQueue) {
    scheduleQueue = customQueue;
    return scheduleQueue;
  }

  if (scheduleQueue) {
    return scheduleQueue;
  }

  const connection = getRedisClient();

  scheduleQueue = new Queue<ScheduleJobData, ScheduleJobResult>(SCHEDULE_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: env.QUEUE_RETRY_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: env.QUEUE_BACKOFF_DELAY_MS,
      },
      removeOnComplete: { count: env.QUEUE_COMPLETED_RETENTION },
      removeOnFail: { count: env.QUEUE_FAILED_RETENTION },
    },
  });

  scheduleQueue.on('error', (err: Error) => {
    logger.debug(`BullMQ ScheduleQueue offline: ${err.message || 'Redis connection unavailable'}`);
  });

  logger.info(`BullMQ Queue [${SCHEDULE_QUEUE_NAME}] initialized`);
  return scheduleQueue;
}

export function getScheduleQueue(): Queue<ScheduleJobData, ScheduleJobResult> {
  if (!scheduleQueue) {
    return initScheduleQueue();
  }
  return scheduleQueue;
}

/**
 * Enqueues a delayed schedule job into BullMQ with deterministic jobId
 */
export async function enqueueScheduleJob(params: {
  scheduledPostId: string;
  messageId: string;
  scheduledFor: Date;
}): Promise<Job<ScheduleJobData, ScheduleJobResult> | null> {
  if (!isRedisConnected()) {
    logger.warn(
      `Redis not connected. Schedule [${params.scheduledPostId}] persisted in MongoDB and will be reconciled on reconnect.`
    );
    return null;
  }

  const queue = getScheduleQueue();
  const jobId = getScheduleJobId(params.scheduledPostId);
  const delayMs = params.scheduledFor.getTime() - Date.now();

  try {
    // Remove any existing job with the same ID to prevent double triggers
    const existing = await queue.getJob(jobId);
    if (existing) {
      await existing.remove();
      logger.debug(`Removed existing schedule job [${jobId}] before re-enqueuing`);
    }

    const job = await queue.add(
      SCHEDULE_JOB_NAME,
      {
        scheduledPostId: params.scheduledPostId,
        messageId: params.messageId,
        enqueuedAt: new Date().toISOString(),
        scheduledFor: params.scheduledFor.toISOString(),
      },
      getDefaultScheduleJobOptions(jobId, delayMs)
    );

    logger.info(
      `Enqueued delayed schedule job [${jobId}] for post ${params.messageId} (delay: ${Math.max(0, delayMs)}ms, due at ${params.scheduledFor.toISOString()})`
    );
    return job;
  } catch (err) {
    logger.error(`Failed to enqueue schedule job [${jobId}]:`, err);
    throw err;
  }
}

/**
 * Cancels and removes a pending delayed schedule job from BullMQ
 */
export async function removeScheduleJob(scheduledPostId: string): Promise<boolean> {
  if (!scheduleQueue || !isRedisConnected()) {
    return false;
  }

  const queue = getScheduleQueue();
  const jobId = getScheduleJobId(scheduledPostId);

  try {
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info(`Removed schedule job [${jobId}] from BullMQ`);
      return true;
    }
    return false;
  } catch (err) {
    logger.warn(`Could not remove schedule job [${jobId}] from BullMQ:`, err);
    return false;
  }
}

/**
 * Retrieves aggregate job counts for schedule-queue
 */
export async function getScheduleQueueCounts(): Promise<QueueJobCounts> {
  if (!scheduleQueue || !isRedisConnected()) {
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
    const counts = await scheduleQueue.getJobCounts();
    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: counts.paused || 0,
    };
  } catch (err) {
    logger.warn('Could not read schedule-queue counts:', err);
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
 * Gracefully shuts down the schedule queue
 */
export async function closeScheduleQueue(): Promise<void> {
  if (scheduleQueue) {
    try {
      await scheduleQueue.close();
    } catch (err) {
      logger.error('Error closing BullMQ schedule queue:', err);
    } finally {
      scheduleQueue = null;
      logger.info(`BullMQ Queue [${SCHEDULE_QUEUE_NAME}] closed cleanly`);
    }
  }
}
