import { apiClient } from './api';
import type { UserDTO, UserRole, UserStatus } from '@telegram-forwarder/shared';

export interface CreateUserData {
  name: string;
  username: string;
  email?: string;
  password: string;
  role?: UserRole;
  status?: UserStatus;
  tag?: string;
  canManageAdmins?: boolean;
  telegramUserId?: string;
}

export interface UpdateUserData {
  name?: string;
  username?: string;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
  tag?: string;
  canManageAdmins?: boolean;
  telegramUserId?: string;
}

export const UserService = {
  async list(): Promise<UserDTO[]> {
    return apiClient<UserDTO[]>('/users');
  },

  async create(data: CreateUserData): Promise<UserDTO> {
    return apiClient<UserDTO>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: UpdateUserData): Promise<UserDTO> {
    return apiClient<UserDTO>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiClient<void>(`/users/${id}`, {
      method: 'DELETE',
    });
  },
};
