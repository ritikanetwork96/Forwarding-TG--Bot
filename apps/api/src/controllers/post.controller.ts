import { type Request, type Response } from 'express';
import { z } from 'zod';
import { PostService } from '../services/post.service.js';
import { sendSuccess } from '../utils/response.js';
import { type MessageStatus, type MessageType } from '@telegram-forwarder/shared';

const mediaItemSchema = z.object({
  mediaType: z.enum(['photo', 'video', 'document', 'audio', 'animation']),
  fileId: z.string().min(1),
  fileUniqueId: z.string().min(1),
  caption: z.string().optional(),
  entities: z.array(z.any()).optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  fileSize: z.number().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
});

const contentSchema = z.object({
  text: z.string().optional(),
  entities: z.array(z.any()).optional(),
  mediaItems: z.array(mediaItemSchema).optional().default([]),
  mediaGroupId: z.string().optional().nullable(),
});

const createPostSchema = z.object({
  sourceId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  telegramChatId: z.string().optional().nullable(),
  telegramMessageId: z.number().optional().nullable(),
  mediaGroupId: z.string().optional().nullable(),
  messageType: z
    .enum(['text', 'photo', 'video', 'document', 'audio', 'animation', 'album'])
    .optional(),
  content: contentSchema,
  status: z
    .enum([
      'draft',
      'pending_approval',
      'publishing',
      'published',
      'partially_published',
      'failed',
      'archived',
    ])
    .optional(),
});

const updatePostSchema = z.object({
  categoryId: z.string().optional().nullable(),
  content: contentSchema.partial().optional(),
  status: z
    .enum([
      'draft',
      'pending_approval',
      'publishing',
      'published',
      'partially_published',
      'failed',
      'archived',
    ])
    .optional(),
});

export class PostController {
  public static async list(req: Request, res: Response): Promise<void> {
    const status = req.query.status as MessageStatus | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const sourceId = req.query.sourceId as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const { posts, meta } = await PostService.list({
      status,
      categoryId,
      sourceId,
      page,
      limit,
    });

    sendSuccess(res, posts, 'Posts retrieved successfully', 200, meta);
  }

  public static async getById(req: Request, res: Response): Promise<void> {
    const post = await PostService.getById(req.params.id as string);
    sendSuccess(res, post, 'Post retrieved successfully');
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const validated = createPostSchema.parse(req.body);
    const post = await PostService.create(
      validated as {
        sourceId?: string | null;
        categoryId?: string | null;
        telegramChatId?: string | null;
        telegramMessageId?: number | null;
        mediaGroupId?: string | null;
        messageType?: MessageType;
        content: {
          text?: string;
          entities?: unknown[];
          mediaItems: Array<{
            mediaType: 'photo' | 'video' | 'document' | 'audio' | 'animation';
            fileId: string;
            fileUniqueId: string;
            caption?: string;
            entities?: unknown[];
            width?: number;
            height?: number;
            duration?: number;
            fileSize?: number;
            fileName?: string;
            mimeType?: string;
          }>;
          mediaGroupId?: string | null;
        };
        status?: MessageStatus;
      }
    );
    sendSuccess(res, post, 'Post created successfully', 201);
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const validated = updatePostSchema.parse(req.body);
    const post = await PostService.update(
      req.params.id as string,
      validated as {
        categoryId?: string | null;
        content?: Partial<{
          text?: string;
          entities?: unknown[];
          mediaItems: Array<{
            mediaType: 'photo' | 'video' | 'document' | 'audio' | 'animation';
            fileId: string;
            fileUniqueId: string;
            caption?: string;
            entities?: unknown[];
            width?: number;
            height?: number;
            duration?: number;
            fileSize?: number;
            fileName?: string;
            mimeType?: string;
          }>;
        }>;
        status?: MessageStatus;
      }
    );
    sendSuccess(res, post, 'Post updated successfully');
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    await PostService.delete(req.params.id as string);
    sendSuccess(res, null, 'Post deleted successfully');
  }
}
