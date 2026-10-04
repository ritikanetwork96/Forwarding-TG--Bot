import type { ApiResponse } from '@telegram-forwarder/shared';

const RAW_BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public errorCode?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Standard typed HTTP client wrapper with automatic JWT token attachment
 */
export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: ApiResponse | null = null;
    try {
      errorData = (await response.json()) as ApiResponse;
    } catch {
      errorData = null;
    }

    if (response.status === 401 && token) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    const message =
      errorData?.message || errorData?.error || `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, errorData?.error, errorData?.details);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return {} as T;
  }

  try {
    const result = (await response.json()) as ApiResponse<T>;
    return (result.data !== undefined ? result.data : result) as T;
  } catch {
    return {} as T;
  }
}
