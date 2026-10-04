import { apiClient } from './api';
import type {
  MessageDTO,
  MessageStatus,
  MessageType,
  MessageContent,
} from '@telegram-forwarder/shared';

export interface CreatePostData {
  sourceId?: string | null;
  categoryId?: string | null;
  messageType?: MessageType;
  content: MessageContent;
  status?: MessageStatus;
}

export const PostService = {
  async list(
    params: {
      status?: MessageStatus;
      categoryId?: string;
      sourceId?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<MessageDTO[]> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('status', params.status);
    if (params.categoryId) searchParams.append('categoryId', params.categoryId);
    if (params.sourceId) searchParams.append('sourceId', params.sourceId);
    if (params.page) searchParams.append('page', String(params.page));
    if (params.limit) searchParams.append('limit', String(params.limit));

    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient<MessageDTO[]>(`/posts${qs}`);
  },

  async getById(id: string): Promise<MessageDTO> {
    return apiClient<MessageDTO>(`/posts/${id}`);
  },

  async create(data: CreatePostData): Promise<MessageDTO> {
    return apiClient<MessageDTO>('/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(
    id: string,
    data: { categoryId?: string | null; content?: Partial<MessageContent>; status?: MessageStatus }
  ): Promise<MessageDTO> {
    return apiClient<MessageDTO>(`/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiClient<void>(`/posts/${id}`, {
      method: 'DELETE',
    });
  },
};
