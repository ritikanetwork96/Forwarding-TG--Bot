import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './test-db.js';
import { TelegramService } from '../src/telegram/telegram.service.js';
import { Message } from '../src/models/message.model.js';
import { Destination } from '../src/models/destination.model.js';
import { PublishLog } from '../src/models/publish-log.model.js';
import { ErrorCodes } from '@telegram-forwarder/shared';

describe('Publish Engine & Retry Suite', () => {
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

  it('publishes single message to multiple destinations (100% success -> published)', async () => {
    const d1 = await createVerifiedDestination('-100101', 'Channel 1');
    const d2 = await createVerifiedDestination('-100102', 'Channel 2');

    const msg = await Message.create({
      messageType: 'text',
      content: { text: 'Announcement to all channels!' },
      status: 'draft',
    });

    vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
      success: true,
      targetTelegramMessageId: 777,
      targetTelegramMessageIds: [777],
    });

    const res = await request(app)
      .post('/api/publish/manual')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        messageId: msg._id.toString(),
        destinationIds: [d1._id.toString(), d2._id.toString()],
        publishMode: 'copy',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.aggregateStatus).toBe('published');
    expect(res.body.data.successfulCount).toBe(2);
    expect(res.body.data.failedCount).toBe(0);

    const updatedMsg = await Message.findById(msg._id);
    expect(updatedMsg?.status).toBe('published');
    expect(updatedMsg?.deliverySummary.successfulDestinationIds.length).toBe(2);
    expect(updatedMsg?.deliverySummary.failedDestinationIds.length).toBe(0);
  });

  it('handles partial failure: marks aggregate status as partially_published (never published)', async () => {
    const d1 = await createVerifiedDestination('-100201', 'Success Dest');
    const d2 = await createVerifiedDestination('-100202', 'Failing Dest');

    const msg = await Message.create({
      messageType: 'text',
      content: { text: 'Important update' },
      status: 'draft',
    });

    vi.spyOn(TelegramService, 'publishMessage').mockImplementation(async (params) => {
      if (params.toChatId === '-100201') {
        return { success: true, targetTelegramMessageId: 888 };
      }
      return {
        success: false,
        error: { code: ErrorCodes.TELEGRAM_RATE_LIMITED, message: 'Too many requests' },
      };
    });

    const res = await request(app)
      .post('/api/publish/manual')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        messageId: msg._id.toString(),
        destinationIds: [d1._id.toString(), d2._id.toString()],
        publishMode: 'copy',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.aggregateStatus).toBe('partially_published');
    expect(res.body.data.successfulCount).toBe(1);
    expect(res.body.data.failedCount).toBe(1);

    const updatedMsg = await Message.findById(msg._id);
    expect(updatedMsg?.status).toBe('partially_published');
    expect(updatedMsg?.deliverySummary.successfulDestinationIds.map(String)).toContain(
      d1._id.toString()
    );
    expect(updatedMsg?.deliverySummary.failedDestinationIds.map(String)).toContain(
      d2._id.toString()
    );
  });

  it('handles total failure: marks aggregate status as failed', async () => {
    const d1 = await createVerifiedDestination('-100301', 'Failing 1');
    const d2 = await createVerifiedDestination('-100302', 'Failing 2');

    const msg = await Message.create({
      messageType: 'text',
      content: { text: 'Test fail' },
      status: 'draft',
    });

    vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
      success: false,
      error: { code: ErrorCodes.TELEGRAM_API_ERROR, message: 'Network breakdown' },
    });

    const res = await request(app)
      .post('/api/publish/manual')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        messageId: msg._id.toString(),
        destinationIds: [d1._id.toString(), d2._id.toString()],
        publishMode: 'copy',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.aggregateStatus).toBe('failed');
    expect(res.body.data.successfulCount).toBe(0);
    expect(res.body.data.failedCount).toBe(2);

    const updatedMsg = await Message.findById(msg._id);
    expect(updatedMsg?.status).toBe('failed');
  });

  it('bulk retries failed destinations and creates new immutable logs', async () => {
    const d1 = await createVerifiedDestination('-100401', 'Success 1');
    const d2 = await createVerifiedDestination('-100402', 'Fail then Success');

    const msg = await Message.create({
      messageType: 'text',
      content: { text: 'Retry test post' },
      status: 'partially_published',
      deliverySummary: {
        targetCount: 2,
        successfulDestinationIds: [d1._id.toString()],
        failedDestinationIds: [d2._id.toString()],
        lastAttemptedAt: new Date().toISOString(),
      },
    });

    // Create initial failed log
    const initialLog = await PublishLog.create({
      messageId: msg._id,
      destinationId: d2._id,
      publishMode: 'copy',
      status: 'failed',
      error: { code: ErrorCodes.TELEGRAM_RATE_LIMITED, message: 'Rate limit' },
      executionTimeMs: 120,
    });

    // Mock successful retry
    vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
      success: true,
      targetTelegramMessageId: 999,
    });

    const retryRes = await request(app)
      .post(`/api/publish/retry-failed/${msg._id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.data.aggregateStatus).toBe('published');
    expect(retryRes.body.data.newlySuccessfulCount).toBe(1);

    // Verify post is now 100% published
    const finalMsg = await Message.findById(msg._id);
    expect(finalMsg?.status).toBe('published');
    expect(finalMsg?.deliverySummary.failedDestinationIds.length).toBe(0);
    expect(finalMsg?.deliverySummary.successfulDestinationIds.length).toBe(2);

    // Verify logs: old log still exists and is untouched, new log created!
    const allLogs = await PublishLog.find({ messageId: msg._id });
    expect(allLogs.length).toBe(2);
    const untouchedLog = await PublishLog.findById(initialLog._id);
    expect(untouchedLog?.status).toBe('failed');
  });

  it('targeted retries a specific failed log attempt (/api/publish/retry-log/:logId)', async () => {
    const d1 = await createVerifiedDestination('-100501', 'Target Channel');

    const msg = await Message.create({
      messageType: 'text',
      content: { text: 'Targeted retry test' },
      status: 'failed',
      deliverySummary: {
        targetCount: 1,
        successfulDestinationIds: [],
        failedDestinationIds: [d1._id.toString()],
        lastAttemptedAt: new Date().toISOString(),
      },
    });

    const failedLog = await PublishLog.create({
      messageId: msg._id,
      destinationId: d1._id,
      publishMode: 'copy',
      status: 'failed',
      error: { code: ErrorCodes.TELEGRAM_TEMPORARY_UNAVAILABLE, message: 'Temp offline' },
      executionTimeMs: 50,
    });

    vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
      success: true,
      targetTelegramMessageId: 1001,
    });

    const res = await request(app)
      .post(`/api/publish/retry-log/${failedLog._id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.aggregateStatus).toBe('published');
    expect(res.body.data.log.status).toBe('success');

    // Confirm historical log remains untouched
    const oldLog = await PublishLog.findById(failedLog._id);
    expect(oldLog?.status).toBe('failed');

    // Confirm post status updated
    const finalMsg = await Message.findById(msg._id);
    expect(finalMsg?.status).toBe('published');
  });
});
