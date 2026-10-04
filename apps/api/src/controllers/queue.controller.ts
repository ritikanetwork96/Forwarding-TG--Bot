import type { Request, Response } from 'express';
import {
  getRedisConnectionStatus,
  getWorkerStatus,
  getQueueCounts,
  PUBLISH_QUEUE_NAME,
  getPublishQueue,
} from '../queue/index.js';
import { sendSuccess } from '../utils/response.js';
import type { QueueStatusResponse } from '@telegram-forwarder/shared';

export class QueueController {
  /**
   * Returns sanitized queue and worker operational health
   */
  public static async getStatus(_req: Request, res: Response): Promise<void> {
    const redisStatus = getRedisConnectionStatus();
    const workerStatus = getWorkerStatus();
    const counts = await getQueueCounts();

    let isPaused = false;
    try {
      const queue = getPublishQueue();
      isPaused = await queue.isPaused();
    } catch {
      isPaused = false;
    }

    const data: QueueStatusResponse = {
      redis: {
        status: redisStatus,
      },
      worker: {
        status: workerStatus.status,
        concurrency: workerStatus.concurrency,
      },
      queue: {
        name: PUBLISH_QUEUE_NAME,
        isPaused,
        counts,
      },
    };

    sendSuccess(res, data, 'Queue status retrieved');
  }
}
