import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './test-db.js';
import { Message } from '../src/models/message.model.js';
import { Destination } from '../src/models/destination.model.js';
import { PublishLog } from '../src/models/publish-log.model.js';
import { TelegramService } from '../src/telegram/telegram.service.js';
import { PublishService } from '../src/services/publish.service.js';
import { generateJobId, getDefaultJobOptions } from '../src/queue/publish.queue.js';
import { processPublishJob, getWorkerStatus } from '../src/queue/publish.worker.js';
import { getRedisOptions, getRedisConnectionStatus } from '../src/queue/connection.js';
import { PUBLISH_QUEUE_NAME } from '../src/queue/queue.constants.js';
import { ErrorCodes } from '@telegram-forwarder/shared';
import type { Job } from 'bullmq';
import type { PublishJobData, PublishJobResult } from '../src/queue/publish.types.js';

describe('Phase 3: Redis + BullMQ Queue + Reliability Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    vi.restoreAllMocks();

    const setupRes = await request(app).post('/api/auth/setup').send({
      email: 'admin@example.com',
      username: 'admin',
      password: 'Password123!',
    });
    authToken = setupRes.body.data.token;
  });

  async function createVerifiedDestination(chatId: string, title: string) {
    return Destination.create({
      telegramChatId: chatId,
      title,
      type: 'channel',
      status: 'active',
      verification: {
        chatType: 'channel',
        isForum: false,
        botRole: 'administrator',
        isMember: true,
        canPublish: true,
        rights: {
          canPostMessages: true,
          canSendMessages: true,
          canEditMessages: true,
          canDeleteMessages: true,
          canManageTopics: false,
        },
        lastCheckedAt: new Date().toISOString(),
        failureReason: null,
      },
    });
  }

  // ==========================================
  // 1. REDIS CONFIGURATION & CONNECTION HANDLING
  // ==========================================
  describe('Redis Configuration & Connection Handling', () => {
    it('provides sanitized Redis options required by BullMQ', () => {
      const options = getRedisOptions();
      expect(options.maxRetriesPerRequest).toBeNull();
      expect(options.enableReadyCheck).toBe(false);
      expect(options.lazyConnect).toBe(true);
      expect(typeof options.retryStrategy).toBe('function');
    });

    it('reports Redis connection status safely without throwing', () => {
      const status = getRedisConnectionStatus();
      expect(['connected', 'disconnected', 'connecting']).toContain(status);
      const workerStatus = getWorkerStatus();
      expect(typeof workerStatus.concurrency).toBe('number');
    });
  });

  // ==========================================
  // 2. QUEUE & DETERMINISTIC JOB IDS
  // ==========================================
  describe('Queue & Deterministic Job IDs', () => {
    it('generates deterministic Job IDs for idempotency and duplicate prevention', () => {
      const jobId = generateJobId({
        messageId: '6ab60cfbb77b7f8d6e568d83',
        destinationId: '6ab60cfbb77b7f8d6e568d84',
        publishMode: 'copy',
        triggeredBy: 'automatic',
      });

      expect(jobId).toBe('publish:6ab60cfbb77b7f8d6e568d83:6ab60cfbb77b7f8d6e568d84');
    });

    it('generates versioned retry Job IDs when triggeredBy is retry', () => {
      const retryJobId = generateJobId({
        messageId: '6ab60cfbb77b7f8d6e568d83',
        destinationId: '6ab60cfbb77b7f8d6e568d84',
        publishMode: 'copy',
        triggeredBy: 'retry',
      });

      expect(retryJobId).toMatch(
        /^publish:6ab60cfbb77b7f8d6e568d83:6ab60cfbb77b7f8d6e568d84:retry-\d+$/
      );
    });

    it('configures exponential backoff and job retention limits', () => {
      const opts = getDefaultJobOptions('test-job-id');
      expect(opts.jobId).toBe('test-job-id');
      expect(opts.attempts).toBe(3);
      expect(opts.backoff).toEqual({ type: 'exponential', delay: 1000 });
      expect(opts.removeOnComplete).toEqual({ count: 500 });
      expect(opts.removeOnFail).toEqual({ count: 1000 });
    });
  });

  // ==========================================
  // 3. WORKER PROCESSING & IDEMPOTENCY
  // ==========================================
  describe('Worker Processing & Idempotency', () => {
    it('processes job successfully, creates PublishLog, and marks post published', async () => {
      const dest = await createVerifiedDestination('-100701', 'Queue Target 1');
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Queue post test' },
        status: 'publishing',
        deliverySummary: {
          targetCount: 1,
          successfulDestinationIds: [],
          failedDestinationIds: [],
        },
      });

      vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
        success: true,
        targetTelegramMessageId: 8888,
        targetTelegramMessageIds: [8888],
      });

      const mockJob = {
        id: `publish:${msg._id}:${dest._id}`,
        data: {
          messageId: msg._id.toString(),
          destinationId: dest._id.toString(),
          publishMode: 'copy',
          triggeredBy: 'automatic',
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<PublishJobData, PublishJobResult>;

      const result = await processPublishJob(mockJob);

      expect(result.success).toBe(true);
      expect(result.targetTelegramMessageId).toBe(8888);

      // Verify Message state updated
      const refreshedMsg = await Message.findById(msg._id);
      expect(refreshedMsg?.status).toBe('published');
      expect(refreshedMsg?.deliverySummary.successfulDestinationIds.map(String)).toContain(
        dest._id.toString()
      );

      // Verify PublishLog created
      const logs = await PublishLog.find({ messageId: msg._id });
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('success');
      expect(logs[0].targetTelegramMessageId).toBe(8888);
    });

    it('idempotently skips publishing if destination already succeeded', async () => {
      const dest = await createVerifiedDestination('-100702', 'Already Published');
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Duplicate protection test' },
        status: 'published',
        deliverySummary: {
          targetCount: 1,
          successfulDestinationIds: [dest._id.toString()],
          failedDestinationIds: [],
        },
      });

      const publishSpy = vi.spyOn(TelegramService, 'publishMessage');

      const mockJob = {
        id: `publish:${msg._id}:${dest._id}`,
        data: {
          messageId: msg._id.toString(),
          destinationId: dest._id.toString(),
          publishMode: 'copy',
          triggeredBy: 'automatic',
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<PublishJobData, PublishJobResult>;

      const result = await processPublishJob(mockJob);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('re-checks destination verification before dispatch and aborts permanently if invalid', async () => {
      // Create destination that is NOT verified
      const dest = await Destination.create({
        telegramChatId: '-100703',
        title: 'Unverified Dest',
        type: 'channel',
        status: 'active',
        verification: {
          chatType: 'channel',
          isForum: false,
          botRole: 'member',
          isMember: true,
          canPublish: false, // Cannot publish!
          rights: {
            canPostMessages: false,
            canSendMessages: false,
            canEditMessages: false,
            canDeleteMessages: false,
            canManageTopics: false,
          },
          failureReason: 'Missing permissions',
        },
      });

      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Should fail verification' },
        status: 'publishing',
        deliverySummary: {
          targetCount: 1,
          successfulDestinationIds: [],
          failedDestinationIds: [],
        },
      });

      const mockJob = {
        id: `publish:${msg._id}:${dest._id}`,
        data: {
          messageId: msg._id.toString(),
          destinationId: dest._id.toString(),
          publishMode: 'copy',
          triggeredBy: 'automatic',
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<PublishJobData, PublishJobResult>;

      // Must throw UnrecoverableError so BullMQ does not retry unverified destinations
      await expect(processPublishJob(mockJob)).rejects.toThrow();

      const refreshedMsg = await Message.findById(msg._id);
      expect(refreshedMsg?.status).toBe('failed');
      expect(refreshedMsg?.deliverySummary.failedDestinationIds.map(String)).toContain(
        dest._id.toString()
      );

      const logs = await PublishLog.find({ messageId: msg._id });
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('failed');
      expect(logs[0].error?.code).toBe(ErrorCodes.DESTINATION_NOT_VERIFIED);
    });
  });

  // ==========================================
  // 4. RETRY CLASSIFICATION & RATE LIMITING
  // ==========================================
  describe('Retry Classification & Telegram 429 Handling', () => {
    it('classifies permanent Telegram errors as UnrecoverableError and does not retry', async () => {
      const dest = await createVerifiedDestination('-100704', 'Kicked Channel');
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Permanent error test' },
        status: 'publishing',
        deliverySummary: {
          targetCount: 1,
          successfulDestinationIds: [],
          failedDestinationIds: [],
        },
      });

      vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
        success: false,
        error: {
          code: ErrorCodes.BOT_KICKED,
          message: 'Forbidden: bot was kicked from the channel chat',
        },
      });

      const mockJob = {
        id: `publish:${msg._id}:${dest._id}`,
        data: {
          messageId: msg._id.toString(),
          destinationId: dest._id.toString(),
          publishMode: 'copy',
          triggeredBy: 'automatic',
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<PublishJobData, PublishJobResult>;

      // Permanent error must throw unrecoverable error
      await expect(processPublishJob(mockJob)).rejects.toThrow(
        /Forbidden: bot was kicked from the channel chat/
      );

      const refreshedMsg = await Message.findById(msg._id);
      expect(refreshedMsg?.status).toBe('failed');
    });

    it('classifies transient errors and schedules retry when attempts remain', async () => {
      const dest = await createVerifiedDestination('-100705', 'Transient Fail');
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Transient retry test' },
        status: 'publishing',
        deliverySummary: {
          targetCount: 1,
          successfulDestinationIds: [],
          failedDestinationIds: [],
        },
      });

      vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
        success: false,
        error: {
          code: ErrorCodes.TELEGRAM_TEMPORARY_UNAVAILABLE,
          message: 'ETIMEDOUT: Connection to api.telegram.org timed out',
        },
      });

      const mockJob = {
        id: `publish:${msg._id}:${dest._id}`,
        data: {
          messageId: msg._id.toString(),
          destinationId: dest._id.toString(),
          publishMode: 'copy',
          triggeredBy: 'automatic',
        },
        attemptsMade: 0, // Attempt 1 of 3
        opts: { attempts: 3 },
      } as unknown as Job<PublishJobData, PublishJobResult>;

      // Standard Error thrown to signal BullMQ exponential backoff retry
      await expect(processPublishJob(mockJob)).rejects.toThrow(/Connection to api.telegram.org/);
    });

    it('handles Telegram 429 rate limit as transient failure', async () => {
      const dest = await createVerifiedDestination('-100706', 'Rate Limited');
      const msg = await Message.create({
        messageType: 'text',
        content: { text: '429 handling test' },
        status: 'publishing',
        deliverySummary: {
          targetCount: 1,
          successfulDestinationIds: [],
          failedDestinationIds: [],
        },
      });

      vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
        success: false,
        error: {
          code: ErrorCodes.TELEGRAM_RATE_LIMITED,
          message: 'Too Many Requests: retry after 5',
        },
      });

      const mockJob = {
        id: `publish:${msg._id}:${dest._id}`,
        data: {
          messageId: msg._id.toString(),
          destinationId: dest._id.toString(),
          publishMode: 'copy',
          triggeredBy: 'automatic',
        },
        attemptsMade: 1, // Attempt 2 of 3
        opts: { attempts: 3 },
      } as unknown as Job<PublishJobData, PublishJobResult>;

      // Rate limit should trigger retry
      await expect(processPublishJob(mockJob)).rejects.toThrow(/Too Many Requests/);
    });

    it('marks final failure when retry attempts are exhausted', async () => {
      const dest = await createVerifiedDestination('-100707', 'Exhausted Channel');
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Exhausted retry test' },
        status: 'publishing',
        deliverySummary: {
          targetCount: 1,
          successfulDestinationIds: [],
          failedDestinationIds: [],
        },
      });

      vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
        success: false,
        error: {
          code: ErrorCodes.TELEGRAM_TEMPORARY_UNAVAILABLE,
          message: 'Service Unavailable',
        },
      });

      const mockJob = {
        id: `publish:${msg._id}:${dest._id}`,
        data: {
          messageId: msg._id.toString(),
          destinationId: dest._id.toString(),
          publishMode: 'copy',
          triggeredBy: 'automatic',
        },
        attemptsMade: 2, // Attempt 3 of 3 (final attempt)
        opts: { attempts: 3 },
      } as unknown as Job<PublishJobData, PublishJobResult>;

      // Final attempt throws UnrecoverableError
      await expect(processPublishJob(mockJob)).rejects.toThrow(/Exhausted all retries/);
    });
  });

  // ==========================================
  // 5. AGGREGATE STATE RESOLUTION
  // ==========================================
  describe('Multi-Destination Aggregate State Machine', () => {
    it('sets partially_published when 1 succeeds and 1 fails', async () => {
      const d1 = await createVerifiedDestination('-100801', 'Channel 1');
      const d2 = await createVerifiedDestination('-100802', 'Channel 2');

      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Partial publish test' },
        status: 'publishing',
        deliverySummary: {
          targetCount: 2,
          successfulDestinationIds: [],
          failedDestinationIds: [],
        },
      });

      // Update Destination 1 as success
      await PublishService.updateDeliverySummaryAndAggregateStatus({
        messageId: msg._id.toString(),
        destinationId: d1._id.toString(),
        success: true,
      });

      // While Dest 2 is still pending, aggregate status is 'publishing'
      const inFlightMsg = await Message.findById(msg._id);
      expect(inFlightMsg?.status).toBe('publishing');

      // Update Destination 2 as failure
      await PublishService.updateDeliverySummaryAndAggregateStatus({
        messageId: msg._id.toString(),
        destinationId: d2._id.toString(),
        success: false,
      });

      // Both resolved: 1 success + 1 failure -> partially_published
      const finalMsg = await Message.findById(msg._id);
      expect(finalMsg?.status).toBe('partially_published');
      expect(finalMsg?.deliverySummary.successfulDestinationIds.length).toBe(1);
      expect(finalMsg?.deliverySummary.failedDestinationIds.length).toBe(1);
    });
  });

  // ==========================================
  // 6. QUEUE STATUS API ENDPOINT
  // ==========================================
  describe('Queue Health API Endpoint (/api/queue/status)', () => {
    it('returns sanitized operational queue health with job counts and worker state', async () => {
      const res = await request(app)
        .get('/api/queue/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('redis');
      expect(res.body.data).toHaveProperty('worker');
      expect(res.body.data).toHaveProperty('queue');

      expect(['connected', 'disconnected', 'connecting']).toContain(res.body.data.redis.status);
      expect(['running', 'stopped']).toContain(res.body.data.worker.status);
      expect(typeof res.body.data.worker.concurrency).toBe('number');
      expect(res.body.data.queue.name).toBe(PUBLISH_QUEUE_NAME);

      expect(res.body.data.queue.counts).toHaveProperty('waiting');
      expect(res.body.data.queue.counts).toHaveProperty('active');
      expect(res.body.data.queue.counts).toHaveProperty('completed');
      expect(res.body.data.queue.counts).toHaveProperty('failed');
      expect(res.body.data.queue.counts).toHaveProperty('delayed');
    });
  });
});
