import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './test-db.js';
import { TelegramService } from '../src/telegram/telegram.service.js';
import { Destination } from '../src/models/destination.model.js';
import { TelegramTemporaryUnavailableError, TelegramKickedError } from '../src/utils/errors.js';
import { ErrorCodes } from '@telegram-forwarder/shared';

describe('Destination Endpoints & Verification', () => {
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

  it('creates and lists destinations', async () => {
    const res = await request(app)
      .post('/api/destinations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        telegramChatId: '-1001234567890',
        title: 'Target Channel',
        type: 'channel',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.telegramChatId).toBe('-1001234567890');
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.verification.canPublish).toBe(false);
  });

  it('rejects duplicate telegramChatId', async () => {
    await request(app).post('/api/destinations').set('Authorization', `Bearer ${authToken}`).send({
      telegramChatId: '-1001234567890',
      title: 'Target Channel',
    });

    const duplicateRes = await request(app)
      .post('/api/destinations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        telegramChatId: '-1001234567890',
        title: 'Duplicate Channel',
      });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error).toBe(ErrorCodes.DESTINATION_ALREADY_EXISTS);
  });

  describe('Verification: Channel probing', () => {
    it('verifies channel successfully when administrator with can_post_messages', async () => {
      const dest = await Destination.create({
        telegramChatId: '-1001111111111',
        title: 'Channel',
        type: 'channel',
        verification: {
          chatType: 'channel',
          isForum: false,
          botRole: 'unknown',
          isMember: false,
          canPublish: false,
          rights: {
            canPostMessages: false,
            canSendMessages: false,
            canEditMessages: false,
            canDeleteMessages: false,
            canManageTopics: false,
          },
          lastCheckedAt: null,
          failureReason: null,
        },
      });

      vi.spyOn(TelegramService, 'verifyDestination').mockResolvedValue({
        canPublish: true,
        metadata: {
          id: '-1001111111111',
          title: 'Verified Channel',
          username: 'verified_channel',
          type: 'channel',
          isForum: false,
        },
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

      const res = await request(app)
        .post(`/api/destinations/${dest._id}/verify`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.verification.canPublish).toBe(true);
      expect(res.body.data.verification.rights.canPostMessages).toBe(true);
    });

    it('sets status to permission_missing when channel admin lacks can_post_messages', async () => {
      const dest = await Destination.create({
        telegramChatId: '-1002222222222',
        title: 'Channel No Post',
        type: 'channel',
        verification: {
          chatType: 'channel',
          isForum: false,
          botRole: 'unknown',
          isMember: false,
          canPublish: false,
          rights: {
            canPostMessages: false,
            canSendMessages: false,
            canEditMessages: false,
            canDeleteMessages: false,
            canManageTopics: false,
          },
          lastCheckedAt: null,
          failureReason: null,
        },
      });

      vi.spyOn(TelegramService, 'verifyDestination').mockResolvedValue({
        canPublish: false,
        verification: {
          chatType: 'channel',
          isForum: false,
          botRole: 'administrator',
          isMember: true,
          canPublish: false,
          rights: {
            canPostMessages: false,
            canSendMessages: false,
            canEditMessages: false,
            canDeleteMessages: false,
            canManageTopics: false,
          },
          lastCheckedAt: new Date().toISOString(),
          failureReason: 'Bot lacks can_post_messages right in channel',
        },
      });

      const res = await request(app)
        .post(`/api/destinations/${dest._id}/verify`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('permission_missing');
      expect(res.body.data.verification.canPublish).toBe(false);
    });
  });

  describe('Verification: Supergroup & Group probing', () => {
    it('supergroup: unrestricted member is publish-capable', async () => {
      const dest = await Destination.create({
        telegramChatId: '-1003333333333',
        title: 'Supergroup Member',
        type: 'supergroup',
        verification: {
          chatType: 'supergroup',
          isForum: false,
          botRole: 'unknown',
          isMember: false,
          canPublish: false,
          rights: {
            canPostMessages: false,
            canSendMessages: false,
            canEditMessages: false,
            canDeleteMessages: false,
            canManageTopics: false,
          },
          lastCheckedAt: null,
          failureReason: null,
        },
      });

      vi.spyOn(TelegramService, 'verifyDestination').mockResolvedValue({
        canPublish: true,
        verification: {
          chatType: 'supergroup',
          isForum: false,
          botRole: 'member',
          isMember: true,
          canPublish: true,
          rights: {
            canPostMessages: false,
            canSendMessages: true,
            canEditMessages: false,
            canDeleteMessages: false,
            canManageTopics: false,
          },
          lastCheckedAt: new Date().toISOString(),
          failureReason: null,
        },
      });

      const res = await request(app)
        .post(`/api/destinations/${dest._id}/verify`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.verification.canPublish).toBe(true);
    });

    it('group: unrestricted member is publish-capable', async () => {
      const dest = await Destination.create({
        telegramChatId: '-444444444',
        title: 'Standard Group',
        type: 'group',
        verification: {
          chatType: 'group',
          isForum: false,
          botRole: 'unknown',
          isMember: false,
          canPublish: false,
          rights: {
            canPostMessages: false,
            canSendMessages: false,
            canEditMessages: false,
            canDeleteMessages: false,
            canManageTopics: false,
          },
          lastCheckedAt: null,
          failureReason: null,
        },
      });

      vi.spyOn(TelegramService, 'verifyDestination').mockResolvedValue({
        canPublish: true,
        verification: {
          chatType: 'group',
          isForum: false,
          botRole: 'member',
          isMember: true,
          canPublish: true,
          rights: {
            canPostMessages: false,
            canSendMessages: true,
            canEditMessages: false,
            canDeleteMessages: false,
            canManageTopics: false,
          },
          lastCheckedAt: new Date().toISOString(),
          failureReason: null,
        },
      });

      const res = await request(app)
        .post(`/api/destinations/${dest._id}/verify`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');
    });

    it('kicked/left marks destination as invalid', async () => {
      const dest = await Destination.create({
        telegramChatId: '-1005555555555',
        title: 'Kicked Chat',
        type: 'channel',
        verification: {
          chatType: 'channel',
          isForum: false,
          botRole: 'unknown',
          isMember: false,
          canPublish: false,
          rights: {
            canPostMessages: false,
            canSendMessages: false,
            canEditMessages: false,
            canDeleteMessages: false,
            canManageTopics: false,
          },
          lastCheckedAt: null,
          failureReason: null,
        },
      });

      vi.spyOn(TelegramService, 'verifyDestination').mockRejectedValue(
        new TelegramKickedError('Bot was kicked from chat')
      );

      const res = await request(app)
        .post(`/api/destinations/${dest._id}/verify`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(ErrorCodes.BOT_KICKED);

      const updated = await Destination.findById(dest._id);
      expect(updated?.status).toBe('invalid');
      expect(updated?.verification.canPublish).toBe(false);
    });

    it('preserves database state during transient Telegram errors (network/5xx/429)', async () => {
      const dest = await Destination.create({
        telegramChatId: '-1006666666666',
        title: 'Good Channel',
        status: 'active',
        type: 'channel',
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

      // Simulate a network timeout or Telegram 502
      vi.spyOn(TelegramService, 'verifyDestination').mockRejectedValue(
        new TelegramTemporaryUnavailableError('ETIMEDOUT: Connection timed out')
      );

      const res = await request(app)
        .post(`/api/destinations/${dest._id}/verify`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(502);
      expect(res.body.error).toBe(ErrorCodes.TELEGRAM_TEMPORARY_UNAVAILABLE);

      // Verify that destination status in DB was NOT degraded to invalid!
      const destinationInDb = await Destination.findById(dest._id);
      expect(destinationInDb?.status).toBe('active');
      expect(destinationInDb?.verification.canPublish).toBe(true);
    });
  });
});
