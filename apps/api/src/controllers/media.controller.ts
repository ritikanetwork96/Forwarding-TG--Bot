import { Readable } from 'node:stream';
import { type Request, type Response } from 'express';
import { MediaService } from '../services/media.service.js';
import { sendSuccess } from '../utils/response.js';
import { BadRequestError } from '../utils/errors.js';
import { getTelegramBot, isBotConfigured } from '../telegram/bot.js';
import { env } from '../config/index.js';

export class MediaController {
  public static async upload(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      throw new BadRequestError('No file provided in form field "file"');
    }

    const result = await MediaService.processUpload(req.file);
    sendSuccess(res, result, 'Media uploaded successfully', 201);
  }

  public static async getFileStream(req: Request, res: Response): Promise<void> {
    const fileId = req.params.fileId as string;
    if (!fileId) {
      throw new BadRequestError('fileId parameter is required');
    }

    if (!isBotConfigured()) {
      res.status(503).json({ error: 'Telegram bot service is not configured' });
      return;
    }

    try {
      const bot = getTelegramBot();
      const fileInfo = await bot.api.getFile(fileId);
      if (!fileInfo.file_path) {
        res.status(404).json({ error: 'File path not available from Telegram' });
        return;
      }

      const telegramUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
      const upstream = await fetch(telegramUrl);
      if (!upstream.ok) {
        res.status(upstream.status).send('Could not fetch file from Telegram storage');
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      if (fileInfo.file_size) {
        res.setHeader('Content-Length', fileInfo.file_size);
      }

      if (upstream.body) {
        // Stream directly to prevent high memory usage and buffer exhaustion
        Readable.fromWeb(upstream.body as any).pipe(res);
      } else {
        res.end();
      }
    } catch {
      res.status(404).json({ error: 'File not found on Telegram servers' });
    }
  }
}
