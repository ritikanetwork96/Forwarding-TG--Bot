import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './test-db.js';
import { Destination } from '../src/models/destination.model.js';
import { Message } from '../src/models/message.model.js';
import { ScheduledPost } from '../src/models/scheduled-post.model.js';
import { PublishLog } from '../src/models/publish-log.model.js';

describe('Dashboard Telemetry & KPI Endpoints (Phase 5B)', () => {
  let authToken: string;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Create owner user to obtain auth token
    const setupRes = await request(app).post('/api/auth/setup').send({
      email: 'owner@forwarder.pro',
      name: 'Owner Admin',
      username: 'owner',
      password: 'Password123!',
    });
    authToken = setupRes.body.data.token;
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns valid DashboardStatsDTO on initial empty database with neutral N/A success rate', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stats = res.body.data;
    expect(stats).toBeDefined();

    // KPIs
    expect(stats.kpis.destinations).toEqual({ total: 0, verified: 0, disabled: 0 });
    expect(stats.kpis.drafts).toEqual({ total: 0, inbound: 0 });
    expect(stats.kpis.scheduled).toEqual({ total: 0, todayDue: 0, nextRunAt: null });
    expect(stats.kpis.queue).toBeDefined();
    expect(stats.kpis.queue.workerStatus).toBeDefined();

    // Success Rate must be neutral N/A when 0 completed delivery attempts
    expect(stats.kpis.delivery24h.total).toBe(0);
    expect(stats.kpis.delivery24h.successRate).toBeNull();
    expect(stats.kpis.delivery24h.displayRate).toBe('N/A');

    // Attention
    expect(stats.attention.hasFailures).toBe(false);
    expect(stats.attention.failureCount).toBe(0);
    expect(stats.attention.failedItems).toEqual([]);

    // Lists
    expect(stats.upcomingSchedules).toEqual([]);
    expect(stats.recentActivity).toEqual([]);

    // Infrastructure
    expect(stats.infrastructure.mongo.status).toBe('connected');
    expect(stats.infrastructure.overallStatus).toBeDefined();
  });

  it('calculates 24h success rate correctly and surfaces failures in attention banner', async () => {
    // 1. Create a destination
    const dest = await Destination.create({
      title: 'Alpha VIP Channel',
      telegramChatId: '-1001234567890',
      type: 'channel',
      status: 'active',
      verification: {
        canPublish: true,
        isBotAdmin: true,
        canPostMessages: true,
        canEditMessages: true,
        canDeleteMessages: true,
        verifiedAt: new Date(),
      },
    });

    // 2. Create a test message
    const msg = await Message.create({
      messageType: 'text',
      content: { text: 'Alpha Signal Post' },
      status: 'published',
      deliverySummary: { totalTargets: 4, successful: 3, failed: 1 },
    });

    // 3. Create 3 successful logs and 1 failed log in last 24h
    await PublishLog.create([
      {
        messageId: msg._id,
        destinationId: dest._id,
        publishMode: 'copy',
        status: 'success',
        executionTimeMs: 45,
        targetTelegramMessageIds: [101],
      },
      {
        messageId: msg._id,
        destinationId: dest._id,
        publishMode: 'copy',
        status: 'success',
        executionTimeMs: 50,
        targetTelegramMessageIds: [102],
      },
      {
        messageId: msg._id,
        destinationId: dest._id,
        publishMode: 'forward',
        status: 'success',
        executionTimeMs: 62,
        targetTelegramMessageIds: [103],
      },
      {
        messageId: msg._id,
        destinationId: dest._id,
        publishMode: 'copy',
        status: 'failed',
        executionTimeMs: 12,
        targetTelegramMessageIds: [],
        error: {
          code: 'CHAT_ADMIN_REQUIRED',
          message: 'Telegram API returned: CHAT_ADMIN_REQUIRED',
        },
      },
    ]);

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const stats = res.body.data;

    // Delivery metrics: 3 success / 4 total = 75.0%
    expect(stats.kpis.delivery24h.total).toBe(4);
    expect(stats.kpis.delivery24h.success).toBe(3);
    expect(stats.kpis.delivery24h.failed).toBe(1);
    expect(stats.kpis.delivery24h.successRate).toBe(75.0);
    expect(stats.kpis.delivery24h.displayRate).toBe('75%');

    // Attention Required: 1 failure
    expect(stats.attention.hasFailures).toBe(true);
    expect(stats.attention.failureCount).toBe(1);
    expect(stats.attention.failedItems.length).toBe(1);
    expect(stats.attention.failedItems[0].destinationName).toBe('Alpha VIP Channel');
    expect(stats.attention.failedItems[0].error).toContain('administrator privileges');

    // Recent activity list
    expect(stats.recentActivity.length).toBe(4);
    expect(stats.recentActivity[0].destinationName).toBe('Alpha VIP Channel');
  });

  it('accurately counts destinations, drafts, and upcoming schedules', async () => {
    // 1. Create Destinations (1 verified, 1 unverified, 1 disabled)
    await Destination.create([
      {
        title: 'Channel 1',
        telegramChatId: '-1001',
        type: 'channel',
        status: 'active',
        verification: {
          canPublish: true,
          isBotAdmin: true,
          canPostMessages: true,
          canEditMessages: true,
          canDeleteMessages: true,
          verifiedAt: new Date(),
        },
      },
      {
        title: 'Channel 2',
        telegramChatId: '-1002',
        type: 'channel',
        status: 'active',
        verification: { canPublish: false },
      },
      {
        title: 'Channel 3',
        telegramChatId: '-1003',
        type: 'channel',
        status: 'disabled',
        verification: { canPublish: false },
      },
    ]);

    // 2. Create Draft Messages (1 manual draft, 1 inbound draft)
    await Message.create([
      { messageType: 'text', content: { text: 'Draft 1' }, status: 'draft' },
      {
        messageType: 'text',
        content: { text: 'Draft 2' },
        status: 'draft',
        sourceId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
      },
    ]);

    // 3. Create Scheduled Posts
    const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
    const targetMsg = await Message.create({
      messageType: 'text',
      content: { text: 'Scheduled Telegram Post Content Announcement' },
      status: 'published',
    });

    await ScheduledPost.create({
      messageId: targetMsg._id,
      destinationIds: [
        new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
      ],
      publishMode: 'copy',
      scheduledFor: futureDate,
      timezone: 'Asia/Kolkata',
      status: 'scheduled',
    });

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const stats = res.body.data;

    // Destinations
    expect(stats.kpis.destinations.total).toBe(3);
    expect(stats.kpis.destinations.verified).toBe(1);
    expect(stats.kpis.destinations.disabled).toBe(1);

    // Drafts
    expect(stats.kpis.drafts.total).toBe(2);
    expect(stats.kpis.drafts.inbound).toBe(1);

    // Scheduled
    expect(stats.kpis.scheduled.total).toBe(1);
    expect(stats.kpis.scheduled.nextRunAt).toBeDefined();

    // Upcoming release preview
    expect(stats.upcomingSchedules.length).toBe(1);
    expect(stats.upcomingSchedules[0].destinationCount).toBe(2);
    expect(stats.upcomingSchedules[0].previewText).toContain('Scheduled Telegram Post Content');
  });
});
