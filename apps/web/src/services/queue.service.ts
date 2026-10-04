import { apiClient } from './api';
import type { QueueStatusResponse } from '@telegram-forwarder/shared';

export const QueueService = {
  /**
   * Fetches Redis connectivity, Worker state, and BullMQ job counts
   */
  async getStatus(): Promise<QueueStatusResponse> {
    return apiClient<QueueStatusResponse>('/queue/status');
  },
};
