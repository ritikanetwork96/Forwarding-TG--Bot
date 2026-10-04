import type { Request, Response } from 'express';
import { z } from 'zod';
import { SourceService } from '../services/source.service.js';
import { sendSuccess } from '../utils/response.js';
import type { SourceStatus } from '@telegram-forwarder/shared';

const createSourceSchema = z.object({
  telegramChatId: z.string().min(1, 'telegramChatId is required').trim(),
  title: z.string().min(1, 'Title is required').trim(),
  username: z.string().nullable().optional(),
  type: z.enum(['channel', 'supergroup', 'group']).optional(),
});

const updateSourceSchema = z.object({
  title: z.string().min(1).trim().optional(),
  username: z.string().nullable().optional(),
  status: z.enum(['active', 'paused', 'disabled']).optional(),
  type: z.enum(['channel', 'supergroup', 'group']).optional(),
});

export class SourceController {
  public static async list(req: Request, res: Response): Promise<void> {
    const status = req.query.status as SourceStatus | undefined;
    const sources = await SourceService.list({ status });
    sendSuccess(res, sources);
  }

  public static async getById(req: Request, res: Response): Promise<void> {
    const source = await SourceService.getById(req.params.id as string);
    sendSuccess(res, source);
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const validated = createSourceSchema.parse(req.body);
    const source = await SourceService.create(validated);
    sendSuccess(res, source, 'Source registered successfully', 201);
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const validated = updateSourceSchema.parse(req.body);
    const source = await SourceService.update(req.params.id as string, validated);
    sendSuccess(res, source, 'Source updated successfully');
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    await SourceService.delete(req.params.id as string);
    sendSuccess(res, null, 'Source removed successfully');
  }
}
