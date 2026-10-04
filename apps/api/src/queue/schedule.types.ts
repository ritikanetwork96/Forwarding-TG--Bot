/**
 * Schedule Queue & Worker Types for Phase 4 Real Scheduling
 */

export interface ScheduleJobData {
  scheduledPostId: string;
  messageId: string;
  enqueuedAt: string;
  scheduledFor: string;
}

export interface ScheduleJobResult {
  success: boolean;
  scheduledPostId: string;
  aggregateStatus?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}
