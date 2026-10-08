import { type Request, type Response } from 'express';
import { z } from 'zod';
import { DestinationService } from '../services/destination.service.js';
import { sendSuccess } from '../utils/response.js';
import { type DestinationStatus, type ChatType } from '@telegram-forwarder/shared';

const createDestinationSchema = z.object({
  telegramChatId: z.string().min(1, 'telegramChatId is required'),
  title: z.string().min(1, 'Title is required').max(128),
  username: z.string().max(128).optional().nullable(),
  type: z.enum(['channel', 'group', 'supergroup', 'private']).optional(),
  categoryIds: z.array(z.string()).optional(),
});

const updateDestinationSchema = z.object({
  title: z.string().min(1).max(128).optional(),
  displayName: z.string().max(128).optional().nullable(),
  username: z.string().max(128).optional().nullable(),
  status: z.enum(['active', 'permission_missing', 'invalid', 'pending', 'disabled']).optional(),
  type: z.enum(['channel', 'group', 'supergroup', 'private']).optional(),
  categoryIds: z.array(z.string()).optional(),
});

export class DestinationController {
  public static async list(req: Request, res: Response): Promise<void> {
    const status = req.query.status as DestinationStatus | undefined;
    const destinations = await DestinationService.list({ status });
    sendSuccess(res, destinations, 'Destinations retrieved successfully');
  }

  public static async getById(req: Request, res: Response): Promise<void> {
    const destination = await DestinationService.getById(req.params.id as string);
    sendSuccess(res, destination, 'Destination retrieved successfully');
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const validated = createDestinationSchema.parse(req.body);
    const destination = await DestinationService.create(
      validated as {
        telegramChatId: string;
        title: string;
        username?: string | null;
        type?: ChatType;
      }
    );
    if (validated.categoryIds && validated.categoryIds.length > 0) {
      await DestinationService.assignCategories(destination._id, validated.categoryIds);
    }
    const refreshed = await DestinationService.getById(destination._id);
    sendSuccess(res, refreshed, 'Destination registered successfully', 201);
  }

  public static async verify(req: Request, res: Response): Promise<void> {
    const destination = await DestinationService.verify(req.params.id as string);
    sendSuccess(res, destination, 'Destination verified successfully');
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const validated = updateDestinationSchema.parse(req.body);
    await DestinationService.update(
      req.params.id as string,
      validated as {
        title?: string;
        displayName?: string;
        username?: string | null;
        status?: DestinationStatus;
        type?: ChatType;
      }
    );
    if (validated.categoryIds !== undefined) {
      await DestinationService.assignCategories(req.params.id as string, validated.categoryIds);
    }
    const refreshed = await DestinationService.getById(req.params.id as string);
    sendSuccess(res, refreshed, 'Destination updated successfully');
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    await DestinationService.delete(req.params.id as string);
    sendSuccess(res, null, 'Destination deleted successfully');
  }
}
