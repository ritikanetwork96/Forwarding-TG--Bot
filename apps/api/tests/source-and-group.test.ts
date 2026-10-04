import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './test-db.js';
import { Source } from '../src/models/source.model.js';
import { Destination } from '../src/models/destination.model.js';
import { DestinationGroup } from '../src/models/destination-group.model.js';
import { ForwardingRule } from '../src/models/forwarding-rule.model.js';
import { IngestionService } from '../src/services/ingestion.service.js';
import { RuleEngineService } from '../src/services/rule-engine.service.js';
import { ErrorCodes } from '@telegram-forwarder/shared';

describe('Source & Destination Group Management', () => {
  let authToken: string;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    const setupRes = await request(app).post('/api/auth/setup').send({
      email: 'admin@example.com',
      username: 'admin',
      password: 'Password123!',
    });
    authToken = setupRes.body.data.token;
  });

  async function createVerifiedDestination(
    chatId: string,
    title: string,
    status: 'active' | 'disabled' = 'active'
  ) {
    return Destination.create({
      telegramChatId: chatId,
      title,
      type: 'channel',
      status,
      verification: {
        chatType: 'channel',
        isForum: false,
        botRole: 'administrator',
        isMember: true,
        canPublish: status === 'active',
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
  // SOURCE TESTS
  // ==========================================
  describe('Source Management', () => {
    it('creates a new source successfully', async () => {
      const res = await request(app)
        .post('/api/sources')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          telegramChatId: '-1001112223334',
          title: 'Alpha News Channel',
          username: 'alpha_news',
          type: 'channel',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.telegramChatId).toBe('-1001112223334');
      expect(res.body.data.title).toBe('Alpha News Channel');
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.lastMessageId).toBeNull();
    });

    it('rejects duplicate telegramChatId for source', async () => {
      await Source.create({
        telegramChatId: '-1001112223334',
        title: 'Alpha News',
        type: 'channel',
        status: 'active',
      });

      const res = await request(app)
        .post('/api/sources')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          telegramChatId: '-1001112223334',
          title: 'Duplicate Source',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe(ErrorCodes.SOURCE_ALREADY_EXISTS);
    });

    it('updates source fields and pauses source', async () => {
      const source = await Source.create({
        telegramChatId: '-1001112223334',
        title: 'Alpha News',
        type: 'channel',
        status: 'active',
      });

      const updateRes = await request(app)
        .patch(`/api/sources/${source._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Alpha News',
          status: 'paused',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Updated Alpha News');
      expect(updateRes.body.data.status).toBe('paused');
    });

    it('unknown source is ignored by IngestionService safely', async () => {
      const rawMsg = {
        message_id: 101,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: -1009999999999, // Unregistered
          type: 'channel',
          title: 'Unregistered Chat',
        },
        text: 'Hello from unknown chat',
      };

      const result = await IngestionService.ingestMessage(rawMsg);
      expect(result).toBeNull();
    });

    it('paused source is ignored by IngestionService safely', async () => {
      await Source.create({
        telegramChatId: '-1005555555555',
        title: 'Paused Source',
        type: 'channel',
        status: 'paused',
      });

      const rawMsg = {
        message_id: 102,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: -1005555555555,
          type: 'channel',
          title: 'Paused Source',
        },
        text: 'This should not be ingested',
      };

      const result = await IngestionService.ingestMessage(rawMsg);
      expect(result).toBeNull();
    });

    it('disabled source is ignored by IngestionService safely', async () => {
      await Source.create({
        telegramChatId: '-1004444444444',
        title: 'Disabled Source',
        type: 'channel',
        status: 'disabled',
      });

      const rawMsg = {
        message_id: 103,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: -1004444444444,
          type: 'channel',
          title: 'Disabled Source',
        },
        text: 'This should also not be ingested',
      };

      const result = await IngestionService.ingestMessage(rawMsg);
      expect(result).toBeNull();
    });
  });

  // ==========================================
  // DESTINATION GROUPS TESTS
  // ==========================================
  describe('Destination Groups', () => {
    it('creates, updates, and deletes a destination group', async () => {
      const d1 = await createVerifiedDestination('-10010', 'Dest 1');
      const d2 = await createVerifiedDestination('-10020', 'Dest 2');

      // 1. Create
      const createRes = await request(app)
        .post('/api/destination-groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Primary Broadcast Cluster',
          description: 'Top priority channels',
          destinationIds: [d1._id.toString(), d2._id.toString()],
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.name).toBe('Primary Broadcast Cluster');
      expect(createRes.body.data.destinationIds.length).toBe(2);
      expect(createRes.body.data.status).toBe('active');

      const groupId = createRes.body.data._id;

      // 2. Update (remove d2, update description)
      const updateRes = await request(app)
        .patch(`/api/destination-groups/${groupId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated description',
          destinationIds: [d1._id.toString()],
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.description).toBe('Updated description');
      expect(updateRes.body.data.destinationIds.length).toBe(1);

      // 3. Delete
      const deleteRes = await request(app)
        .delete(`/api/destination-groups/${groupId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteRes.status).toBe(200);

      const check = await DestinationGroup.findById(groupId);
      expect(check).toBeNull();
    });

    it('resolves destination groups to verified destinations and excludes inactive destinations', async () => {
      const activeDest = await createVerifiedDestination('-10010', 'Active Dest', 'active');
      const inactiveDest = await createVerifiedDestination('-10020', 'Inactive Dest', 'disabled');

      const group = await DestinationGroup.create({
        name: 'Mixed Group',
        destinationIds: [activeDest._id, inactiveDest._id],
        status: 'active',
      });

      const source = await Source.create({
        telegramChatId: '-100999',
        title: 'Source 1',
        type: 'channel',
        status: 'active',
      });

      await ForwardingRule.create({
        name: 'Group Rule',
        sourceId: source._id,
        destinationIds: [],
        destinationGroupIds: [group._id],
        publishMode: 'copy',
        workflowType: 'manual_approval',
        isActive: true,
        priority: 1,
      });

      const resolved = await RuleEngineService.evaluateMessageRules(source._id);

      expect(resolved.length).toBe(1);
      expect(resolved[0].destinationIds.length).toBe(1);
      // Only the active, verified destination is included
      expect(resolved[0].destinationIds[0]).toBe(activeDest._id.toString());
      expect(resolved[0].destinationIds).not.toContain(inactiveDest._id.toString());
    });
  });
});
