import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './test-db.js';
import { Source } from '../src/models/source.model.js';
import { Destination } from '../src/models/destination.model.js';
import { Category } from '../src/models/category.model.js';
import { ForwardingRule } from '../src/models/forwarding-rule.model.js';
import { Message } from '../src/models/message.model.js';
import { PublishLog } from '../src/models/publish-log.model.js';
import { IngestionService } from '../src/services/ingestion.service.js';
import { RuleEngineService } from '../src/services/rule-engine.service.js';
import { PublishService } from '../src/services/publish.service.js';
import { TelegramService } from '../src/telegram/telegram.service.js';
import { albumDebouncer } from '../src/telegram/debouncer.service.js';
import { Types } from 'mongoose';

describe('Forwarding Rules & Ingestion Workflows Suite', () => {
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
    albumDebouncer.clear();

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
  // RULES ENGINE & CRUD TESTS
  // ==========================================
  describe('Forwarding Rules CRUD & Matching', () => {
    it('creates, updates, and deletes forwarding rule via API', async () => {
      const source = await Source.create({
        telegramChatId: '-100111',
        title: 'Source 1',
        type: 'channel',
        status: 'active',
      });

      const dest = await createVerifiedDestination('-100222', 'Dest 1');

      // 1. Create
      const createRes = await request(app)
        .post('/api/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Tech to Main Channel',
          sourceId: source._id.toString(),
          destinationIds: [dest._id.toString()],
          publishMode: 'copy',
          workflowType: 'automatic',
          priority: 5,
          isActive: true,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.name).toBe('Tech to Main Channel');
      expect(createRes.body.data.priority).toBe(5);
      expect(createRes.body.data.workflowType).toBe('automatic');

      const ruleId = createRes.body.data._id;

      // 2. Update
      const updateRes = await request(app)
        .patch(`/api/rules/${ruleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Rule Name',
          priority: 10,
          workflowType: 'manual_approval',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('Updated Rule Name');
      expect(updateRes.body.data.priority).toBe(10);
      expect(updateRes.body.data.workflowType).toBe('manual_approval');

      // 3. Delete
      const deleteRes = await request(app)
        .delete(`/api/rules/${ruleId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteRes.status).toBe(200);

      const check = await ForwardingRule.findById(ruleId);
      expect(check).toBeNull();
    });

    it('ignores inactive rules during evaluation', async () => {
      const source = await Source.create({
        telegramChatId: '-100111',
        title: 'Source 1',
        type: 'channel',
        status: 'active',
      });
      const dest = await createVerifiedDestination('-100222', 'Dest 1');

      await ForwardingRule.create({
        name: 'Disabled Rule',
        sourceId: source._id,
        destinationIds: [dest._id],
        publishMode: 'copy',
        workflowType: 'automatic',
        isActive: false, // Inactive
        priority: 1,
      });

      const matches = await RuleEngineService.evaluateMessageRules(source._id);
      expect(matches.length).toBe(0);
    });

    it('applies category filter correctly (matching vs non-matching)', async () => {
      const source = await Source.create({
        telegramChatId: '-100111',
        title: 'Source 1',
        type: 'channel',
        status: 'active',
      });
      const catCrypto = await Category.create({ name: 'Crypto', slug: 'crypto' });
      const catTech = await Category.create({ name: 'Tech', slug: 'tech' });
      const dest = await createVerifiedDestination('-100222', 'Dest 1');

      // Rule only applies to Crypto category
      await ForwardingRule.create({
        name: 'Crypto Only Rule',
        sourceId: source._id,
        categoryId: catCrypto._id,
        destinationIds: [dest._id],
        publishMode: 'copy',
        workflowType: 'automatic',
        isActive: true,
        priority: 1,
      });

      // 1. Message with Crypto category -> Matches
      const cryptoMatches = await RuleEngineService.evaluateMessageRules(
        source._id,
        catCrypto._id as Types.ObjectId
      );
      expect(cryptoMatches.length).toBe(1);

      // 2. Message with Tech category -> Does not match
      const techMatches = await RuleEngineService.evaluateMessageRules(
        source._id,
        catTech._id as Types.ObjectId
      );
      expect(techMatches.length).toBe(0);

      // 3. Message without category -> Does not match
      const uncategorizedMatches = await RuleEngineService.evaluateMessageRules(source._id, null);
      expect(uncategorizedMatches.length).toBe(0);
    });

    it('evaluates rules in deterministic priority order and prevents duplicate destination dispatch', async () => {
      const source = await Source.create({
        telegramChatId: '-100111',
        title: 'Source 1',
        type: 'channel',
        status: 'active',
      });
      const destShared = await createVerifiedDestination('-100999', 'Shared Dest');
      const destUnique = await createVerifiedDestination('-100888', 'Unique Dest');

      // Higher priority rule (Priority 10) targets destShared
      await ForwardingRule.create({
        name: 'High Priority Rule',
        sourceId: source._id,
        destinationIds: [destShared._id],
        publishMode: 'copy',
        workflowType: 'automatic',
        isActive: true,
        priority: 10,
      });

      // Lower priority rule (Priority 1) targets destShared AND destUnique
      await ForwardingRule.create({
        name: 'Low Priority Rule',
        sourceId: source._id,
        destinationIds: [destShared._id, destUnique._id],
        publishMode: 'copy',
        workflowType: 'manual_approval',
        isActive: true,
        priority: 1,
      });

      const matches = await RuleEngineService.evaluateMessageRules(source._id);

      // Both rules match, but destShared was claimed by Priority 10 rule
      expect(matches.length).toBe(2);
      expect(matches[0].ruleName).toBe('High Priority Rule');
      expect(matches[0].destinationIds).toEqual([destShared._id.toString()]);

      // Low Priority rule only gets the unassigned destUnique
      expect(matches[1].ruleName).toBe('Low Priority Rule');
      expect(matches[1].destinationIds).toEqual([destUnique._id.toString()]);
    });
  });

  // ==========================================
  // INGESTION & DEDUPLICATION TESTS
  // ==========================================
  describe('Message Ingestion & Deduplication', () => {
    it('ingests channel_post, updates source metadata, and sets lastMessageId', async () => {
      const source = await Source.create({
        telegramChatId: '-1001234567890',
        title: 'Crypto Alpha Channel',
        type: 'channel',
        status: 'active',
      });

      const rawMsg = {
        message_id: 501,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: -1001234567890,
          type: 'channel',
          title: 'Crypto Alpha Channel',
        },
        text: 'Bitcoin breaks new resistance level!',
      };

      const ingested = await IngestionService.ingestMessage(rawMsg);
      expect(ingested).not.toBeNull();
      expect(ingested!.telegramChatId).toBe('-1001234567890');
      expect(ingested!.telegramMessageId).toBe(501);
      expect(ingested!.content.text).toBe('Bitcoin breaks new resistance level!');
      expect(ingested!.status).toBe('draft'); // No rules configured

      // Check source metadata update
      const updatedSource = await Source.findById(source._id);
      expect(updatedSource!.lastMessageId).toBe(501);
      expect(updatedSource!.lastIngestedAt).not.toBeNull();
    });

    it('ingests group and supergroup messages safely', async () => {
      await Source.create({
        telegramChatId: '-1009876543210',
        title: 'Community Supergroup',
        type: 'supergroup',
        status: 'active',
      });

      const rawMsg = {
        message_id: 701,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: -1009876543210,
          type: 'supergroup',
          title: 'Community Supergroup',
        },
        text: 'Hello members!',
      };

      const ingested = await IngestionService.ingestMessage(rawMsg);
      expect(ingested).not.toBeNull();
      expect(ingested!.content.text).toBe('Hello members!');
    });

    it('handles duplicate updates safely without duplicate database records', async () => {
      await Source.create({
        telegramChatId: '-1001234567890',
        title: 'Crypto Alpha Channel',
        type: 'channel',
        status: 'active',
      });

      const rawMsg = {
        message_id: 502,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: -1001234567890,
          type: 'channel',
        },
        text: 'Duplicate message test',
      };

      // 1. Ingest first time
      const first = await IngestionService.ingestMessage(rawMsg);
      expect(first).not.toBeNull();

      // 2. Ingest identical update second time
      const second = await IngestionService.ingestMessage(rawMsg);
      expect(second).not.toBeNull();
      expect(second!._id.toString()).toBe(first!._id.toString());

      // Ensure only 1 document in database
      const count = await Message.countDocuments({
        telegramChatId: '-1001234567890',
        telegramMessageId: 502,
      });
      expect(count).toBe(1);
    });

    it('combines album updates with same media_group_id via debouncer', async () => {
      await Source.create({
        telegramChatId: '-1001234567890',
        title: 'Media Channel',
        type: 'channel',
        status: 'active',
      });

      const mediaGroupId = 'album_group_999';

      // Item 1
      await IngestionService.ingestMessage({
        message_id: 801,
        date: Math.floor(Date.now() / 1000),
        chat: { id: -1001234567890, type: 'channel' },
        media_group_id: mediaGroupId,
        caption: 'Beautiful landscape collection',
        photo: [
          { file_id: 'photo_thumb_1', file_unique_id: 'u1_thumb', width: 100, height: 100 },
          { file_id: 'photo_large_1', file_unique_id: 'u1_large', width: 800, height: 800 },
        ],
      });

      // Item 2
      await IngestionService.ingestMessage({
        message_id: 802,
        date: Math.floor(Date.now() / 1000),
        chat: { id: -1001234567890, type: 'channel' },
        media_group_id: mediaGroupId,
        photo: [
          { file_id: 'photo_thumb_2', file_unique_id: 'u2_thumb', width: 100, height: 100 },
          { file_id: 'photo_large_2', file_unique_id: 'u2_large', width: 800, height: 800 },
        ],
      });

      // Manually trigger flush to simulate debounce timer completion
      const flushed = await IngestionService.processFlushedAlbum(mediaGroupId, {
        mediaGroupId,
        telegramChatId: '-1001234567890',
        items: [
          {
            telegramMessageId: 801,
            mediaItem: {
              mediaType: 'photo',
              fileId: 'photo_large_1',
              fileUniqueId: 'u1_large',
              caption: 'Beautiful landscape collection',
            },
            text: 'Beautiful landscape collection',
          },
          {
            telegramMessageId: 802,
            mediaItem: {
              mediaType: 'photo',
              fileId: 'photo_large_2',
              fileUniqueId: 'u2_large',
            },
          },
        ],
        timer: null as unknown as NodeJS.Timeout,
      });

      expect(flushed).not.toBeNull();
      expect(flushed!.messageType).toBe('album');
      expect(flushed!.content.mediaItems.length).toBe(2);
      expect(flushed!.content.text).toBe('Beautiful landscape collection');
    });

    it('edits un-published message (Case A: status=draft/pending_approval)', async () => {
      await Source.create({
        telegramChatId: '-1001234567890',
        title: 'News Channel',
        type: 'channel',
        status: 'active',
      });

      // Ingest original
      await IngestionService.ingestMessage({
        message_id: 901,
        date: Math.floor(Date.now() / 1000),
        chat: { id: -1001234567890, type: 'channel' },
        text: 'Initial breaking news title with typo',
      });

      // Handle edited message
      const edited = await IngestionService.handleEditedMessage({
        message_id: 901,
        date: Math.floor(Date.now() / 1000) + 10,
        chat: { id: -1001234567890, type: 'channel' },
        text: 'Corrected breaking news title',
      });

      expect(edited).not.toBeNull();
      expect(edited!.content.text).toBe('Corrected breaking news title');
      expect(edited!.isEditedAtSource).toBe(false); // Un-published does not set warning flag
    });

    it('flags published message as edited at source without mutating published content (Case B)', async () => {
      const source = await Source.create({
        telegramChatId: '-1001234567890',
        title: 'News Channel',
        type: 'channel',
        status: 'active',
      });

      // Ingest original and simulate already published status
      const message = await Message.create({
        sourceId: source._id,
        telegramChatId: '-1001234567890',
        telegramMessageId: 902,
        messageType: 'text',
        content: { text: 'Published article original text', mediaItems: [] },
        status: 'published',
        deliverySummary: { targetCount: 1, successfulDestinationIds: [], failedDestinationIds: [] },
      });

      // Handle edited message
      const edited = await IngestionService.handleEditedMessage({
        message_id: 902,
        date: Math.floor(Date.now() / 1000) + 60,
        chat: { id: -1001234567890, type: 'channel' },
        text: 'Edited text that was already broadcasted',
      });

      expect(edited).not.toBeNull();
      expect(edited!._id.toString()).toBe(message._id.toString());
      // Content remains original so destination messages are not automatically altered
      expect(edited!.content.text).toBe('Published article original text');
      expect(edited!.isEditedAtSource).toBe(true);
      expect(edited!.sourceEditedAt).not.toBeNull();
    });
  });

  // ==========================================
  // WORKFLOW AUTOMATION TESTS (MANUAL & AUTOMATIC)
  // ==========================================
  describe('Workflow Execution (Manual vs Automatic)', () => {
    it('sets message status to pending_approval for manual_approval rules', async () => {
      const source = await Source.create({
        telegramChatId: '-1001234567890',
        title: 'Review Channel',
        type: 'channel',
        status: 'active',
      });
      const dest = await createVerifiedDestination('-100333', 'Target Channel');

      await ForwardingRule.create({
        name: 'Manual Approval Rule',
        sourceId: source._id,
        destinationIds: [dest._id],
        publishMode: 'copy',
        workflowType: 'manual_approval',
        isActive: true,
        priority: 1,
      });

      const message = await IngestionService.ingestMessage({
        message_id: 1001,
        date: Math.floor(Date.now() / 1000),
        chat: { id: -1001234567890, type: 'channel' },
        text: 'This post requires admin review before publishing',
      });

      expect(message).not.toBeNull();
      expect(message!.status).toBe('pending_approval');

      // Admin reviews in posts inbox and executes manual publish
      vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
        success: true,
        targetTelegramMessageId: 8888,
      });

      const publishResult = await PublishService.publishManual({
        messageId: message!._id.toString(),
        destinationIds: [dest._id.toString()],
        publishMode: 'copy',
      });

      expect(publishResult.aggregateStatus).toBe('published');
      expect(publishResult.successfulCount).toBe(1);

      const updatedMsg = await Message.findById(message!._id);
      expect(updatedMsg!.status).toBe('published');
    });

    it('automatically publishes message for automatic workflow rules and creates PublishLog entries', async () => {
      const source = await Source.create({
        telegramChatId: '-1001234567890',
        title: 'Auto Broadcast Channel',
        type: 'channel',
        status: 'active',
      });
      const dest = await createVerifiedDestination('-100444', 'Auto Target Channel');

      const rule = await ForwardingRule.create({
        name: 'Automatic Rule',
        sourceId: source._id,
        destinationIds: [dest._id],
        publishMode: 'copy',
        workflowType: 'automatic',
        isActive: true,
        priority: 5,
      });

      vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
        success: true,
        targetTelegramMessageId: 9999,
      });

      const message = await IngestionService.ingestMessage({
        message_id: 1002,
        date: Math.floor(Date.now() / 1000),
        chat: { id: -1001234567890, type: 'channel' },
        text: 'Automatic dispatch broadcast!',
      });

      expect(message).not.toBeNull();

      // Check that message was automatically published
      const refreshed = await Message.findById(message!._id);
      expect(refreshed!.status).toBe('published');
      expect(refreshed!.deliverySummary.successfulDestinationIds.length).toBe(1);

      // Verify PublishLog was created with ruleId
      const logs = await PublishLog.find({ messageId: message!._id });
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('success');
      expect(logs[0].ruleId!.toString()).toBe(rule._id.toString());
      expect(logs[0].destinationId.toString()).toBe(dest._id.toString());
    });

    it('handles Telegram failures gracefully during automatic workflow', async () => {
      const source = await Source.create({
        telegramChatId: '-1001234567890',
        title: 'Auto Fail Channel',
        type: 'channel',
        status: 'active',
      });
      const dest = await createVerifiedDestination('-100555', 'Failing Target Channel');

      const rule = await ForwardingRule.create({
        name: 'Failing Automatic Rule',
        sourceId: source._id,
        destinationIds: [dest._id],
        publishMode: 'copy',
        workflowType: 'automatic',
        isActive: true,
        priority: 1,
      });

      // Simulate Telegram API failure
      vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
        success: false,
        error: {
          code: 'TELEGRAM_API_ERROR',
          message: 'Chat not found on Telegram servers',
        },
      });

      const message = await IngestionService.ingestMessage({
        message_id: 1003,
        date: Math.floor(Date.now() / 1000),
        chat: { id: -1001234567890, type: 'channel' },
        text: 'Attempting auto dispatch that will fail',
      });

      expect(message).not.toBeNull();

      // Message status reflects failure
      const refreshed = await Message.findById(message!._id);
      expect(refreshed!.status).toBe('failed');
      expect(refreshed!.deliverySummary.failedDestinationIds.length).toBe(1);

      // Verify PublishLog recorded the error
      const logs = await PublishLog.find({ messageId: message!._id });
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('failed');
      expect(logs[0].error?.message).toBe('Chat not found on Telegram servers');
      expect(logs[0].ruleId!.toString()).toBe(rule._id.toString());
    });
  });
});
