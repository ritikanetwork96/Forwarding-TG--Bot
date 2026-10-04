import type { Request, Response } from 'express';
import { z } from 'zod';
import { DestinationGroupService } from '../services/destination-group.service.js';
import { sendSuccess } from '../utils/response.js';
import type { DestinationGroupStatus } from '@telegram-forwarder/shared';

const createDestinationGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  description: z.string().nullable().optional(),
  destinationIds: z.array(z.string()).optional().default([]),
});

const updateDestinationGroupSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().nullable().optional(),
  destinationIds: z.array(z.string()).optional(),
  status: z.enum(['active', 'archived']).optional(),
});

export class DestinationGroupController {
  public static async list(req: Request, res: Response): Promise<void> {
    const status = req.query.status as DestinationGroupStatus | undefined;
    const shouldPopulate =
      req.query.populate === 'true' || req.query.includeDestinations === 'true';

    const groups = shouldPopulate
      ? await DestinationGroupService.listWithDestinations({ status })
      : await DestinationGroupService.list({ status });

    sendSuccess(res, groups, 'Destination groups retrieved successfully');
  }

  public static async getById(req: Request, res: Response): Promise<void> {
    const group = await DestinationGroupService.getById(req.params.id as string);
    sendSuccess(res, group, 'Destination group retrieved successfully');
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const validated = createDestinationGroupSchema.parse(req.body);
    const group = await DestinationGroupService.create(validated);
    sendSuccess(res, group, 'Destination group created successfully', 201);
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const validated = updateDestinationGroupSchema.parse(req.body);
    const group = await DestinationGroupService.update(req.params.id as string, validated);
    sendSuccess(res, group, 'Destination group updated successfully');
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    await DestinationGroupService.delete(req.params.id as string);
    sendSuccess(res, null, 'Destination group deleted successfully');
  }
}
