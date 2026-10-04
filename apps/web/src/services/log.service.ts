import { apiClient } from './api';
import type { PublishLogDTO, PublishLogStatus } from '@telegram-forwarder/shared';

export const LogService = {
  async list(
    params: {
      messageId?: string;
      destinationId?: string;
      status?: PublishLogStatus;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<PublishLogDTO[]> {
    const searchParams = new URLSearchParams();
    if (params.messageId) searchParams.append('messageId', params.messageId);
    if (params.destinationId) searchParams.append('destinationId', params.destinationId);
    if (params.status) searchParams.append('status', params.status);
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    if (params.page) searchParams.append('page', String(params.page));
    if (params.limit) searchParams.append('limit', String(params.limit));

    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient<PublishLogDTO[]>(`/logs${qs}`);
  },

  async getById(id: string): Promise<PublishLogDTO> {
    return apiClient<PublishLogDTO>(`/logs/${id}`);
  },
};
