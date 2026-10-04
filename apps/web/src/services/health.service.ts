import { apiClient } from './api';
import type { HealthResponse } from '@telegram-forwarder/shared';

export interface HealthCheckData extends HealthResponse {
  database?: {
    status: string;
  };
}

export async function fetchHealth(): Promise<HealthCheckData> {
  return apiClient<HealthCheckData>('/health');
}
