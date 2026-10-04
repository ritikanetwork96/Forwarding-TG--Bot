import { apiClient } from './api';
import type {
  ScheduledPostDTO,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  ScheduleStatsDTO,
  ScheduledPostStatus,
} from '@telegram-forwarder/shared';

export const ScheduleService = {
  async list(params?: {
    status?: ScheduledPostStatus;
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: ScheduledPostDTO[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.categoryId) searchParams.append('categoryId', params.categoryId);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));

    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    // Api endpoint returns { data: items, meta: { total, page, limit, totalPages } }
    // When using apiClient, if data is array and meta is on the response, let's fetch raw or type it
    const items = await apiClient<ScheduledPostDTO[]>(`/schedules${qs}`);
    return {
      items: Array.isArray(items) ? items : [],
      total: Array.isArray(items) ? items.length : 0,
      page: params?.page || 1,
      limit: params?.limit || 20,
      totalPages: 1,
    };
  },

  async get(id: string): Promise<ScheduledPostDTO> {
    return apiClient<ScheduledPostDTO>(`/schedules/${id}`);
  },

  async create(data: CreateScheduleRequest): Promise<ScheduledPostDTO> {
    return apiClient<ScheduledPostDTO>('/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: UpdateScheduleRequest): Promise<ScheduledPostDTO> {
    return apiClient<ScheduledPostDTO>(`/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async cancel(id: string): Promise<ScheduledPostDTO> {
    return apiClient<ScheduledPostDTO>(`/schedules/${id}/cancel`, {
      method: 'POST',
    });
  },

  async publishNow(id: string): Promise<ScheduledPostDTO> {
    return apiClient<ScheduledPostDTO>(`/schedules/${id}/publish-now`, {
      method: 'POST',
    });
  },

  async getStats(): Promise<ScheduleStatsDTO> {
    return apiClient<ScheduleStatsDTO>('/schedules/stats');
  },
};
