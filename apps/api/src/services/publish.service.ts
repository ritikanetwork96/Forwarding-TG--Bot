import { Message, type IMessage } from '../models/message.model.js';
import { Destination } from '../models/destination.model.js';
import { PublishLog } from '../models/publish-log.model.js';
import { TelegramService } from '../telegram/telegram.service.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import {
  ErrorCodes,
  type PublishMode,
  type PublishResultData,
  type RetryPublishResultData,
  type PublishLogDTO,
  type MessageStatus,
  type PublishLogError,
} from '@telegram-forwarder/shared';
import { formatLogDTO } from './log.service.js';
import { DestinationGroupService } from './destination-group.service.js';
import { Types } from 'mongoose';
import { logger } from '../utils/logger.js';
import { enqueuePublishJobs } from '../queue/publish.queue.js';
import { isRedisConnected } from '../queue/connection.js';
import type { PublishJobData, PublishJobResult } from '../queue/publish.types.js';

export interface SingleDestinationPublishParams {
  messageId: string;
  destinationId: string;
  publishMode: PublishMode;
  ruleId?: string;
  triggeredBy?: string;
  userId?: string;
  force?: boolean;
}

export class PublishService {
  /**
   * Dispatches publication to a single destination.
   * This is the SINGLE canonical publishing engine used by both direct execution and the BullMQ worker.
   */
  public static async publishSingleDestination(
    params: SingleDestinationPublishParams
  ): Promise<PublishJobResult> {
    const {
      messageId,
      destinationId,
      publishMode,
      ruleId,
      triggeredBy: _triggeredBy,
      userId,
      force = false,
    } = params;
    const startTime = Date.now();

    // 1. Fetch Message
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError(`Post not found: ${messageId}`);
    }

    // 2. Idempotency Check in MongoDB (Requirement 13) - bypassed when force/resend is explicitly requested
    const successfulIds = new Set(
      (message.deliverySummary.successfulDestinationIds || []).map((id) => id.toString())
    );
    if (!force && successfulIds.has(destinationId)) {
      logger.info(
        `Destination ${destinationId} already succeeded for post ${messageId}. Skipping duplicate execution.`
      );
      return {
        success: true,
        destinationId,
        skipped: true,
        skipReason: 'Already published successfully to this destination',
        executionTimeMs: 0,
      };
    }

    // 3. Fetch Destination and Re-check Verification State (Requirement 24)
    const destination = await Destination.findById(destinationId);
    if (!destination) {
      throw new NotFoundError(`Destination not found: ${destinationId}`);
    }

    if (destination.status !== 'active' || !destination.verification?.canPublish) {
      const executionTimeMs = Date.now() - startTime;
      const errorPayload: PublishLogError = {
        code: ErrorCodes.DESTINATION_NOT_VERIFIED,
        message: `Destination '${destination.title}' (${destination.telegramChatId}) is not active or verified to publish`,
      };

      // Record immutable failed PublishLog
      await PublishLog.create({
        messageId: message._id,
        sourceId: message.sourceId || null,
        categoryId: message.categoryId || null,
        destinationId: destination._id,
        ruleId: ruleId ? new Types.ObjectId(ruleId) : null,
        triggeredBy: userId ? new Types.ObjectId(userId) : null,
        publishMode,
        status: 'failed',
        targetTelegramMessageId: null,
        targetTelegramMessageIds: [],
        error: errorPayload,
        executionTimeMs,
        createdAt: new Date(),
      });

      // Update message delivery state
      await this.updateDeliverySummaryAndAggregateStatus({
        messageId,
        destinationId,
        success: false,
      });

      return {
        success: false,
        destinationId,
        error: errorPayload,
        executionTimeMs,
      };
    }

    // 4. Dispatch Telegram API Call via TelegramService
    try {
      const rawContent = message.content as unknown as {
        text?: string;
        mediaItems?: typeof message.content.mediaItems;
        buttons?: Array<Array<{ text: string; url: string }>>;
      };
      const rawMsg = message as unknown as {
        silentPublish?: boolean;
        pinOnPublish?: boolean;
        disableWebPreview?: boolean;
      };

      const result = await TelegramService.publishMessage({
        toChatId: destination.telegramChatId,
        fromChatId: message.telegramChatId || undefined,
        telegramMessageId: message.telegramMessageId || undefined,
        publishMode,
        text: rawContent.text,
        mediaItems: rawContent.mediaItems,
        buttons: rawContent.buttons,
        silent: rawMsg.silentPublish,
        pin: rawMsg.pinOnPublish,
        disableWebPreview: rawMsg.disableWebPreview,
      });

      const executionTimeMs = Date.now() - startTime;

      // 5. Create Immutable PublishLog
      await PublishLog.create({
        messageId: message._id,
        sourceId: message.sourceId || null,
        categoryId: message.categoryId || null,
        destinationId: destination._id,
        ruleId: ruleId ? new Types.ObjectId(ruleId) : null,
        triggeredBy: userId ? new Types.ObjectId(userId) : null,
        publishMode,
        status: result.success ? 'success' : 'failed',
        targetTelegramMessageId: result.targetTelegramMessageId || null,
        targetTelegramMessageIds: result.targetTelegramMessageIds || [],
        error: result.error || null,
        executionTimeMs,
        createdAt: new Date(),
      });

      // 6. Concurrency-safe aggregate update in MongoDB
      await this.updateDeliverySummaryAndAggregateStatus({
        messageId,
        destinationId,
        success: result.success,
      });

      return {
        success: result.success,
        destinationId,
        targetTelegramMessageId: result.targetTelegramMessageId || null,
        targetTelegramMessageIds: result.targetTelegramMessageIds || [],
        error: result.error || null,
        executionTimeMs,
      };
    } catch (err) {
      const executionTimeMs = Date.now() - startTime;
      logger.error(
        `Unexpected error publishing post ${messageId} to destination ${destinationId}:`,
        err
      );

      const errorPayload: PublishLogError = {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: err instanceof Error ? err.message : 'Unknown publish failure',
      };

      await PublishLog.create({
        messageId: message._id,
        sourceId: message.sourceId || null,
        categoryId: message.categoryId || null,
        destinationId: destination._id,
        ruleId: ruleId ? new Types.ObjectId(ruleId) : null,
        triggeredBy: userId ? new Types.ObjectId(userId) : null,
        publishMode,
        status: 'failed',
        targetTelegramMessageId: null,
        targetTelegramMessageIds: [],
        error: errorPayload,
        executionTimeMs,
        createdAt: new Date(),
      });

      await this.updateDeliverySummaryAndAggregateStatus({
        messageId,
        destinationId,
        success: false,
      });

      return {
        success: false,
        destinationId,
        error: errorPayload,
        executionTimeMs,
      };
    }
  }

  /**
   * Concurrency-safe helper to update message delivery summary and recalculate aggregate status
   */
  public static async updateDeliverySummaryAndAggregateStatus(params: {
    messageId: string;
    destinationId: string;
    success: boolean;
  }): Promise<IMessage> {
    const { messageId, destinationId, success } = params;

    // Reload latest message from MongoDB to ensure atomic status calculations under concurrency
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError(`Post not found for aggregate update: ${messageId}`);
    }

    const successfulSet = new Set(
      (message.deliverySummary.successfulDestinationIds || []).map((id) => id.toString())
    );
    const failedSet = new Set(
      (message.deliverySummary.failedDestinationIds || []).map((id) => id.toString())
    );

    if (success) {
      successfulSet.add(destinationId);
      failedSet.delete(destinationId);
    } else {
      if (!successfulSet.has(destinationId)) {
        failedSet.add(destinationId);
      }
    }

    message.deliverySummary.successfulDestinationIds = Array.from(successfulSet);
    message.deliverySummary.failedDestinationIds = Array.from(failedSet);
    message.deliverySummary.lastAttemptedAt = new Date().toISOString();

    const targetCount = message.deliverySummary.targetCount || successfulSet.size + failedSet.size;
    message.deliverySummary.targetCount = targetCount;

    // Aggregate State Machine Calculation (Requirement 17)
    // 0 successes + failures > 0 → failed
    // successes > 0 + failures > 0 → partially_published
    // successes > 0 + failures = 0 → published
    // For jobs still processing: → publishing
    let aggregateStatus: MessageStatus;
    const totalFinished = successfulSet.size + failedSet.size;

    if (targetCount > 0 && totalFinished < targetCount) {
      aggregateStatus = 'publishing';
    } else if (failedSet.size === 0 && successfulSet.size > 0) {
      aggregateStatus = 'published';
    } else if (successfulSet.size > 0 && failedSet.size > 0) {
      aggregateStatus = 'partially_published';
    } else {
      aggregateStatus = 'failed';
    }

    message.status = aggregateStatus;
    await message.save();
    return message;
  }

  /**
   * Manual multi-destination publish of a post (Direct synchronous execution)
   */
  public static async publishManual(data: {
    messageId: string;
    destinationIds?: string[];
    destinationGroupIds?: string[];
    categoryIds?: string[];
    publishMode?: PublishMode;
    userId?: string;
  }): Promise<PublishResultData> {
    const resolvedObjectIds = await DestinationGroupService.resolveTargets({
      destinationIds: data.destinationIds,
      destinationGroupIds: data.destinationGroupIds,
      categoryIds: data.categoryIds,
    });

    if (resolvedObjectIds.length === 0) {
      throw new BadRequestError(
        'At least one valid destination, group, or category must be selected',
        ErrorCodes.NO_TARGETS_SELECTED
      );
    }

    return this.executePublish({
      messageId: data.messageId,
      destinationIds: resolvedObjectIds.map((id) => id.toString()),
      publishMode: data.publishMode || 'copy',
      userId: data.userId,
      ruleId: undefined,
      force: true, // Manual dispatch is an explicit send request
    });
  }

  /**
   * Automated multi-destination publish triggered by forwarding rules.
   * Enqueues ONE BullMQ job per destination into Redis (Requirements 1, 3, 5, 7).
   */
  public static async publishAutomated(data: {
    messageId: string;
    destinationIds?: string[];
    destinationGroupIds?: string[];
    categoryIds?: string[];
    publishMode?: PublishMode;
    ruleId?: string;
  }): Promise<PublishResultData> {
    const {
      messageId,
      destinationIds,
      destinationGroupIds,
      categoryIds,
      publishMode = 'copy',
      ruleId,
    } = data;

    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Post not found');
    }

    const resolvedObjectIds = await DestinationGroupService.resolveTargets({
      destinationIds,
      destinationGroupIds,
      categoryIds,
    });

    const targetDestinationIds = resolvedObjectIds.map((id) => id.toString());

    if (targetDestinationIds.length === 0) {
      throw new BadRequestError('At least one destinationId is required for automatic publish');
    }

    // Set message to publishing state immediately and set expected target count
    message.status = 'publishing';
    message.deliverySummary.targetCount = targetDestinationIds.length;
    message.deliverySummary.lastAttemptedAt = new Date().toISOString();
    await message.save();

    // Prepare BullMQ jobs: ONE JOB = ONE DESTINATION
    const jobList: PublishJobData[] = targetDestinationIds.map((destId) => ({
      messageId,
      destinationId: destId,
      ruleId,
      publishMode,
      triggeredBy: 'automatic',
    }));

    // If Redis is connected, enqueue to BullMQ queue
    if (isRedisConnected()) {
      try {
        await enqueuePublishJobs(jobList);
        logger.info(
          `Enqueued ${jobList.length} BullMQ jobs in [publish-queue] for automatic publish of message ${messageId}`
        );

        return {
          aggregateStatus: 'publishing',
          targetCount: targetDestinationIds.length,
          successfulCount: 0,
          failedCount: 0,
          logs: [],
        };
      } catch (err) {
        logger.error(`Failed to enqueue BullMQ jobs for message ${messageId}:`, err);
      }
    }

    // Fallback if Redis is not currently connected:
    // Execute via canonical single destination pipeline to guarantee reliable delivery
    logger.warn(
      `Redis is not connected; executing automatic publish directly for message ${messageId}`
    );
    return this.executePublish({
      messageId,
      destinationIds: targetDestinationIds,
      publishMode,
      ruleId,
    });
  }

  /**
   * Shared publish execution pipeline for direct publishing
   */
  private static async executePublish(params: {
    messageId: string;
    destinationIds: string[];
    publishMode: PublishMode;
    userId?: string;
    ruleId?: string;
    force?: boolean;
  }): Promise<PublishResultData> {
    const { messageId, destinationIds, publishMode, userId, ruleId, force = false } = params;

    // 1. Fetch message
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Post not found');
    }

    if (destinationIds.length === 0) {
      throw new BadRequestError('At least one destinationId is required');
    }

    // 2. Fetch and validate destinations
    const destinations = await Destination.find({ _id: { $in: destinationIds } });
    if (destinations.length !== destinationIds.length) {
      throw new NotFoundError('One or more destinations were not found');
    }

    // Verify publish readiness
    for (const dest of destinations) {
      if (!dest.verification || !dest.verification.canPublish) {
        throw new BadRequestError(
          `Destination '${dest.title}' (${dest.telegramChatId}) is not verified for publishing`,
          ErrorCodes.DESTINATION_NOT_VERIFIED
        );
      }
    }

    // 3. Mark message status as 'publishing'
    message.status = 'publishing';
    message.deliverySummary.targetCount = destinationIds.length;
    await message.save();

    // 4. Execute per-destination publish using the single canonical method
    const results: PublishJobResult[] = [];
    for (const destId of destinationIds) {
      const res = await this.publishSingleDestination({
        messageId,
        destinationId: destId,
        publishMode,
        userId,
        ruleId,
        triggeredBy: userId ? 'user' : 'automatic',
        force,
      });
      results.push(res);
    }

    // Fetch the newly created logs for this execution
    const logs = await PublishLog.find({ messageId: message._id })
      .sort({ createdAt: -1 })
      .limit(destinationIds.length);
    const updatedMessage = await Message.findById(messageId);

    const successfulCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return {
      aggregateStatus: updatedMessage?.status || 'failed',
      targetCount: destinationIds.length,
      successfulCount,
      failedCount,
      logs: logs.map((l) => formatLogDTO(l)),
    };
  }

  /**
   * Bulk Retry: Retry all currently failed destinations for a message
   */
  public static async retryFailed(
    messageId: string,
    userId?: string
  ): Promise<RetryPublishResultData> {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Post not found');
    }

    const failedIds = (message.deliverySummary.failedDestinationIds || []).map((id) =>
      id.toString()
    );

    if (failedIds.length === 0) {
      throw new BadRequestError(
        'No failed destinations to retry for this post',
        ErrorCodes.NO_FAILED_DESTINATIONS
      );
    }

    const destinations = await Destination.find({ _id: { $in: failedIds } });
    if (destinations.length === 0) {
      throw new NotFoundError('Failed destinations were not found');
    }

    // Mark status as publishing
    message.status = 'publishing';
    await message.save();

    // If message was created via automatic rule and Redis is connected, enqueue retry jobs
    const historicalRuleLog = await PublishLog.findOne({
      messageId: message._id,
      ruleId: { $ne: null },
    });
    if (historicalRuleLog?.ruleId && isRedisConnected()) {
      const retryJobs: PublishJobData[] = failedIds.map((destId) => ({
        messageId,
        destinationId: destId,
        ruleId: historicalRuleLog.ruleId ? historicalRuleLog.ruleId.toString() : undefined,
        publishMode: 'copy',
        triggeredBy: 'retry',
        userId,
      }));

      await enqueuePublishJobs(retryJobs);

      return {
        aggregateStatus: 'publishing',
        newlySuccessfulCount: 0,
        stillFailedCount: failedIds.length,
        logs: [],
      };
    }

    // Otherwise, direct execution
    const results: PublishJobResult[] = [];
    for (const dest of destinations) {
      const res = await this.publishSingleDestination({
        messageId,
        destinationId: dest._id.toString(),
        publishMode: 'copy',
        userId,
        triggeredBy: 'retry',
      });
      results.push(res);
    }

    const finalMessage = await Message.findById(messageId);
    const recentLogs = await PublishLog.find({ messageId: message._id })
      .sort({ createdAt: -1 })
      .limit(failedIds.length);

    const newlySuccessfulCount = results.filter((r) => r.success).length;
    const stillFailedCount = results.filter((r) => !r.success).length;

    return {
      aggregateStatus: finalMessage?.status || 'failed',
      newlySuccessfulCount,
      stillFailedCount,
      logs: recentLogs.map((l) => formatLogDTO(l)),
    };
  }

  /**
   * Targeted Retry: Retry one specific failed destination/log attempt
   */
  public static async retryLog(
    logId: string,
    userId?: string
  ): Promise<{ log: PublishLogDTO; aggregateStatus: MessageStatus }> {
    const historicalLog = await PublishLog.findById(logId);
    if (!historicalLog) {
      throw new NotFoundError('Publish log not found');
    }

    if (historicalLog.status === 'success') {
      throw new BadRequestError(
        'This destination attempt already succeeded',
        ErrorCodes.ALREADY_SUCCESSFUL
      );
    }

    const message = await Message.findById(historicalLog.messageId);
    if (!message) {
      throw new NotFoundError('Associated post not found');
    }

    const destination = await Destination.findById(historicalLog.destinationId);
    if (!destination) {
      throw new NotFoundError('Associated destination not found');
    }

    await this.publishSingleDestination({
      messageId: message._id.toString(),
      destinationId: destination._id.toString(),
      publishMode: historicalLog.publishMode,
      ruleId: historicalLog.ruleId ? historicalLog.ruleId.toString() : undefined,
      triggeredBy: 'retry',
      userId,
    });

    const newLog = await PublishLog.findOne({
      messageId: message._id,
      destinationId: destination._id,
    }).sort({ createdAt: -1 });

    const finalMessage = await Message.findById(message._id);

    return {
      log: newLog ? formatLogDTO(newLog) : ({} as PublishLogDTO),
      aggregateStatus: finalMessage?.status || 'failed',
    };
  }

  /**
   * Re-send a specific historical log dispatch to its destination (works for both previously successful and failed logs)
   */
  public static async resendLog(
    logId: string,
    userId?: string
  ): Promise<{ log: PublishLogDTO; aggregateStatus: MessageStatus }> {
    const historicalLog = await PublishLog.findById(logId);
    if (!historicalLog) {
      throw new NotFoundError('Publish log not found');
    }

    const message = await Message.findById(historicalLog.messageId);
    if (!message) {
      throw new NotFoundError('Associated post not found');
    }

    const destination = await Destination.findById(historicalLog.destinationId);
    if (!destination) {
      throw new NotFoundError('Associated destination not found');
    }

    await this.publishSingleDestination({
      messageId: message._id.toString(),
      destinationId: destination._id.toString(),
      publishMode: historicalLog.publishMode || 'copy',
      ruleId: historicalLog.ruleId ? historicalLog.ruleId.toString() : undefined,
      triggeredBy: 'resend',
      userId,
      force: true,
    });

    const newLog = await PublishLog.findOne({
      messageId: message._id,
      destinationId: destination._id,
    }).sort({ createdAt: -1 });

    const finalMessage = await Message.findById(message._id);

    return {
      log: newLog ? formatLogDTO(newLog) : ({} as PublishLogDTO),
      aggregateStatus: finalMessage?.status || 'published',
    };
  }

  /**
   * Re-send / Forward a post again to selected or previously targeted destination channels
   */
  public static async resendPost(data: {
    messageId: string;
    destinationIds?: string[];
    destinationGroupIds?: string[];
    publishMode?: PublishMode;
    userId?: string;
  }): Promise<PublishResultData> {
    const message = await Message.findById(data.messageId);
    if (!message) {
      throw new NotFoundError('Post not found');
    }

    let targetIds: string[] = [];

    if (data.destinationIds && data.destinationIds.length > 0) {
      targetIds.push(...data.destinationIds);
    }

    if (data.destinationGroupIds && data.destinationGroupIds.length > 0) {
      const groupTargets = await DestinationGroupService.resolveTargets({
        destinationGroupIds: data.destinationGroupIds,
      });
      targetIds.push(...groupTargets.map((id) => id.toString()));
    }

    // If no targets were passed in request, re-send to all destinations previously targeted by this message
    if (targetIds.length === 0) {
      const prevSuccess = (message.deliverySummary?.successfulDestinationIds || []).map((id) =>
        id.toString()
      );
      const prevFailed = (message.deliverySummary?.failedDestinationIds || []).map((id) =>
        id.toString()
      );
      targetIds = Array.from(new Set([...prevSuccess, ...prevFailed]));
    }

    if (targetIds.length === 0) {
      throw new BadRequestError(
        'Please select at least one destination channel or category to re-send this post to.',
        ErrorCodes.NO_TARGETS_SELECTED
      );
    }

    targetIds = Array.from(new Set(targetIds));

    return this.executePublish({
      messageId: data.messageId,
      destinationIds: targetIds,
      publishMode: data.publishMode || 'copy',
      userId: data.userId,
      force: true,
    });
  }
}
