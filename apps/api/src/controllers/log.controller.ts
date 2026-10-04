import { type Request, type Response } from 'express';
import { LogService } from '../services/log.service.js';
import { sendSuccess } from '../utils/response.js';
import { type PublishLogStatus } from '@telegram-forwarder/shared';

export class LogController {
  public static async list(req: Request, res: Response): Promise<void> {
    const messageId = req.query.messageId as string | undefined;
    const destinationId = req.query.destinationId as string | undefined;
    const status = req.query.status as PublishLogStatus | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const { logs, meta } = await LogService.list({
      messageId,
      destinationId,
      status,
      startDate,
      endDate,
      page,
      limit,
    });

    sendSuccess(res, logs, 'Publish logs retrieved successfully', 200, meta);
  }

  public static async getById(req: Request, res: Response): Promise<void> {
    const log = await LogService.getById(req.params.id as string);
    sendSuccess(res, log, 'Publish log retrieved successfully');
  }
}
