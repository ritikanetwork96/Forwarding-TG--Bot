import { type Request, type Response } from 'express';
import { z } from 'zod';
import { RuleService } from '../services/rule.service.js';
import { sendSuccess } from '../utils/response.js';
import { type PublishMode, type WorkflowType } from '@telegram-forwarder/shared';

const createRuleSchema = z
  .object({
    name: z.string().min(1).max(150),
    sourceId: z.string().min(1),
    categoryId: z.string().optional().nullable(),
    destinationIds: z.array(z.string()).optional().default([]),
    destinationGroupIds: z.array(z.string()).optional().default([]),
    publishMode: z.enum(['forward', 'copy']).optional(),
    workflowType: z.enum(['manual_approval', 'automatic']).optional(),
    isActive: z.boolean().optional(),
    priority: z.number().int().optional(),
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

const updateRuleSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  sourceId: z.string().min(1).optional(),
  categoryId: z.string().optional().nullable(),
  destinationIds: z.array(z.string()).optional(),
  destinationGroupIds: z.array(z.string()).optional(),
  publishMode: z.enum(['forward', 'copy']).optional(),
  workflowType: z.enum(['manual_approval', 'automatic']).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
});

export class RuleController {
  public static async list(req: Request, res: Response): Promise<void> {
    const sourceId = req.query.sourceId as string | undefined;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
    const rules = await RuleService.list({ sourceId, isActive });
    sendSuccess(res, rules, 'Forwarding rules retrieved successfully');
  }

  public static async getById(req: Request, res: Response): Promise<void> {
    const rule = await RuleService.getById(req.params.id as string);
    sendSuccess(res, rule, 'Forwarding rule retrieved successfully');
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const validated = createRuleSchema.parse(req.body);
    const rule = await RuleService.create(
      validated as {
        name: string;
        sourceId: string;
        categoryId?: string | null;
        destinationIds?: string[];
        destinationGroupIds?: string[];
        publishMode?: PublishMode;
        workflowType?: WorkflowType;
        isActive?: boolean;
        priority?: number;
      }
    );
    sendSuccess(res, rule, 'Forwarding rule created successfully', 201);
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const validated = updateRuleSchema.parse(req.body);
    const rule = await RuleService.update(
      req.params.id as string,
      validated as {
        name?: string;
        sourceId?: string;
        categoryId?: string | null;
        destinationIds?: string[];
        destinationGroupIds?: string[];
        publishMode?: PublishMode;
        workflowType?: WorkflowType;
        isActive?: boolean;
        priority?: number;
      }
    );
    sendSuccess(res, rule, 'Forwarding rule updated successfully');
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    await RuleService.delete(req.params.id as string);
    sendSuccess(res, null, 'Forwarding rule deleted successfully');
  }
}
