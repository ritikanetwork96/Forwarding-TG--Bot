import { apiClient } from './api';
import type { CategoryDTO, CategoryStatus } from '@telegram-forwarder/shared';

export const CategoryService = {
  async list(status?: CategoryStatus): Promise<CategoryDTO[]> {
    const query = status ? `?status=${status}` : '';
    return apiClient<CategoryDTO[]>(`/categories${query}`);
  },

  async getById(id: string): Promise<CategoryDTO> {
    return apiClient<CategoryDTO>(`/categories/${id}`);
  },

  async create(data: {
    name: string;
    displayName?: string | null;
    iconEmoji?: string;
    customEmojiId?: string | null;
    slug?: string;
    description?: string;
    icon?: string;
    destinationIds?: string[];
  }): Promise<CategoryDTO> {
    return apiClient<CategoryDTO>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      displayName?: string | null;
      iconEmoji?: string;
      customEmojiId?: string | null;
      slug?: string;
      description?: string;
      icon?: string;
      destinationIds?: string[];
      status?: CategoryStatus;
    }
  ): Promise<CategoryDTO> {
    return apiClient<CategoryDTO>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiClient<void>(`/categories/${id}`, {
      method: 'DELETE',
    });
  },

  async restore(id: string): Promise<CategoryDTO> {
    return apiClient<CategoryDTO>(`/categories/${id}/restore`, {
      method: 'POST',
    });
  },

  async permanentDelete(id: string): Promise<void> {
    return apiClient<void>(`/categories/${id}/permanent`, {
      method: 'DELETE',
    });
  },
};
