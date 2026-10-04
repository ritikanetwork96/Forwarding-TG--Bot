import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './test-db.js';
import { User } from '../src/models/user.model.js';
import { Message } from '../src/models/message.model.js';
import { Category } from '../src/models/category.model.js';
import { Destination } from '../src/models/destination.model.js';
import { DestinationGroup } from '../src/models/destination-group.model.js';
import { PublishLog } from '../src/models/publish-log.model.js';
import { BotAdminAuthService } from '../src/telegram/admin/admin-auth.service.js';
import { BotAdminService } from '../src/telegram/admin/bot-admin.service.js';
import { BotKeyboardService } from '../src/telegram/admin/bot-keyboard.service.js';
import { botSessionManager } from '../src/telegram/admin/bot-session.service.js';
import { albumDebouncer } from '../src/telegram/debouncer.service.js';
import { TelegramService } from '../src/telegram/telegram.service.js';
import { CategoryService } from '../src/services/category.service.js';
import { DestinationService } from '../src/services/destination.service.js';
import { DestinationVerifierService } from '../src/telegram/verifier.service.js';
import { PublishService } from '../src/services/publish.service.js';
import { getTelegramBot } from '../src/telegram/bot.js';
import type { Context } from 'grammy';

describe('Phase 2B: Premium Telegram Bot Admin UI', () => {
  let webAuthToken: string;
  let adminUserId: string;
  const ADMIN_TELEGRAM_ID = 5615161833;
  const UNAUTHORIZED_TELEGRAM_ID = 111222333;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    botSessionManager.clearAll();
    albumDebouncer.clear();
    vi.restoreAllMocks();

    // 1. Create Web Panel Admin User
    const setupRes = await request(app).post('/api/auth/setup').send({
      email: 'botadmin@example.com',
      name: 'Bot Admin',
      password: 'Password123!',
    });
    webAuthToken = setupRes.body.data.token;
    adminUserId = setupRes.body.data.user._id;

    // Associate Telegram user ID with the created admin user in MongoDB
    await User.findByIdAndUpdate(adminUserId, {
      telegramUserId: String(ADMIN_TELEGRAM_ID),
    });
  });

  // Helper to create a verified destination
  async function createVerifiedDestination(chatId: string, title: string, canPublish = true) {
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
        canPublish,
        rights: {
          canPostMessages: canPublish,
          canSendMessages: canPublish,
          canEditMessages: canPublish,
          canDeleteMessages: canPublish,
          canManageTopics: false,
        },
        lastCheckedAt: new Date().toISOString(),
        failureReason: canPublish ? null : 'Missing permissions',
      },
    });
  }

  // Helper to build a mock GrammY context
  function createMockContext(options: {
    fromId: number;
    chatType?: 'private' | 'channel' | 'supergroup' | 'group';
    text?: string;
    caption?: string;
    photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number }>;
    video?: { file_id: string; file_unique_id: string; duration: number };
    document?: { file_id: string; file_unique_id: string; file_name: string; mime_type: string };
    mediaGroupId?: string;
    callbackData?: string;
    messageId?: number;
  }): {
    ctx: Context;
    replies: Array<{ text: string; options?: unknown }>;
    editedTexts: Array<{ text: string; options?: unknown }>;
    callbackAnswers: Array<{ text?: string; show_alert?: boolean }>;
  } {
    const replies: Array<{ text: string; options?: unknown }> = [];
    const editedTexts: Array<{ text: string; options?: unknown }> = [];
    const callbackAnswers: Array<{ text?: string; show_alert?: boolean }> = [];

    const ctx = {
      from: { id: options.fromId, is_bot: false, first_name: 'Tester' },
      chat: { id: options.fromId, type: options.chatType || 'private' },
      message: {
        message_id: options.messageId ?? 101,
        date: Math.floor(Date.now() / 1000),
        chat: { id: options.fromId, type: options.chatType || 'private' },
        from: { id: options.fromId, is_bot: false, first_name: 'Tester' },
        text: options.text,
        caption: options.caption,
        photo: options.photo,
        video: options.video,
        document: options.document,
        media_group_id: options.mediaGroupId,
      },
      callbackQuery: options.callbackData
        ? {
            id: 'cb_123',
            from: { id: options.fromId, is_bot: false, first_name: 'Tester' },
            data: options.callbackData,
            message: {
              message_id: 201,
              date: Math.floor(Date.now() / 1000),
              chat: { id: options.fromId },
            },
          }
        : undefined,
      reply: vi.fn(async (text: string, opts?: unknown) => {
        replies.push({ text, options: opts });
        return { message_id: 201 };
      }),
      editMessageText: vi.fn(async (text: string, opts?: unknown) => {
        editedTexts.push({ text, options: opts });
        return true;
      }),
      answerCallbackQuery: vi.fn(async (opts?: { text?: string; show_alert?: boolean }) => {
        callbackAnswers.push(opts || {});
        return true;
      }),
    } as unknown as Context;

    return { ctx, replies, editedTexts, callbackAnswers };
  }

  // ==========================================
  // 1. ADMIN AUTHORIZATION & COMMANDS
  // ==========================================
  describe('Admin Authorization', () => {
    it('authenticates authorized admin by telegramUserId in MongoDB', async () => {
      const admin = await BotAdminAuthService.getAuthorizedAdmin(ADMIN_TELEGRAM_ID);
      expect(admin).toBeDefined();
      expect(admin?.email).toBe('botadmin@example.com');
      expect(admin?.role).toBe('owner');
    });

    it('rejects unauthorized Telegram user', async () => {
      const admin = await BotAdminAuthService.getAuthorizedAdmin(UNAUTHORIZED_TELEGRAM_ID);
      expect(admin).toBeNull();
    });

    it('responds to /start with welcome details for authorized admin', async () => {
      const { ctx, replies } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        text: '/start',
      });

      await BotAdminService.handleStart(ctx);
      expect(replies.length).toBe(1);
      expect(replies[0]?.text).toContain('Publishing Console');
      expect(replies[0]?.text).toContain('Welcome back');
      expect(replies[0]?.text).toContain('/new');
    });

    it('rejects unauthorized user on /start with denial message', async () => {
      const { ctx, replies } = createMockContext({
        fromId: UNAUTHORIZED_TELEGRAM_ID,
        text: '/start',
      });

      await BotAdminService.handleStart(ctx);
      expect(replies.length).toBe(1);
      expect(replies[0]?.text).toContain('Access Denied');
    });

    it('lists categories on /categories', async () => {
      await Category.create({ name: 'Tech News', slug: 'tech-news' });
      const { ctx, replies } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        text: '/categories',
      });

      await BotAdminService.handleCategories(ctx);
      expect(replies[0]?.text).toContain('Tech News');
    });

    it('lists destinations on /destinations', async () => {
      await createVerifiedDestination('-100123', 'Alpha Channel');
      const { ctx, replies } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        text: '/destinations',
      });

      await BotAdminService.handleDestinations(ctx);
      expect(replies[0]?.text).toContain('Alpha Channel');
    });
  });

  // ==========================================
  // 2. INCOMING POST CREATION (SHARED DATA MODEL)
  // ==========================================
  describe('Incoming Post Authoring (Shared MongoDB State)', () => {
    it('creates a draft Message in MongoDB from text post sent to bot', async () => {
      const { ctx, replies } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        text: 'Direct post created from Telegram admin bot!',
      });

      await BotAdminService.handleAdminPrivateMessage(ctx);

      // Verify Message created in the SAME MongoDB collection
      const messages = await Message.find({
        'content.text': 'Direct post created from Telegram admin bot!',
      });
      expect(messages.length).toBe(1);
      const post = messages[0];
      expect(post?.status).toBe('draft');
      expect(post?.messageType).toBe('text');

      // Verify interactive Post Menu presented
      expect(replies.length).toBe(1);
      expect(replies[0]?.text).toContain('POST EDITOR');
      expect(replies[0]?.text).toContain('Direct post created from Telegram admin bot!');
    });

    it('creates multiple consecutive text posts without E11000 duplicate key error', async () => {
      const { ctx: ctx1 } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        text: 'BOT TEXT TEST 1',
        messageId: 1001,
      });
      await BotAdminService.handleAdminPrivateMessage(ctx1);

      const { ctx: ctx2 } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        text: 'BOT TEXT TEST 2',
        messageId: 1002,
      });
      await BotAdminService.handleAdminPrivateMessage(ctx2);

      const post1 = await Message.findOne({ 'content.text': 'BOT TEXT TEST 1' });
      const post2 = await Message.findOne({ 'content.text': 'BOT TEXT TEST 2' });

      expect(post1).toBeDefined();
      expect(post1?.telegramChatId).toBe(String(ADMIN_TELEGRAM_ID));
      expect(post1?.telegramMessageId).toBe(1001);

      expect(post2).toBeDefined();
      expect(post2?.telegramChatId).toBe(String(ADMIN_TELEGRAM_ID));
      expect(post2?.telegramMessageId).toBe(1002);
    });

    it('creates a draft Message for photo with caption without storing binary data', async () => {
      const { ctx, replies } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        caption: 'Stunning sunrise caption',
        photo: [
          { file_id: 'photo_thumb_1', file_unique_id: 'u_thumb', width: 100, height: 100 },
          { file_id: 'photo_full_1', file_unique_id: 'u_full', width: 800, height: 600 },
        ],
      });

      await BotAdminService.handleAdminPrivateMessage(ctx);

      const post = await Message.findOne({ 'content.text': 'Stunning sunrise caption' });
      expect(post).toBeDefined();
      expect(post?.messageType).toBe('photo');
      expect(post?.content.mediaItems.length).toBe(1);
      expect(post?.content.mediaItems[0]?.fileId).toBe('photo_full_1');
      expect(post?.content.mediaItems[0]?.fileUniqueId).toBe('u_full');
      expect(replies[0]?.text).toContain('sunrise');
    });

    it('creates a draft Message for video and document', async () => {
      const { ctx } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        caption: 'Instructional PDF',
        document: {
          file_id: 'doc_123',
          file_unique_id: 'u_doc_123',
          file_name: 'guide.pdf',
          mime_type: 'application/pdf',
        },
      });

      await BotAdminService.handleAdminPrivateMessage(ctx);

      const post = await Message.findOne({ 'content.text': 'Instructional PDF' });
      expect(post).toBeDefined();
      expect(post?.messageType).toBe('document');
      expect(post?.content.mediaItems[0]?.fileName).toBe('guide.pdf');
    });

    it('rejects incoming message from unauthorized user', async () => {
      const { ctx, replies } = createMockContext({
        fromId: UNAUTHORIZED_TELEGRAM_ID,
        text: 'Attempt to spam bot',
      });

      await BotAdminService.handleAdminPrivateMessage(ctx);

      const count = await Message.countDocuments();
      expect(count).toBe(0);
      expect(replies[0]?.text).toContain('Unauthorized');
    });
  });

  // ==========================================
  // 3. MEDIA ALBUM HANDLING
  // ==========================================
  describe('Album Debouncing & Grouping', () => {
    it('buffers album items and creates single grouped post on debounce flush', async () => {
      BotAdminService.initialize();

      const mediaGroupId = 'album_admin_999';

      // Item 1
      const ctx1 = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        caption: 'Awesome 2-photo album',
        mediaGroupId,
        photo: [{ file_id: 'img_1', file_unique_id: 'u_1', width: 400, height: 400 }],
      }).ctx;

      // Item 2
      const ctx2 = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        mediaGroupId,
        photo: [{ file_id: 'img_2', file_unique_id: 'u_2', width: 400, height: 400 }],
      }).ctx;

      await BotAdminService.handleAdminPrivateMessage(ctx1);
      await BotAdminService.handleAdminPrivateMessage(ctx2);

      // Initially debouncing
      let count = await Message.countDocuments();
      expect(count).toBe(0);

      // Wait for debounce timer to fire
      await new Promise((resolve) => setTimeout(resolve, 700));

      count = await Message.countDocuments();
      expect(count).toBe(1);

      const albumPost = await Message.findOne({ mediaGroupId });
      expect(albumPost).toBeDefined();
      expect(albumPost?.messageType).toBe('album');
      expect(albumPost?.content.mediaItems.length).toBe(2);
      expect(albumPost?.content.text).toBe('Awesome 2-photo album');
    });
  });

  // ==========================================
  // 4. INLINE KEYBOARDS & NAVIGATION
  // ==========================================
  describe('Inline Keyboard & Selectors', () => {
    let testMessageId: string;
    let catId: string;
    let dest1Id: string;
    let dest2Id: string;

    beforeEach(async () => {
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Test selector post' },
        status: 'draft',
      });
      testMessageId = msg._id.toString();

      const cat = await Category.create({ name: 'Crypto', slug: 'crypto' });
      catId = cat._id.toString();

      const d1 = await createVerifiedDestination('-10011', 'Crypto News');
      const d2 = await createVerifiedDestination('-10012', 'Trading Signals');
      dest1Id = d1._id.toString();
      dest2Id = d2._id.toString();
    });

    it('renders category selector and updates MongoDB message on selection', async () => {
      // 1. View categories
      const { ctx: viewCtx, editedTexts: viewTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${testMessageId}:view_cats`,
      });
      await BotAdminService.handleCallbackQuery(viewCtx);
      expect(viewTexts[0]?.text).toContain('Select Category');

      // 2. Select category
      const { ctx: selCtx, callbackAnswers: selAnswers } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${testMessageId}:sc:${catId}`,
      });
      await BotAdminService.handleCallbackQuery(selCtx);
      expect(selAnswers[0]?.text).toBe('Category updated');

      // 3. Verify category updated in SAME MongoDB message
      const updated = await Message.findById(testMessageId);
      expect(updated?.categoryId?.toString()).toBe(catId);
    });

    it('supports multi-destination selection with toggle, all, and clear', async () => {
      // Toggle dest1
      const { ctx: t1Ctx } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${testMessageId}:td:${dest1Id}`,
      });
      await BotAdminService.handleCallbackQuery(t1Ctx);

      const session = botSessionManager.getOrCreate(testMessageId);
      expect(session.selectedDestinationIds.has(dest1Id)).toBe(true);

      // Toggle dest2
      const { ctx: t2Ctx } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${testMessageId}:td:${dest2Id}`,
      });
      await BotAdminService.handleCallbackQuery(t2Ctx);
      expect(session.selectedDestinationIds.has(dest2Id)).toBe(true);

      // Clear all
      const { ctx: clrCtx } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${testMessageId}:d_clr`,
      });
      await BotAdminService.handleCallbackQuery(clrCtx);
      expect(session.selectedDestinationIds.size).toBe(0);

      // Select all verified
      const { ctx: allCtx } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${testMessageId}:d_all`,
      });
      await BotAdminService.handleCallbackQuery(allCtx);
      expect(session.selectedDestinationIds.size).toBe(2);
    });

    it('supports destination groups selection and resolves member destinations', async () => {
      const group = await DestinationGroup.create({
        name: 'VIP Channels',
        destinationIds: [dest1Id, dest2Id],
        status: 'active',
      });
      const groupId = group._id.toString();

      // Toggle group
      const { ctx: tgCtx } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${testMessageId}:tg:${groupId}`,
      });
      await BotAdminService.handleCallbackQuery(tgCtx);

      const session = botSessionManager.getOrCreate(testMessageId);
      expect(session.selectedGroupIds.has(groupId)).toBe(true);

      // Resolve session
      const resolved = await BotAdminService.resolveSessionDestinations(session);
      expect(resolved.length).toBe(2);
      expect(resolved.some((r) => r.id === dest1Id)).toBe(true);
      expect(resolved.some((r) => r.id === dest2Id)).toBe(true);
    });

    it('toggles publish mode between copy and forward', async () => {
      const session = botSessionManager.getOrCreate(testMessageId);
      expect(session.publishMode).toBe('copy');

      const { ctx: togCtx } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${testMessageId}:toggle_mode`,
      });
      await BotAdminService.handleCallbackQuery(togCtx);
      expect(session.publishMode).toBe('forward');
    });

    it('opens schedule date picker on ⏰ Schedule button click', async () => {
      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${testMessageId}:sch`,
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(editedTexts[0]?.text).toContain('SCHEDULE POST');
      expect(editedTexts[0]?.text).toContain('Choose when to broadcast');
    });

    it('handles cancellation and preserves draft in MongoDB', async () => {
      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${testMessageId}:cnc`,
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(editedTexts[0]?.text).toContain('Post cancelled.');

      // Preserved in MongoDB
      const post = await Message.findById(testMessageId);
      expect(post).toBeDefined();
      expect(post?.status).toBe('draft');
    });
  });

  // ==========================================
  // 5. PUBLISH EXECUTION & SAFETY
  // ==========================================
  describe('Publish Execution, Logs & Idempotency', () => {
    let testMessageId: string;
    let dest1: Awaited<ReturnType<typeof createVerifiedDestination>>;
    let dest2: Awaited<ReturnType<typeof createVerifiedDestination>>;

    beforeEach(async () => {
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Ready for broadcast' },
        status: 'draft',
      });
      testMessageId = msg._id.toString();

      dest1 = await createVerifiedDestination('-10031', 'Live Channel 1');
      dest2 = await createVerifiedDestination('-10032', 'Live Channel 2');
    });

    it('publishes via existing PublishService pipeline and records PublishLogs', async () => {
      const session = botSessionManager.getOrCreate(testMessageId);
      session.selectedDestinationIds.add(dest1._id.toString());
      session.selectedDestinationIds.add(dest2._id.toString());

      vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
        success: true,
        targetTelegramMessageId: 888,
        targetTelegramMessageIds: [888],
      });

      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${testMessageId}:confirm_pub`,
      });

      await BotAdminService.handleCallbackQuery(ctx);

      // Verify Message status updated to published
      const updatedPost = await Message.findById(testMessageId);
      expect(updatedPost?.status).toBe('published');
      expect(updatedPost?.deliverySummary.successfulDestinationIds.length).toBe(2);

      // Verify immutable PublishLog records created with triggeredBy
      const logs = await PublishLog.find({ messageId: testMessageId });
      expect(logs.length).toBe(2);
      expect(logs[0]?.triggeredBy?.toString()).toBe(adminUserId);
      expect(logs[0]?.status).toBe('success');

      // Result UX shows success
      expect(editedTexts[0]?.text).toContain('Published Successfully');
      expect(editedTexts[0]?.text).toContain('Live Channel 1 ✅');
    });

    it('handles partial failure and offers retry', async () => {
      const session = botSessionManager.getOrCreate(testMessageId);
      session.selectedDestinationIds.add(dest1._id.toString());
      session.selectedDestinationIds.add(dest2._id.toString());

      // dest1 succeeds, dest2 fails
      vi.spyOn(TelegramService, 'publishMessage').mockImplementation(async (opts) => {
        if (opts.toChatId === dest1.telegramChatId) {
          return { success: true, targetTelegramMessageId: 889 };
        }
        return {
          success: false,
          errorCode: 'CHAT_NOT_FOUND',
          errorMessage: 'Bad chat',
        };
      });

      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${testMessageId}:confirm_pub`,
      });

      await BotAdminService.handleCallbackQuery(ctx);

      const updatedPost = await Message.findById(testMessageId);
      expect(updatedPost?.status).toBe('partially_published');

      expect(editedTexts[0]?.text).toContain('Partially Published');
      expect(editedTexts[0]?.text).toContain('Live Channel 1 ✅');
      expect(editedTexts[0]?.text).toContain('Live Channel 2 ❌');
    });

    it('guards against double-publishing via idempotency guard', async () => {
      const session = botSessionManager.getOrCreate(testMessageId);
      session.selectedDestinationIds.add(dest1._id.toString());
      session.isPublishing = true; // Simulating active in-flight publish

      const { ctx, callbackAnswers } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${testMessageId}:confirm_pub`,
      });

      await BotAdminService.handleCallbackQuery(ctx);
      expect(callbackAnswers[0]?.text).toContain('already in progress');
    });

    it('rejects unverified and disabled destinations from publish targets', async () => {
      const unverified = await createVerifiedDestination('-10099', 'Unverified Dest', false);
      const disabled = await Destination.create({
        telegramChatId: '-10098',
        title: 'Disabled Dest',
        type: 'channel',
        status: 'disabled',
        verification: { canPublish: true, chatType: 'channel' },
      });

      const session = botSessionManager.getOrCreate(testMessageId);
      session.selectedDestinationIds.add(unverified._id.toString());
      session.selectedDestinationIds.add(disabled._id.toString());

      const resolved = await BotAdminService.resolveSessionDestinations(session);
      expect(resolved.length).toBe(0);
    });
  });

  // ==========================================
  // 6. BOT ↔ WEB SYNCHRONIZATION
  // ==========================================
  describe('Bot ↔ Web Panel Synchronization', () => {
    it('bot-created post immediately appears in Web Panel GET /api/posts', async () => {
      // 1. Bot creates post
      const { ctx } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        text: 'Post created via Telegram bot for web verification',
      });
      await BotAdminService.handleAdminPrivateMessage(ctx);

      // 2. Web API retrieves posts
      const res = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${webAuthToken}`);

      expect(res.status).toBe(200);
      const posts = res.body.data;
      const found = posts.find(
        (p: { content: { text?: string } }) =>
          p.content.text === 'Post created via Telegram bot for web verification'
      );
      expect(found).toBeDefined();
      expect(found.status).toBe('draft');
    });

    it('bot-published log immediately appears in Web Panel GET /api/publish/logs', async () => {
      const dest = await createVerifiedDestination('-10055', 'Sync Dest');
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Sync log test' },
        status: 'draft',
      });

      const session = botSessionManager.getOrCreate(msg._id.toString());
      session.selectedDestinationIds.add(dest._id.toString());

      vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
        success: true,
        targetTelegramMessageId: 999,
      });

      // Publish via bot callback
      const { ctx } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${msg._id}:confirm_pub`,
      });
      await BotAdminService.handleCallbackQuery(ctx);

      // Verify log appears in Web API
      const res = await request(app)
        .get('/api/logs')
        .set('Authorization', `Bearer ${webAuthToken}`);

      expect(res.status).toBe(200);
      const logs = res.body.data;
      expect(logs.length).toBeGreaterThan(0);
      const foundLog = logs.find((l: { messageId?: string }) => l.messageId === msg._id.toString());
      expect(foundLog).toBeDefined();
      expect(foundLog.status).toBe('success');
    });
  });

  // ==========================================
  // 7. PHASE 3.1: GLOBAL NAVIGATION, STATE MACHINE & PUBLISHING IDENTITY
  // ==========================================
  describe('Phase 3.1: Global Navigation, State Machine & Publishing Identity Regression Suite', () => {
    it('1. /start opens main menu (executive dashboard)', async () => {
      const { ctx, replies } = createMockContext({ fromId: ADMIN_TELEGRAM_ID, text: '/start' });
      await BotAdminService.handleStart(ctx);
      expect(replies[0]?.text).toContain('Publishing Console');
      expect(replies[0]?.text).toContain('System Status');
      expect(replies[0]?.text).toContain('🟢 Bot Online');
      expect(replies[0]?.text).toContain('🟢 Database Connected');
      expect(replies[0]?.text).toContain('Quick');
    });

    it('2. New Post opens empty new-post state', async () => {
      const { ctx, replies } = createMockContext({ fromId: ADMIN_TELEGRAM_ID, text: '/new' });
      await BotAdminService.handleNew(ctx);
      expect(replies[0]?.text).toContain('NEW POST');
      expect(replies[0]?.text).toContain('Send text, photo, video, document');
      expect(botSessionManager.getAdminState(ADMIN_TELEGRAM_ID)?.state).toBe('NEW_POST_WAITING');
    });

    it('3. Back from empty New Post returns Main Menu', async () => {
      botSessionManager.setAdminState(ADMIN_TELEGRAM_ID, 'NEW_POST_WAITING');
      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:main',
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(editedTexts[0]?.text).toContain('Publishing Console');
      expect(botSessionManager.getAdminState(ADMIN_TELEGRAM_ID)).toBeNull();
    });

    it('4. Empty New Post does not create Message or draft in MongoDB', async () => {
      const beforeCount = await Message.countDocuments();
      botSessionManager.setAdminState(ADMIN_TELEGRAM_ID, 'NEW_POST_WAITING');
      const { ctx } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:main',
      });
      await BotAdminService.handleCallbackQuery(ctx);
      const afterCount = await Message.countDocuments();
      expect(afterCount).toBe(beforeCount);
    });

    it('5. Category screen has Back to Main Menu', async () => {
      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:cats',
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(editedTexts[0]?.text).toContain('Categories');
      const keyboard = (editedTexts[0]?.options as any)?.reply_markup;
      const backBtn = keyboard?.inline_keyboard
        ?.flat()
        .find((b: any) => b.callback_data === 'nav:main');
      expect(backBtn).toBeDefined();
      expect(backBtn?.text).toContain('Back');
    });

    it('6. Destination screen has Back to Main Menu', async () => {
      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:dests',
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(editedTexts[0]?.text).toContain('Destinations');
      const keyboard = (editedTexts[0]?.options as any)?.reply_markup;
      const backBtn = keyboard?.inline_keyboard
        ?.flat()
        .find((b: any) => b.callback_data === 'nav:main');
      expect(backBtn).toBeDefined();
      expect(backBtn?.text).toContain('Back');
    });

    it('7. Recent Posts has Back to Main Menu', async () => {
      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:recent',
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(editedTexts[0]?.text).toContain('Recent Posts');
      const keyboard = (editedTexts[0]?.options as any)?.reply_markup;
      const backBtn = keyboard?.inline_keyboard
        ?.flat()
        .find((b: any) => b.callback_data === 'nav:main');
      expect(backBtn).toBeDefined();
      expect(backBtn?.text).toContain('Back');
    });

    it('8. Post Details has Back to Recent Posts and Main Menu', async () => {
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Details navigation post' },
        status: 'published',
      });
      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `v:post:${msg._id.toString()}`,
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(editedTexts[0]?.text).toContain('POST DETAILS');
      const keyboard = (editedTexts[0]?.options as any)?.reply_markup;
      const backBtn = keyboard?.inline_keyboard
        ?.flat()
        .find((b: any) => b.callback_data === 'nav:recent');
      const mainBtn = keyboard?.inline_keyboard
        ?.flat()
        .find((b: any) => b.callback_data === 'nav:main');
      expect(backBtn).toBeDefined();
      expect(mainBtn).toBeDefined();
    });

    it('9. Drafts screen has Back to Main Menu', async () => {
      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:drafts',
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(editedTexts[0]?.text).toContain('Drafts');
      const keyboard = (editedTexts[0]?.options as any)?.reply_markup;
      const backBtn = keyboard?.inline_keyboard
        ?.flat()
        .find((b: any) => b.callback_data === 'nav:main');
      expect(backBtn).toBeDefined();
      expect(backBtn?.text).toContain('Back');
    });

    it('10. Settings screen has Back to Main Menu', async () => {
      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:settings',
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(editedTexts[0]?.text).toContain('SETTINGS');
      const keyboard = (editedTexts[0]?.options as any)?.reply_markup;
      const backBtn = keyboard?.inline_keyboard
        ?.flat()
        .find((b: any) => b.callback_data === 'nav:main');
      expect(backBtn).toBeDefined();
      expect(backBtn?.text).toContain('Back');
    });

    it('11. Help screen has Back to Main Menu', async () => {
      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:help',
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(editedTexts[0]?.text).toContain('HELP');
      const keyboard = (editedTexts[0]?.options as any)?.reply_markup;
      const backBtn = keyboard?.inline_keyboard
        ?.flat()
        .find((b: any) => b.callback_data === 'nav:main');
      expect(backBtn).toBeDefined();
      expect(backBtn?.text).toContain('Back');
    });

    it('12. Main Menu button returns MAIN state from any submenu', async () => {
      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:main',
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(editedTexts[0]?.text).toContain('Publishing Console');
    });

    it('13. stale or expired callback handled safely without crashing', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const { ctx, editedTexts, callbackAnswers } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${fakeId}:menu`,
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(callbackAnswers[0]?.show_alert).toBe(true);
      expect(editedTexts[0]?.text).toContain('expired');
      const keyboard = (editedTexts[0]?.options as any)?.reply_markup;
      const mainBtn = keyboard?.inline_keyboard
        ?.flat()
        .find((b: any) => b.callback_data === 'nav:main');
      expect(mainBtn).toBeDefined();
    });

    it('14. cancel clears active session and preserves draft in MongoDB', async () => {
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Cancel preservation check' },
        status: 'draft',
      });
      botSessionManager.getOrCreate(msg._id.toString());
      expect(botSessionManager.get(msg._id.toString())).toBeDefined();

      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${msg._id.toString()}:cnc`,
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(editedTexts[0]?.text).toContain('Post cancelled');
      expect(botSessionManager.get(msg._id.toString())).toBeNull();

      const preserved = await Message.findById(msg._id);
      expect(preserved).toBeDefined();
      expect(preserved?.status).toBe('draft');
    });

    it('15. category rename reflected in bot UI immediately from MongoDB', async () => {
      const cat = await Category.create({ name: 'Alpha Cat', slug: 'alpha-cat' });
      const view1 = await BotKeyboardService.renderCategoryList();
      expect(view1.text).toContain('Alpha Cat');

      await CategoryService.update(cat._id.toString(), { name: 'Beta Renamed Cat' });
      const view2 = await BotKeyboardService.renderCategoryList();
      expect(view2.text).toContain('Beta Renamed Cat');
      expect(view2.text).not.toContain('Alpha Cat');
    });

    it('16. destination rename reflected in bot UI immediately from MongoDB', async () => {
      const dest = await createVerifiedDestination('-100654', 'Original Channel Title');
      const view1 = await BotKeyboardService.renderDestinationList();
      expect(view1.text).toContain('Original Channel Title');

      await DestinationService.update(dest._id.toString(), { title: 'Executive Channel Renamed' });
      const view2 = await BotKeyboardService.renderDestinationList();
      expect(view2.text).toContain('Executive Channel Renamed');
    });

    it('17. category icon/custom emoji metadata persists and formats gracefully', async () => {
      const cat = await CategoryService.create({
        name: 'VIP Crypto',
        displayName: '💎 VIP Crypto Club',
        iconEmoji: '💎',
        customEmojiId: 'tg_emoji_9988',
      });

      expect(cat.displayName).toBe('💎 VIP Crypto Club');
      expect(cat.iconEmoji).toBe('💎');
      expect(cat.customEmojiId).toBe('tg_emoji_9988');

      const formattedHtml = BotKeyboardService.formatCategoryHtml(cat);
      expect(formattedHtml).toContain('<tg-emoji emoji-id="tg_emoji_9988">💎</tg-emoji>');
      expect(formattedHtml).toContain('VIP Crypto Club');
    });

    it('18. copy mode uses copy semantics and default mode is copy', async () => {
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Copy default test' },
        status: 'draft',
      });
      const session = botSessionManager.getOrCreate(msg._id.toString());
      expect(session.publishMode).toBe('copy');
    });

    it('19. forward mode uses forward semantics when toggled', async () => {
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Forward toggle test' },
        status: 'draft',
      });
      const session = botSessionManager.getOrCreate(msg._id.toString());
      const { ctx } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${msg._id.toString()}:toggle_mode`,
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(session.publishMode).toBe('forward');
    });

    it('20. unsupported send-as capability handled safely for standard bot', () => {
      const dest = {
        title: 'Regular Supergroup',
        telegramChatId: '-100444',
        type: 'supergroup',
        status: 'active',
        verification: {
          canPublish: true,
          canSendAsChat: false,
          senderIdentity: 'bot',
          botRole: 'administrator',
        },
      } as any;
      const view = BotKeyboardService.renderDestinationDetails(dest);
      expect(view.text).toContain('Standard Bot');
      expect(view.text).toContain('Bot Identity');
    });

    it('21. anonymous/group destination identity capability is correctly detected', async () => {
      const bot = getTelegramBot();
      vi.spyOn(bot.api, 'getChat').mockResolvedValue({
        id: -100777,
        type: 'supergroup',
        title: 'Anonymous Group',
      } as any);
      vi.spyOn(bot.api, 'getChatMember').mockResolvedValue({
        status: 'administrator',
        is_anonymous: true,
      } as any);

      const probe = await DestinationVerifierService.probeDestination('-100777');
      expect(probe.verification.canSendAsChat).toBe(true);
      expect(probe.verification.senderIdentity).toBe('anonymous_admin');
    });

    it('22. channel destination identity capability is correctly detected', async () => {
      const bot = getTelegramBot();
      vi.spyOn(bot.api, 'getChat').mockResolvedValue({
        id: -100888,
        type: 'channel',
        title: 'Broadcast Channel',
      } as any);
      vi.spyOn(bot.api, 'getChatMember').mockResolvedValue({
        status: 'administrator',
        can_post_messages: true,
      } as any);

      const probe = await DestinationVerifierService.probeDestination('-100888');
      expect(probe.verification.canSendAsChat).toBe(true);
      expect(probe.verification.senderIdentity).toBe('channel');
    });

    it('23. preview does not publish and leaves post in draft status', async () => {
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Preview integrity test post' },
        status: 'draft',
      });
      const pubSpy = vi.spyOn(PublishService, 'publishManual');

      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${msg._id.toString()}:preview`,
      });
      await BotAdminService.handleCallbackQuery(ctx);

      expect(pubSpy).not.toHaveBeenCalled();
      expect(editedTexts[0]?.text).toContain('POST PREVIEW');
      expect(editedTexts[0]?.text).toContain('Preview integrity test post');

      const unchanged = await Message.findById(msg._id);
      expect(unchanged?.status).toBe('draft');
    });

    it('24. no duplicate Telegram UI messages for navigation where edit is possible', async () => {
      const { ctx, replies, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:recent',
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(editedTexts.length).toBe(1);
      expect(replies.length).toBe(0);
    });

    it('25. callback is acknowledged immediately via answerCallbackQuery', async () => {
      const { ctx, callbackAnswers } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:help',
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(callbackAnswers.length).toBeGreaterThan(0);
    });

    it('26. recent post -> post details -> back -> recent posts navigation flow', async () => {
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Navigation flow message' },
        status: 'published',
      });

      // 1. Post Details
      const { ctx: detailCtx, editedTexts: detailTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `v:post:${msg._id.toString()}`,
      });
      await BotAdminService.handleCallbackQuery(detailCtx);
      expect(detailTexts[0]?.text).toContain('POST DETAILS');

      // 2. Back to Recent Posts
      const { ctx: backCtx, editedTexts: backTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:recent',
      });
      await BotAdminService.handleCallbackQuery(backCtx);
      expect(backTexts[0]?.text).toContain('Recent Posts');
    });

    it('27. recent posts -> main menu navigation flow', async () => {
      const { ctx, editedTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:main',
      });
      await BotAdminService.handleCallbackQuery(ctx);
      expect(editedTexts[0]?.text).toContain('Publishing Console');
    });

    it('28. destinations -> destination details -> back navigation flow', async () => {
      const dest = await createVerifiedDestination('-100345', 'Nav Destination Test');

      // 1. View Details
      const { ctx: detailCtx, editedTexts: detailTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `v:dest:${dest._id.toString()}`,
      });
      await BotAdminService.handleCallbackQuery(detailCtx);
      expect(detailTexts[0]?.text).toContain('DESTINATION DETAILS');
      expect(detailTexts[0]?.text).toContain('Nav Destination Test');

      // 2. Back to Destinations
      const { ctx: backCtx, editedTexts: backTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:dests',
      });
      await BotAdminService.handleCallbackQuery(backCtx);
      expect(backTexts[0]?.text).toContain('Target Destinations');
    });

    it('29. categories -> category details -> back navigation flow', async () => {
      const cat = await Category.create({ name: 'Nav Cat Test', slug: 'nav-cat-test' });

      // 1. View Details
      const { ctx: detailCtx, editedTexts: detailTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `v:cat:${cat._id.toString()}`,
      });
      await BotAdminService.handleCallbackQuery(detailCtx);
      expect(detailTexts[0]?.text).toContain('CATEGORY DETAILS');
      expect(detailTexts[0]?.text).toContain('Nav Cat Test');

      // 2. Back to Categories
      const { ctx: backCtx, editedTexts: backTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:cats',
      });
      await BotAdminService.handleCallbackQuery(backCtx);
      expect(backTexts[0]?.text).toContain('Content Categories');
    });

    it('30. New Post -> editor -> back -> main menu flow', async () => {
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Wizard to main menu flow' },
        status: 'draft',
      });

      // 1. Cancel active post
      const { ctx: cncCtx, editedTexts: cncTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${msg._id.toString()}:cnc`,
      });
      await BotAdminService.handleCallbackQuery(cncCtx);
      expect(cncTexts[0]?.text).toContain('Post cancelled');

      // 2. Main Menu
      const { ctx: mainCtx, editedTexts: mainTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:main',
      });
      await BotAdminService.handleCallbackQuery(mainCtx);
      expect(mainTexts[0]?.text).toContain('Publishing Console');
    });

    it('31. publish success -> result -> main menu flow', async () => {
      const dest = await createVerifiedDestination('-100801', 'Flow Live Dest');
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Flow live test' },
        status: 'draft',
      });
      const session = botSessionManager.getOrCreate(msg._id.toString());
      session.selectedDestinationIds.add(dest._id.toString());

      vi.spyOn(TelegramService, 'publishMessage').mockResolvedValue({
        success: true,
        targetTelegramMessageId: 7771,
      });

      const { ctx: pubCtx, editedTexts: pubTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${msg._id.toString()}:confirm_pub`,
      });
      await BotAdminService.handleCallbackQuery(pubCtx);
      expect(pubTexts[0]?.text).toContain('Published Successfully');

      const { ctx: mainCtx, editedTexts: mainTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: 'nav:main',
      });
      await BotAdminService.handleCallbackQuery(mainCtx);
      expect(mainTexts[0]?.text).toContain('Publishing Console');
    });

    it('32. publish partial -> retry failed -> result updated', async () => {
      const dest1 = await createVerifiedDestination('-100802', 'Flow Dest 1');
      const dest2 = await createVerifiedDestination('-100803', 'Flow Dest 2');
      const msg = await Message.create({
        messageType: 'text',
        content: { text: 'Partial retry flow post' },
        status: 'draft',
      });
      const session = botSessionManager.getOrCreate(msg._id.toString());
      session.selectedDestinationIds.add(dest1._id.toString());
      session.selectedDestinationIds.add(dest2._id.toString());

      let retryCallCount = 0;
      vi.spyOn(TelegramService, 'publishMessage').mockImplementation(async (opts) => {
        if (opts.toChatId === dest1.telegramChatId) {
          return { success: true, targetTelegramMessageId: 101 };
        }
        if (retryCallCount > 0) {
          return { success: true, targetTelegramMessageId: 102 };
        }
        return { success: false, errorCode: 'TELEGRAM_API_ERROR', errorMessage: 'Temporary fail' };
      });

      // 1. Initial publish (partial)
      const { ctx: pubCtx, editedTexts: pubTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${msg._id.toString()}:confirm_pub`,
      });
      await BotAdminService.handleCallbackQuery(pubCtx);
      expect(pubTexts[0]?.text).toContain('Partially Published');

      // 2. Retry failed
      retryCallCount++;
      const { ctx: retryCtx, editedTexts: retryTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${msg._id.toString()}:retry`,
      });
      await BotAdminService.handleCallbackQuery(retryCtx);
      expect(retryTexts[0]?.text).toContain('Published Successfully');
    });

    it('33. draft open -> editor -> back navigation flow', async () => {
      const draft = await Message.create({
        messageType: 'text',
        content: { text: 'Draft to open flow' },
        status: 'draft',
      });

      // 1. Open Draft
      const { ctx: openCtx, editedTexts: openTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `dr:open:${draft._id.toString()}`,
      });
      await BotAdminService.handleCallbackQuery(openCtx);
      expect(openTexts[0]?.text).toContain('POST EDITOR');
      expect(openTexts[0]?.text).toContain('Draft to open flow');

      // 2. Cancel Draft editing
      const { ctx: cancelCtx, editedTexts: cancelTexts } = createMockContext({
        fromId: ADMIN_TELEGRAM_ID,
        callbackData: `b:${draft._id.toString()}:cnc`,
      });
      await BotAdminService.handleCallbackQuery(cancelCtx);
      expect(cancelTexts[0]?.text).toContain('Post cancelled');
    });

    it('34. no destinations empty state displays helpful hint and Back button', async () => {
      const view = await BotKeyboardService.renderDestinationList();
      expect(view.text).toContain('No active destinations configured');
      const keyboard = view.keyboard as any;
      const backBtn = keyboard?.inline_keyboard
        ?.flat()
        .find((b: any) => b.callback_data === 'nav:main');
      expect(backBtn).toBeDefined();
    });

    it('35. no categories empty state displays helpful hint and Back button', async () => {
      const view = await BotKeyboardService.renderCategoryList();
      expect(view.text).toContain('No categories configured yet');
      const keyboard = view.keyboard as any;
      const backBtn = keyboard?.inline_keyboard
        ?.flat()
        .find((b: any) => b.callback_data === 'nav:main');
      expect(backBtn).toBeDefined();
    });

    it('36. no recent posts empty state displays helpful hint and New Post button', async () => {
      const view = await BotKeyboardService.renderRecentPosts();
      expect(view.text).toContain('No recent posts found');
      const keyboard = view.keyboard as any;
      const newBtn = keyboard?.inline_keyboard
        ?.flat()
        .find((b: any) => b.callback_data === 'nav:new');
      const backBtn = keyboard?.inline_keyboard
        ?.flat()
        .find((b: any) => b.callback_data === 'nav:main');
      expect(newBtn).toBeDefined();
      expect(backBtn).toBeDefined();
    });
  });
});
