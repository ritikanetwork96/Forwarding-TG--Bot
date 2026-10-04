import mongoose, { Types } from 'mongoose';
import { ScheduledPost, type IScheduledPost } from '../models/scheduled-post.model.js';
import { Message, type IMessage } from '../models/message.model.js';
import { Destination } from '../models/destination.model.js';
import { DestinationGroupService } from './destination-group.service.js';
import { PublishService } from './publish.service.js';
import {
  enqueueScheduleJob,
  removeScheduleJob,
  getScheduleJobId,
} from '../queue/schedule.queue.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type {
  ScheduledPostDTO,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  ScheduleStatsDTO,
  ScheduledPostStatus,
  MessageDTO,
} from '@telegram-forwarder/shared';

export function formatScheduledPostDTO(
  doc: IScheduledPost,
  populatedMessage?: IMessage | null
): ScheduledPostDTO {
  let messageDTO: MessageDTO | undefined;
  if (populatedMessage) {
    messageDTO = {
      _id: populatedMessage._id.toString(),
      sourceId: populatedMessage.sourceId?.toString() || null,
      categoryId: populatedMessage.categoryId?.toString() || null,
      telegramChatId: populatedMessage.telegramChatId || null,
      telegramMessageId: populatedMessage.telegramMessageId || null,
      mediaGroupId: populatedMessage.mediaGroupId || null,
      messageType: populatedMessage.messageType,
      content: populatedMessage.content,
      status: populatedMessage.status,
      deliverySummary: {
        targetCount: populatedMessage.deliverySummary?.targetCount || 0,
        successfulDestinationIds: (
          populatedMessage.deliverySummary?.successfulDestinationIds || []
        ).map((id) => id.toString()),
        failedDestinationIds: (populatedMessage.deliverySummary?.failedDestinationIds || []).map(
          (id) => id.toString()
        ),
        lastAttemptedAt: populatedMessage.deliverySummary?.lastAttemptedAt || null,
      },
      isEditedAtSource: populatedMessage.isEditedAtSource || false,
      sourceEditedAt: populatedMessage.sourceEditedAt?.toISOString() || null,
      createdAt: populatedMessage.createdAt.toISOString(),
      updatedAt: populatedMessage.updatedAt.toISOString(),
    };
  }

  return {
    _id: doc._id.toString(),
    messageId: doc.messageId.toString(),
    createdBy: doc.createdBy ? doc.createdBy.toString() : '',
    destinationIds: doc.destinationIds.map((id) => id.toString()),
    categoryId: doc.categoryId ? doc.categoryId.toString() : null,
    publishMode: doc.publishMode,
    scheduledFor: doc.scheduledFor.toISOString(),
    timezone: doc.timezone,
    status: doc.status,
    queueJobId: doc.queueJobId || null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    cancelledAt: doc.cancelledAt ? doc.cancelledAt.toISOString() : null,
    failedAt: doc.failedAt ? doc.failedAt.toISOString() : null,
    failureReason: doc.failureReason || null,
    retryCount: doc.retryCount || 0,
    message: messageDTO,
  };
}

export class ScheduleService {
  /**
   * Creates a new scheduled post in MongoDB and enqueues delayed job in BullMQ
   */
  public static async createSchedule(
    data: CreateScheduleRequest,
    userId: string
  ): Promise<ScheduledPostDTO> {
    const {
      messageId,
      categoryId,
      publishMode = 'copy',
      scheduledFor: scheduledForStr,
      timezone = 'Asia/Kolkata',
    } = data;

    if (!messageId || !Types.ObjectId.isValid(messageId)) {
      throw new BadRequestError('Invalid or missing messageId');
    }

    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError(`Post not found: ${messageId}`);
    }

    if (message.status === 'published') {
      throw new BadRequestError('Cannot schedule an already published post');
    }

    const resolvedObjectIds = await DestinationGroupService.resolveTargets({
      destinationIds: data.destinationIds,
      destinationGroupIds: data.destinationGroupIds,
    });

    if (resolvedObjectIds.length === 0) {
      throw new BadRequestError('At least one destination or destination group must be selected');
    }

    const scheduledDate = new Date(scheduledForStr);
    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestError('Invalid scheduledFor date format');
    }

    if (scheduledDate.getTime() <= Date.now()) {
      throw new BadRequestError('Scheduled time must be in the future');
    }

    // Verify destination existence and active status
    const validDests = await Destination.find({
      _id: { $in: resolvedObjectIds },
      status: 'active',
      'verification.canPublish': true,
    });

    if (validDests.length === 0) {
      throw new BadRequestError('None of the selected destinations are verified for publishing');
    }

    const validDestIds = validDests.map((d) => d._id);

    // Save schedule in MongoDB
    const scheduledPost = await ScheduledPost.create({
      messageId: message._id,
      createdBy: new Types.ObjectId(userId),
      destinationIds: validDestIds,
      categoryId: categoryId ? new Types.ObjectId(categoryId) : message.categoryId || null,
      publishMode,
      scheduledFor: scheduledDate,
      timezone,
      status: 'scheduled',
      queueJobId: null,
    });

    const queueJobId = getScheduleJobId(scheduledPost._id.toString());
    scheduledPost.queueJobId = queueJobId;
    await scheduledPost.save();

    // Enqueue delayed job in BullMQ
    try {
      await enqueueScheduleJob({
        scheduledPostId: scheduledPost._id.toString(),
        messageId: message._id.toString(),
        scheduledFor: scheduledDate,
      });
    } catch (err) {
      logger.warn(
        `Delayed job enqueue error for schedule [${scheduledPost._id}]: Redis may be offline. Will reconcile on reconnect.`
      );
    }

    logger.info(
      `Created ScheduledPost [${scheduledPost._id}] for message ${messageId} due at ${scheduledDate.toISOString()} (${timezone})`
    );

    return formatScheduledPostDTO(scheduledPost, message);
  }

  /**
   * Retrieves single schedule details by ID
   */
  public static async getSchedule(id: string): Promise<ScheduledPostDTO> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid schedule ID');
    }

    const schedule = await ScheduledPost.findById(id);
    if (!schedule) {
      throw new NotFoundError(`Scheduled post not found: ${id}`);
    }

    const message = await Message.findById(schedule.messageId);
    return formatScheduledPostDTO(schedule, message);
  }

  /**
   * Lists scheduled posts with optional filters and pagination
   */
  public static async listSchedules(query: {
    status?: ScheduledPostStatus;
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: ScheduledPostDTO[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter.status = query.status;
    }
    if (query.categoryId && Types.ObjectId.isValid(query.categoryId)) {
      filter.categoryId = new Types.ObjectId(query.categoryId);
    }

    const [items, total] = await Promise.all([
      ScheduledPost.find(filter).sort({ scheduledFor: 1 }).skip(skip).limit(limit),
      ScheduledPost.countDocuments(filter),
    ]);

    // Populate messages
    const messageIds = items.map((i) => i.messageId);
    const messages = await Message.find({ _id: { $in: messageIds } });
    const messageMap = new Map<string, IMessage>();
    for (const m of messages) {
      messageMap.set(m._id.toString(), m);
    }

    const dtos = items.map((doc) =>
      formatScheduledPostDTO(doc, messageMap.get(doc.messageId.toString()) || null)
    );

    return {
      items: dtos,
      total,
      page,
      limit,
    };
  }

  /**
   * Updates an existing scheduled post (date, time, destinations, etc.)
   */
  public static async updateSchedule(
    id: string,
    data: UpdateScheduleRequest,
    _userId: string
  ): Promise<ScheduledPostDTO> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid schedule ID');
    }

    const schedule = await ScheduledPost.findById(id);
    if (!schedule) {
      throw new NotFoundError(`Scheduled post not found: ${id}`);
    }

    if (schedule.status !== 'scheduled') {
      throw new BadRequestError(
        `Cannot edit schedule with status '${schedule.status}'. Only pending 'scheduled' posts can be edited.`
      );
    }

    if (data.scheduledFor) {
      const newDate = new Date(data.scheduledFor);
      if (isNaN(newDate.getTime())) {
        throw new BadRequestError('Invalid scheduledFor date format');
      }
      if (newDate.getTime() <= Date.now()) {
        throw new BadRequestError('New scheduled time must be in the future');
      }
      schedule.scheduledFor = newDate;
    }

    if (data.timezone) {
      schedule.timezone = data.timezone;
    }

    if (data.publishMode) {
      schedule.publishMode = data.publishMode;
    }

    if (data.categoryId !== undefined) {
      schedule.categoryId = data.categoryId ? new Types.ObjectId(data.categoryId) : null;
    }

    if (
      (data.destinationIds && data.destinationIds.length > 0) ||
      (data.destinationGroupIds && data.destinationGroupIds.length > 0)
    ) {
      const resolvedObjectIds = await DestinationGroupService.resolveTargets({
        destinationIds: data.destinationIds,
        destinationGroupIds: data.destinationGroupIds,
      });

      const validDests = await Destination.find({
        _id: { $in: resolvedObjectIds },
        status: 'active',
        'verification.canPublish': true,
      });
      if (validDests.length === 0) {
        throw new BadRequestError('None of the selected destinations are verified for publishing');
      }
      schedule.destinationIds = validDests.map((d) => d._id);
    }

    await schedule.save();

    // Re-enqueue delayed job in BullMQ to replace old trigger
    try {
      await enqueueScheduleJob({
        scheduledPostId: schedule._id.toString(),
        messageId: schedule.messageId.toString(),
        scheduledFor: schedule.scheduledFor,
      });
    } catch (err) {
      logger.warn(`Could not update BullMQ delayed job for schedule [${schedule._id}]:`, err);
    }

    const message = await Message.findById(schedule.messageId);
    return formatScheduledPostDTO(schedule, message);
  }

  /**
   * Cancels a pending scheduled post
   */
  public static async cancelSchedule(id: string, _userId?: string): Promise<ScheduledPostDTO> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid schedule ID');
    }

    // Atomic state transition: scheduled -> cancelled
    const schedule = await ScheduledPost.findOneAndUpdate(
      { _id: new Types.ObjectId(id), status: 'scheduled' },
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!schedule) {
      const existing = await ScheduledPost.findById(id);
      if (!existing) {
        throw new NotFoundError(`Scheduled post not found: ${id}`);
      }
      throw new BadRequestError(
        `Cannot cancel schedule with status '${existing.status}'. Only 'scheduled' posts can be cancelled.`
      );
    }

    // Invalidate BullMQ delayed job
    await removeScheduleJob(id);

    logger.info(`Cancelled ScheduledPost [${id}]`);

    const message = await Message.findById(schedule.messageId);
    return formatScheduledPostDTO(schedule, message);
  }

  /**
   * Publishes a scheduled post immediately ("Publish Now")
   */
  public static async publishNow(id: string, userId: string): Promise<ScheduledPostDTO> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid schedule ID');
    }

    // Concurrency Lock: Atomically claim 'processing' state from 'scheduled'
    const schedule = await ScheduledPost.findOneAndUpdate(
      { _id: new Types.ObjectId(id), status: 'scheduled' },
      {
        status: 'processing',
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!schedule) {
      const existing = await ScheduledPost.findById(id);
      if (!existing) {
        throw new NotFoundError(`Scheduled post not found: ${id}`);
      }
      throw new BadRequestError(
        `Cannot Publish Now: Schedule status is '${existing.status}'. Only 'scheduled' posts can be published immediately.`
      );
    }

    // Remove BullMQ delayed trigger so it doesn't fire again
    await removeScheduleJob(id);

    // Execute publication using existing canonical PublishService
    await this.executeScheduledPost(id, schedule, userId);

    const updated = await ScheduledPost.findById(id);
    const message = await Message.findById(schedule.messageId);
    return formatScheduledPostDTO(updated || schedule, message);
  }

  /**
   * Canonical execution logic when a schedule becomes due or is published immediately
   */
  public static async executeScheduledPost(
    scheduledPostId: string,
    preLockedSchedule?: IScheduledPost,
    _triggeredByUserId?: string
  ): Promise<{
    success: boolean;
    aggregateStatus?: string;
    error?: string;
    skipped?: boolean;
    skipReason?: string;
  }> {
    let schedule = preLockedSchedule;

    // If not already atomically locked by caller, acquire lock here
    if (!schedule) {
      const locked = await ScheduledPost.findOneAndUpdate(
        { _id: new Types.ObjectId(scheduledPostId), status: 'scheduled' },
        {
          status: 'processing',
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!locked) {
        logger.info(
          `Schedule [${scheduledPostId}] is not in 'scheduled' state. Skipping execution to prevent duplicate dispatch.`
        );
        return {
          success: false,
          skipped: true,
          skipReason: 'Schedule already claimed, cancelled, or finished',
        };
      }
      schedule = locked;
    }

    logger.info(
      `Executing scheduled post [${scheduledPostId}] for message ${schedule.messageId} to ${schedule.destinationIds.length} destinations`
    );

    try {
      const destinationIds = schedule.destinationIds.map((id) => id.toString());
      const messageId = schedule.messageId.toString();

      // Dispatch through canonical PublishService pipeline
      const publishResult = await PublishService.publishAutomated({
        messageId,
        destinationIds,
        publishMode: schedule.publishMode,
      });

      // Update schedule status based on outcome
      const freshMessage = await Message.findById(messageId);
      const aggStatus = freshMessage?.status || publishResult.aggregateStatus;

      let finalScheduleStatus: ScheduledPostStatus = 'published';
      if (aggStatus === 'failed') {
        finalScheduleStatus = 'failed';
        schedule.failedAt = new Date();
        schedule.failureReason = 'All destinations failed during scheduled dispatch';
      } else if (aggStatus === 'partially_published') {
        finalScheduleStatus = 'partially_published';
      } else {
        finalScheduleStatus = 'published';
        schedule.publishedAt = new Date();
      }

      schedule.status = finalScheduleStatus;
      schedule.updatedAt = new Date();
      await schedule.save();

      logger.info(
        `Scheduled post [${scheduledPostId}] finished with final status: ${finalScheduleStatus}`
      );

      return {
        success:
          finalScheduleStatus === 'published' || finalScheduleStatus === 'partially_published',
        aggregateStatus: finalScheduleStatus,
      };
    } catch (err) {
      logger.error(`Error executing scheduled post [${scheduledPostId}]:`, err);
      schedule.status = 'failed';
      schedule.failedAt = new Date();
      schedule.failureReason = err instanceof Error ? err.message : 'Unknown execution failure';
      schedule.updatedAt = new Date();
      await schedule.save();

      return {
        success: false,
        error: schedule.failureReason,
      };
    }
  }

  /**
   * Retrieves aggregate schedule statistics
   */
  public static async getStats(): Promise<ScheduleStatsDTO> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [total, scheduled, processing, published, failed, cancelled, dueToday] =
      await Promise.all([
        ScheduledPost.countDocuments(),
        ScheduledPost.countDocuments({ status: 'scheduled' }),
        ScheduledPost.countDocuments({ status: 'processing' }),
        ScheduledPost.countDocuments({ status: { $in: ['published', 'partially_published'] } }),
        ScheduledPost.countDocuments({ status: 'failed' }),
        ScheduledPost.countDocuments({ status: 'cancelled' }),
        ScheduledPost.countDocuments({
          status: 'scheduled',
          scheduledFor: { $gte: startOfToday, $lte: endOfToday },
        }),
      ]);

    return {
      total,
      scheduled,
      processing,
      published,
      failed,
      cancelled,
      dueToday,
      todayDue: dueToday,
    };
  }

  /**
   * Startup / Server Crash Recovery & Reconciliation (Requirement 5 & 13)
   * Scans pending ScheduledPost records in MongoDB and reconciles with BullMQ
   */
  public static async reconcileSchedulesOnStartup(): Promise<{
    overdueRecovered: number;
    futureReconciled: number;
  }> {
    if (mongoose.connection.readyState !== 1) {
      logger.warn(
        '[Scheduler] Skipping startup schedule reconciliation: MongoDB connection is not active.'
      );
      return { overdueRecovered: 0, futureReconciled: 0 };
    }

    logger.info('[Scheduler] Starting startup schedule reconciliation...');

    let overdueRecovered = 0;
    let futureReconciled = 0;

    try {
      const pendingSchedules = await ScheduledPost.find({
        status: { $in: ['scheduled', 'processing'] },
      }).sort({ scheduledFor: 1 });

      const now = Date.now();

      for (const schedule of pendingSchedules) {
        const scheduledTime = schedule.scheduledFor.getTime();

        if (scheduledTime <= now) {
          // Overdue schedule: process safely
          logger.warn(
            `[Scheduler] Overdue schedule detected: [${schedule._id}] (scheduled for ${schedule.scheduledFor.toISOString()}). Recovering...`
          );
          await this.executeScheduledPost(schedule._id.toString());
          overdueRecovered++;
        } else {
          // Future schedule: ensure delayed job is present in BullMQ
          try {
            await enqueueScheduleJob({
              scheduledPostId: schedule._id.toString(),
              messageId: schedule.messageId.toString(),
              scheduledFor: schedule.scheduledFor,
            });
            futureReconciled++;
          } catch (err) {
            logger.warn(
              `[Scheduler] Could not enqueue BullMQ job for schedule [${schedule._id}] during reconciliation:`,
              err
            );
          }
        }
      }

      logger.info(
        `[Scheduler] Reconciliation complete: ${overdueRecovered} overdue processed, ${futureReconciled} future reconciled.`
      );
    } catch (err) {
      logger.error('[Scheduler] Failed startup reconciliation:', err);
    }

    return { overdueRecovered, futureReconciled };
  }
}
