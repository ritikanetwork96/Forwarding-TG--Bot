import { apiClient } from './api';
import type {
  PublishMode,
  PublishResultData,
  RetryPublishResultData,
  PublishLogDTO,
  MessageStatus,
} from '@telegram-forwarder/shared';

export const PublishService = {
  async manual(data: {
    messageId: string;
    destinationIds?: string[];
    destinationGroupIds?: string[];
    categoryIds?: string[];
    publishMode?: PublishMode;
  }): Promise<PublishResultData> {
    return apiClient<PublishResultData>('/publish/manual', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async retryFailed(messageId: string): Promise<RetryPublishResultData> {
    return apiClient<RetryPublishResultData>(`/publish/retry-failed/${messageId}`, {
      method: 'POST',
    });
  },

  async retryLog(logId: string): Promise<{ log: PublishLogDTO; aggregateStatus: MessageStatus }> {
    return apiClient<{ log: PublishLogDTO; aggregateStatus: MessageStatus }>(
      `/publish/retry-log/${logId}`,
      {
        method: 'POST',
      }
    );
  },

  async resendLog(logId: string): Promise<{ log: PublishLogDTO; aggregateStatus: MessageStatus }> {
    return apiClient<{ log: PublishLogDTO; aggregateStatus: MessageStatus }>(
      `/publish/resend-log/${logId}`,
      {
        method: 'POST',
      }
    );
  },

  async resendPost(
    messageId: string,
    data?: {
      destinationIds?: string[];
      destinationGroupIds?: string[];
      publishMode?: PublishMode;
    }
  ): Promise<PublishResultData> {
    return apiClient<PublishResultData>(`/publish/resend-post/${messageId}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },
};
