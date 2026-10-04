import { apiClient } from './api';
import type { AuthSessionData, UserDTO } from '@telegram-forwarder/shared';

export const AuthService = {
  async login(data: {
    email?: string;
    login?: string;
    password: string;
  }): Promise<AuthSessionData> {
    return apiClient<AuthSessionData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async requestTelegramReset(identifier: string): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>('/auth/telegram-reset/request', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });
  },

  async verifyTelegramReset(data: {
    identifier: string;
    otp: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>('/auth/telegram-reset/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMe(): Promise<UserDTO> {
    return apiClient<UserDTO>('/auth/me');
  },

  async logout(): Promise<void> {
    return apiClient<void>('/auth/logout', {
      method: 'POST',
    });
  },
};
