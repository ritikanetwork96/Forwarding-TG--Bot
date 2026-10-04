import { apiClient } from './api';
import type {
  DestinationGroupDTO,
  DestinationGroupWithDestinationsDTO,
  DestinationGroupStatus,
} from '@telegram-forwarder/shared';

export const DestinationGroupService = {
  async list(
    status?: DestinationGroupStatus,
    populate?: boolean
  ): Promise<DestinationGroupWithDestinationsDTO[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (populate) params.append('populate', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient<DestinationGroupWithDestinationsDTO[]>(`/destination-groups${query}`);
  },

  async getById(id: string): Promise<DestinationGroupDTO> {
    return apiClient<DestinationGroupDTO>(`/destination-groups/${id}`);
  },

  async create(data: {
    name: string;
    description?: string | null;
    destinationIds?: string[];
  }): Promise<DestinationGroupDTO> {
    return apiClient<DestinationGroupDTO>('/destination-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      destinationIds?: string[];
      status?: DestinationGroupStatus;
    }
  ): Promise<DestinationGroupDTO> {
    return apiClient<DestinationGroupDTO>(`/destination-groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiClient<void>(`/destination-groups/${id}`, {
      method: 'DELETE',
    });
  },
};
