import mongoose from 'mongoose';
import type { DashboardStatsDTO } from '@telegram-forwarder/shared';
import { Destination } from '../models/destination.model.js';
import { Message } from '../models/message.model.js';
import { ScheduledPost } from '../models/scheduled-post.model.js';
import { PublishLog } from '../models/publish-log.model.js';
import {
  getRedisConnectionStatus,
  isRedisConnected,
  getWorkerStatus,
  getQueueCounts,
  getPublishQueue,
} from '../queue/index.js';
import { isBotConfigured, getBotInfo } from '../telegram/bot.js';

interface PopulatedDestination {
  displayName?: string;
  title?: string;
}

interface PopulatedMessage {
  content?: {
    text?: string;
    caption?: string;
  };
}

interface PopulatedCategory {
  name?: string;
}

interface ScheduledDocWithDate {
  scheduledFor?: Date;
}

export class DashboardService {
  /**
   * Retrieves aggregated, high-performance dashboard statistics in a single call.
   * Uses lean queries, counts, and projections to eliminate N+1 data transfers.
   */
  public static async getStats(): Promise<DashboardStatsDTO> {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // Parallel execution of all metric queries
    const [
      destTotal,
      destVerified,
      destDisabled,
      draftsTotal,
      draftsInbound,
      scheduledTotal,
      scheduledTodayDue,
      nextScheduledDoc,
      queueCounts,
      isQueuePaused,
      success24h,
      failed24h,
      recentFailures,
      upcomingSchedulesDocs,
      recentActivityDocs,
    ] = await Promise.all([
      // 1. Destinations KPI
      Destination.countDocuments(),
      Destination.countDocuments({ 'verification.canPublish': true }),
      Destination.countDocuments({ status: 'disabled' }),

      // 2. Drafts KPI
      Message.countDocuments({ status: 'draft' }),
      Message.countDocuments({ status: 'draft', sourceId: { $ne: null } }),

      // 3. Scheduled KPI
      ScheduledPost.countDocuments({ status: 'scheduled' }),
      ScheduledPost.countDocuments({
        status: 'scheduled',
        scheduledFor: { $gte: startOfToday, $lte: endOfToday },
      }),
      ScheduledPost.findOne({
        status: 'scheduled',
        scheduledFor: { $gte: now },
      })
        .sort({ scheduledFor: 1 })
        .select('scheduledFor')
        .lean(),

      // 4. BullMQ Queue Counts
      getQueueCounts().catch(() => ({
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 0,
      })),

      // Queue pause status
      (async () => {
        try {
          if (!isRedisConnected()) return false;
          const q = getPublishQueue();
          return await q.isPaused();
        } catch {
          return false;
        }
      })(),

      // 5. 24h Delivery Success & Failures
      PublishLog.countDocuments({
        createdAt: { $gte: since24h },
        status: 'success',
      }),
      PublishLog.countDocuments({
        createdAt: { $gte: since24h },
        status: 'failed',
      }),

      // 6. Attention - Recent Failures with populated destination
      PublishLog.find({
        createdAt: { $gte: since24h },
        status: 'failed',
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate<{ destinationId: { title?: string; displayName?: string } }>(
          'destinationId',
          'title displayName'
        )
        .select('messageId destinationId error createdAt')
        .lean(),

      // 7. Upcoming Schedules (next 5)
      ScheduledPost.find({
        status: 'scheduled',
        scheduledFor: { $gte: new Date(now.getTime() - 60000) },
      })
        .sort({ scheduledFor: 1 })
        .limit(5)
        .populate<{ messageId: { content?: { text?: string; caption?: string } } }>(
          'messageId',
          'content'
        )
        .populate<{ categoryId: { name: string } }>('categoryId', 'name')
        .lean(),

      // 8. Recent Activity (last 6 dispatches)
      PublishLog.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .populate<{ destinationId: { title?: string; displayName?: string } }>(
          'destinationId',
          'title displayName'
        )
        .populate<{ messageId: { content?: { text?: string; caption?: string } } }>(
          'messageId',
          'content'
        )
        .lean(),
    ]);

    // 24h Success Rate Calculation:
    // Defined explicitly as: success / (success + failed) * 100
    // Neutral state if 0 completed delivery attempts
    const completed24h = success24h + failed24h;
    let successRate: number | null = null;
    let displayRate = 'N/A';

    if (completed24h > 0) {
      successRate = Number(((success24h / completed24h) * 100).toFixed(1));
      displayRate = `${successRate}%`;
    }

    // Infrastructure health state derivation
    const redisStatus = getRedisConnectionStatus();
    const workerInfo = getWorkerStatus();
    const isMongoConnected = mongoose.connection.readyState === 1;

    let botStatus: 'connected' | 'polling' | 'error' = 'error';
    let botUsername: string | null = null;

    if (isBotConfigured()) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Bot info timeout')), 2500)
        );
        const botInfo = await Promise.race([getBotInfo(), timeoutPromise]);
        botStatus = 'connected';
        botUsername = botInfo.username || null;
      } catch {
        botStatus = 'error';
      }
    }

    // Infrastructure health state derivation:
    // Standalone mode is operational. Critical only if primary database is unreachable.
    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (!isMongoConnected) {
      overallStatus = 'critical';
    } else if (botStatus === 'error') {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      kpis: {
        destinations: {
          total: destTotal,
          verified: destVerified,
          disabled: destDisabled,
        },
        drafts: {
          total: draftsTotal,
          inbound: draftsInbound,
        },
        scheduled: {
          total: scheduledTotal,
          todayDue: scheduledTodayDue,
          nextRunAt:
            (nextScheduledDoc as unknown as ScheduledDocWithDate)?.scheduledFor?.toISOString() ||
            null,
        },
        queue: {
          waiting: queueCounts.waiting,
          active: queueCounts.active,
          delayed: queueCounts.delayed,
          failed: queueCounts.failed,
          completed: queueCounts.completed,
          isPaused: isQueuePaused,
          workerStatus: workerInfo.status,
        },
        delivery24h: {
          total: completed24h,
          success: success24h,
          failed: failed24h,
          successRate,
          displayRate,
        },
      },
      attention: {
        hasFailures: failed24h > 0,
        failureCount: failed24h,
        failedItems: recentFailures.map((f) => {
          let errorMsg = f.error?.message || 'Publish delivery failed';
          if (errorMsg.includes('CHAT_ADMIN_REQUIRED')) {
            errorMsg = 'Bot requires administrator privileges in target channel';
          } else if (errorMsg.includes('bot was blocked')) {
            errorMsg = 'Bot was blocked by recipient';
          } else if (errorMsg.includes('chat not found')) {
            errorMsg = 'Target chat not found or bot removed';
          }

          const dest = f.destinationId as unknown as PopulatedDestination | null;
          return {
            id: String(f._id),
            messageId: String(f.messageId),
            destinationName: dest?.displayName || dest?.title || 'Unknown Destination',
            error: errorMsg,
            createdAt: f.createdAt.toISOString(),
          };
        }),
      },
      upcomingSchedules: upcomingSchedulesDocs.map((s) => {
        const msg = s.messageId as unknown as PopulatedMessage | null;
        const text = msg?.content?.text || msg?.content?.caption || 'Scheduled Telegram Post';
        const preview = text.length > 55 ? `${text.slice(0, 52)}...` : text;
        const cat = s.categoryId as unknown as PopulatedCategory | null;

        return {
          id: String(s._id),
          scheduledFor: s.scheduledFor.toISOString(),
          timezone: s.timezone || 'Asia/Kolkata',
          destinationCount: s.destinationIds?.length || 0,
          previewText: preview,
          categoryName: cat?.name,
          status: s.status,
        };
      }),
      recentActivity: recentActivityDocs.map((l) => {
        const msg = l.messageId as unknown as PopulatedMessage | null;
        const text = msg?.content?.text || msg?.content?.caption || '';
        const preview = text.length > 40 ? `${text.slice(0, 38)}...` : text;
        const dest = l.destinationId as unknown as PopulatedDestination | null;

        return {
          id: String(l._id),
          publishMode: l.publishMode as 'copy' | 'forward',
          status: l.status as 'success' | 'failed',
          destinationName: dest?.displayName || dest?.title || 'Channel Destination',
          executionTimeMs: l.executionTimeMs || 0,
          previewText: preview || undefined,
          createdAt: l.createdAt.toISOString(),
        };
      }),
      infrastructure: {
        mongo: {
          status: isMongoConnected ? 'connected' : 'disconnected',
        },
        redis: {
          status: redisStatus,
        },
        worker: {
          status: workerInfo.status,
          concurrency: workerInfo.concurrency,
        },
        telegramBot: {
          status: botStatus,
          username: botUsername,
        },
        overallStatus,
      },
    };
  }
}
