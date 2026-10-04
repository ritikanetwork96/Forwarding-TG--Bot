import { apiClient } from './api';
import type { DestinationDTO, DestinationStatus, ChatType } from '@telegram-forwarder/shared';

export const DestinationService = {
  async list(status?: DestinationStatus): Promise<DestinationDTO[]> {
    const query = status ? `?status=${status}` : '';
    return apiClient<DestinationDTO[]>(`/destinations${query}`);
  },

  async getById(id: string): Promise<DestinationDTO> {
    return apiClient<DestinationDTO>(`/destinations/${id}`);
  },

  async create(data: {
    telegramChatId: string;
    title: string;
    username?: string | null;
    type?: ChatType;
  }): Promise<DestinationDTO> {
    return apiClient<DestinationDTO>('/destinations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async verify(id: string): Promise<DestinationDTO> {
    return apiClient<DestinationDTO>(`/destinations/${id}/verify`, {
      method: 'POST',
    });
  },

  async update(
    id: string,
    data: { title?: string; username?: string | null; status?: DestinationStatus; type?: ChatType }
  ): Promise<DestinationDTO> {
    return apiClient<DestinationDTO>(`/destinations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiClient<void>(`/destinations/${id}`, {
      method: 'DELETE',
    });
  },
};
