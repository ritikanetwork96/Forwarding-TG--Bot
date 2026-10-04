import { type Request, type Response } from 'express';
import { z } from 'zod';
import { PublishService } from '../services/publish.service.js';
import { sendSuccess } from '../utils/response.js';
import { type PublishMode } from '@telegram-forwarder/shared';

const publishManualSchema = z
  .object({
    messageId: z.string().min(1, 'messageId is required'),
    destinationIds: z.array(z.string()).optional().default([]),
    destinationGroupIds: z.array(z.string()).optional().default([]),
    publishMode: z.enum(['forward', 'copy']).optional(),
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

export class PublishController {
  public static async manual(req: Request, res: Response): Promise<void> {
    const validated = publishManualSchema.parse(req.body);
    const userId = req.user?._id?.toString();

    const result = await PublishService.publishManual({
      messageId: validated.messageId,
      destinationIds: validated.destinationIds,
      destinationGroupIds: validated.destinationGroupIds,
      publishMode: validated.publishMode as PublishMode | undefined,
      userId,
    });

    sendSuccess(res, result, 'Publish executed');
  }

  public static async retryFailed(req: Request, res: Response): Promise<void> {
    const messageId = req.params.messageId as string;
    const userId = req.user?._id?.toString();

    const result = await PublishService.retryFailed(messageId, userId);
    sendSuccess(res, result, 'Retry failed destinations completed');
  }

  public static async retryLog(req: Request, res: Response): Promise<void> {
    const logId = req.params.logId as string;
    const userId = req.user?._id?.toString();

    const result = await PublishService.retryLog(logId, userId);
    sendSuccess(res, result, 'Targeted retry completed');
  }

  public static async resendLog(req: Request, res: Response): Promise<void> {
    const logId = req.params.logId as string;
    const userId = req.user?._id?.toString();

    const result = await PublishService.resendLog(logId, userId);
    sendSuccess(res, result, 'Message re-dispatched to destination successfully');
  }

  public static async resendPost(req: Request, res: Response): Promise<void> {
    const messageId = req.params.messageId as string;
    const { destinationIds, destinationGroupIds, publishMode } = req.body || {};
    const userId = req.user?._id?.toString();

    const result = await PublishService.resendPost({
      messageId,
      destinationIds,
      destinationGroupIds,
      publishMode,
      userId,
    });
    sendSuccess(res, result, 'Post re-published successfully');
  }
}
