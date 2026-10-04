import { apiClient } from './api';
import type { ForwardingRuleDTO, PublishMode, WorkflowType } from '@telegram-forwarder/shared';

export const RuleService = {
  async list(params?: { sourceId?: string; isActive?: boolean }): Promise<ForwardingRuleDTO[]> {
    const searchParams = new URLSearchParams();
    if (params?.sourceId) searchParams.append('sourceId', params.sourceId);
    if (params?.isActive !== undefined) searchParams.append('isActive', String(params.isActive));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient<ForwardingRuleDTO[]>(`/rules${query}`);
  },

  async getById(id: string): Promise<ForwardingRuleDTO> {
    return apiClient<ForwardingRuleDTO>(`/rules/${id}`);
  },

  async create(data: {
    name: string;
    sourceId: string;
    categoryId?: string | null;
    destinationIds?: string[];
    destinationGroupIds?: string[];
    publishMode?: PublishMode;
    workflowType?: WorkflowType;
    isActive?: boolean;
    priority?: number;
  }): Promise<ForwardingRuleDTO> {
    return apiClient<ForwardingRuleDTO>('/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      sourceId?: string;
      categoryId?: string | null;
      destinationIds?: string[];
      destinationGroupIds?: string[];
      publishMode?: PublishMode;
      workflowType?: WorkflowType;
      isActive?: boolean;
      priority?: number;
    }
  ): Promise<ForwardingRuleDTO> {
    return apiClient<ForwardingRuleDTO>(`/rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiClient<void>(`/rules/${id}`, {
      method: 'DELETE',
    });
  },
};
