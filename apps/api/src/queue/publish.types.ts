import type { PublishMode, PublishLogError } from '@telegram-forwarder/shared';

/**
 * Payload for a single destination publishing job in BullMQ
 * Strictly IDs and metadata - no raw Telegram binary/album payloads in Redis
 */
export interface PublishJobData {
  messageId: string;
  destinationId: string;
  ruleId?: string;
  publishMode: PublishMode;
  triggeredBy: 'automatic' | 'rule' | 'user' | 'retry';
  userId?: string;
  attempt?: number;
  enqueuedAt?: string;
}

/**
 * Result returned by the BullMQ worker processor upon job resolution
 */
export interface PublishJobResult {
  success: boolean;
  destinationId: string;
  targetTelegramMessageId?: number | null;
  targetTelegramMessageIds?: number[];
  error?: PublishLogError | null;
  skipped?: boolean;
  skipReason?: string;
  executionTimeMs: number;
}
