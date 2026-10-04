import type { Request, Response } from 'express';
import { z } from 'zod';
import { CategoryService } from '../services/category.service.js';
import { sendSuccess } from '../utils/response.js';
import type { CategoryStatus } from '@telegram-forwarder/shared';

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  displayName: z.string().max(100).optional().nullable(),
  iconEmoji: z.string().max(10).optional(),
  customEmojiId: z.string().optional().nullable(),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  destinationIds: z.array(z.string()).optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  displayName: z.string().max(100).optional().nullable(),
  iconEmoji: z.string().max(10).optional(),
  customEmojiId: z.string().optional().nullable(),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  destinationIds: z.array(z.string()).optional(),
  status: z.enum(['active', 'archived', 'deleted']).optional(),
});

export class CategoryController {
  public static async list(req: Request, res: Response): Promise<void> {
    const status = req.query.status as CategoryStatus | undefined;
    const categories = await CategoryService.list({ status });
    sendSuccess(res, categories);
  }

  public static async getById(req: Request, res: Response): Promise<void> {
    const category = await CategoryService.getById(req.params.id as string);
    sendSuccess(res, category);
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const validated = createCategorySchema.parse(req.body);
    const category = await CategoryService.create(validated);
    sendSuccess(res, category, 'Category created successfully', 201);
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const validated = updateCategorySchema.parse(req.body);
    const category = await CategoryService.update(req.params.id as string, validated);
    sendSuccess(res, category, 'Category updated successfully');
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    await CategoryService.delete(req.params.id as string);
    sendSuccess(res, null, 'Category moved to trash (restorable for 48 hours)');
  }

  public static async restore(req: Request, res: Response): Promise<void> {
    const category = await CategoryService.restore(req.params.id as string);
    sendSuccess(res, category, 'Category restored successfully');
  }

  public static async permanentDelete(req: Request, res: Response): Promise<void> {
    await CategoryService.permanentDelete(req.params.id as string);
    sendSuccess(res, null, 'Category permanently deleted');
  }
}
