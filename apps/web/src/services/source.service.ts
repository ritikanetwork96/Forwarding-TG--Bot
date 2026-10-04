import { apiClient } from './api';
import type { SourceDTO, SourceStatus, ChatType } from '@telegram-forwarder/shared';

export const SourceService = {
  async list(status?: SourceStatus): Promise<SourceDTO[]> {
    const query = status ? `?status=${status}` : '';
    return apiClient<SourceDTO[]>(`/sources${query}`);
  },

  async getById(id: string): Promise<SourceDTO> {
    return apiClient<SourceDTO>(`/sources/${id}`);
  },

  async create(data: {
    telegramChatId: string;
    title: string;
    username?: string | null;
    type?: ChatType;
  }): Promise<SourceDTO> {
    return apiClient<SourceDTO>('/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(
    id: string,
    data: { title?: string; username?: string | null; status?: SourceStatus; type?: ChatType }
  ): Promise<SourceDTO> {
    return apiClient<SourceDTO>(`/sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiClient<void>(`/sources/${id}`, {
      method: 'DELETE',
    });
  },
};
