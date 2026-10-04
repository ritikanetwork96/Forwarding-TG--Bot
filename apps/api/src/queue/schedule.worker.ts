import { Worker, type Job } from 'bullmq';
import { env } from '../config/index.js';
import { getRedisClient, isRedisConnected } from './connection.js';
import { SCHEDULE_QUEUE_NAME } from './queue.constants.js';
import type { ScheduleJobData, ScheduleJobResult } from './schedule.types.js';
import { ScheduleService } from '../services/schedule.service.js';
import { logger } from '../utils/logger.js';

let scheduleWorker: Worker<ScheduleJobData, ScheduleJobResult> | null = null;
let isScheduleWorkerRunning = false;

/**
 * Worker processor function for delayed schedule trigger jobs
 */
export async function processScheduleJob(
  job: Job<ScheduleJobData, ScheduleJobResult>
): Promise<ScheduleJobResult> {
  const { scheduledPostId, messageId, scheduledFor } = job.data;
  logger.info(
    `[ScheduleWorker] Processing due schedule job [${job.id}]: schedule=${scheduledPostId}, post=${messageId}, due=${scheduledFor}`
  );

  const result = await ScheduleService.executeScheduledPost(scheduledPostId);

  if (result.skipped) {
    logger.info(`[ScheduleWorker] Job [${job.id}] skipped: ${result.skipReason}`);
    return {
      success: true,
      scheduledPostId,
      skipped: true,
      skipReason: result.skipReason,
    };
  }

  return {
    success: result.success,
    scheduledPostId,
    aggregateStatus: result.aggregateStatus,
    error: result.error,
  };
}

/**
 * Initializes and starts the BullMQ schedule worker
 */
export function startScheduleWorker(
  customWorker?: Worker<ScheduleJobData, ScheduleJobResult>
): Worker<ScheduleJobData, ScheduleJobResult> {
  if (customWorker) {
    scheduleWorker = customWorker;
    isScheduleWorkerRunning = true;
    return scheduleWorker;
  }

  if (scheduleWorker) {
    return scheduleWorker;
  }

  const connection = getRedisClient();

  scheduleWorker = new Worker<ScheduleJobData, ScheduleJobResult>(
    SCHEDULE_QUEUE_NAME,
    processScheduleJob,
    {
      connection,
      concurrency: env.QUEUE_CONCURRENCY,
    }
  );

  scheduleWorker.on('completed', (job) => {
    logger.debug(`[ScheduleWorker] Job [${job.id}] completed`);
  });

  scheduleWorker.on('failed', (job, err) => {
    logger.warn(`[ScheduleWorker] Job [${job?.id}] failed: ${err.message}`);
  });

  scheduleWorker.on('error', (err: Error) => {
    logger.debug(
      `[ScheduleWorker] ScheduleWorker offline: ${err.message || 'Redis connection unavailable'}`
    );
  });

  isScheduleWorkerRunning = true;
  logger.info(
    `BullMQ ScheduleWorker started on queue [${SCHEDULE_QUEUE_NAME}] with concurrency=${env.QUEUE_CONCURRENCY}`
  );

  return scheduleWorker;
}

/**
 * Returns current schedule worker running status
 */
export function getScheduleWorkerStatus(): { status: 'running' | 'stopped'; concurrency: number } {
  const isRunning = Boolean(
    scheduleWorker && isScheduleWorkerRunning && scheduleWorker.isRunning() && isRedisConnected()
  );

  return {
    status: isRunning ? 'running' : 'stopped',
    concurrency: env.QUEUE_CONCURRENCY,
  };
}

/**
 * Gracefully shuts down the schedule worker
 */
export async function stopScheduleWorker(): Promise<void> {
  if (scheduleWorker) {
    try {
      isScheduleWorkerRunning = false;
      await scheduleWorker.close();
    } catch (err) {
      logger.error('Error closing BullMQ schedule worker:', err);
    } finally {
      scheduleWorker = null;
      logger.info('BullMQ ScheduleWorker stopped cleanly');
    }
  }
}
