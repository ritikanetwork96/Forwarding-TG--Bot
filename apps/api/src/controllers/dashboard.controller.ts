import type { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { sendSuccess } from '../utils/response.js';

export class DashboardController {
  /**
   * GET /api/dashboard/stats
   * Returns aggregated executive KPIs, operational alerts, schedules and system health
   */
  public static async getStats(_req: Request, res: Response): Promise<void> {
    const data = await DashboardService.getStats();
    sendSuccess(res, data, 'Dashboard statistics retrieved');
  }
}
