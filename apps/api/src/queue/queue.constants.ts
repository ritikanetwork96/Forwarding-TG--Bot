/**
 * Queue & Worker Constants for Phase 3
 */

export const PUBLISH_QUEUE_NAME = 'publish-queue';
export const PUBLISH_JOB_NAME = 'publish-destination';

export const SCHEDULE_QUEUE_NAME = 'schedule-queue';
export const SCHEDULE_JOB_NAME = 'process-schedule';

export const QueueEvents = {
  JOB_ENQUEUED: 'job:enqueued',
  JOB_COMPLETED: 'job:completed',
  JOB_FAILED: 'job:failed',
  WORKER_ERROR: 'worker:error',
} as const;
