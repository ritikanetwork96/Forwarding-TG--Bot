import { type Request, type Response } from 'express';
import { z } from 'zod';
import { ScheduleService } from '../services/schedule.service.js';
import { sendSuccess } from '../utils/response.js';
import { type ScheduledPostStatus } from '@telegram-forwarder/shared';

const createScheduleSchema = z
  .object({
    messageId: z.string().min(1, 'messageId is required'),
    destinationIds: z.array(z.string()).optional().default([]),
    destinationGroupIds: z.array(z.string()).optional().default([]),
    categoryId: z.string().nullable().optional(),
    publishMode: z.enum(['forward', 'copy']).optional(),
    scheduledFor: z.string().min(1, 'scheduledFor date is required'),
    timezone: z.string().optional(),
  })
  .refine(
    (data) =>
      (data.destinationIds && data.destinationIds.length > 0) ||
      (data.destinationGroupIds && data.destinationGroupIds.length > 0),
    {
      message: 'At least one destination or destination group is required',
      path: ['destinationIds'],
    }
  );

const updateScheduleSchema = z.object({
  destinationIds: z.array(z.string()).optional(),
  destinationGroupIds: z.array(z.string()).optional(),
  categoryId: z.string().nullable().optional(),
  publishMode: z.enum(['forward', 'copy']).optional(),
  scheduledFor: z.string().optional(),
  timezone: z.string().optional(),
});

export class ScheduleController {
  public static async create(req: Request, res: Response): Promise<void> {
    const validated = createScheduleSchema.parse(req.body);
    const userId = req.user?._id?.toString() || 'anonymous';

    const result = await ScheduleService.createSchedule(validated, userId);
    sendSuccess(res, result, 'Post scheduled successfully', 201);
  }

  public static async list(req: Request, res: Response): Promise<void> {
    const status = req.query.status as ScheduledPostStatus | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const search = req.query.search as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const result = await ScheduleService.listSchedules({ status, categoryId, search, page, limit });
    sendSuccess(res, result.items, 'Schedules fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    });
  }

  public static async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const result = await ScheduleService.getSchedule(id);
    sendSuccess(res, result, 'Schedule details fetched');
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const validated = updateScheduleSchema.parse(req.body);
    const userId = req.user?._id?.toString() || 'anonymous';

    const result = await ScheduleService.updateSchedule(id, validated, userId);
    sendSuccess(res, result, 'Schedule updated successfully');
  }

  public static async cancel(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const userId = req.user?._id?.toString() || 'anonymous';

    const result = await ScheduleService.cancelSchedule(id, userId);
    sendSuccess(res, result, 'Schedule cancelled');
  }

  public static async publishNow(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const userId = req.user?._id?.toString() || 'anonymous';

    const result = await ScheduleService.publishNow(id, userId);
    sendSuccess(res, result, 'Post published immediately');
  }

  public static async getStats(_req: Request, res: Response): Promise<void> {
    const stats = await ScheduleService.getStats();
    sendSuccess(res, stats, 'Schedule stats fetched');
  }
}
