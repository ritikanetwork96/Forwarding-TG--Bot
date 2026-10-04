import { apiClient } from './api';
import type { DashboardStatsDTO } from '@telegram-forwarder/shared';

export const DashboardService = {
  /**
   * Retrieves aggregated dashboard KPI metrics, operational lists, and health
   */
  async getStats(): Promise<DashboardStatsDTO> {
    return apiClient<DashboardStatsDTO>('/dashboard/stats');
  },
};
