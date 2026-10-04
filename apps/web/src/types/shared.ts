/**
 * Shared types, interfaces, and constants for telegram-forwarder
 */

export type NodeEnv = 'development' | 'production' | 'test';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ==========================================
// 1. User & Auth Types
// ==========================================
export type UserRole = 'owner' | 'admin';
export type UserStatus = 'active' | 'disabled';

export interface UserDTO {
  _id: string;
  email: string;
  username?: string | null;
  name: string;
  role: UserRole;
  status: UserStatus;
  tag?: string | null;
  canManageAdmins?: boolean;
  tokenVersion: number;
  telegramUserId?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionData {
  user: UserDTO;
  token: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

// ==========================================
// 2. Category Types
// ==========================================
export type CategoryStatus = 'active' | 'archived' | 'deleted';

export interface CategoryDTO {
  _id: string;
  name: string;
  displayName?: string;
  iconEmoji?: string;
  customEmojiId?: string;
  slug: string;
  description?: string;
  icon?: string;
  destinationIds?: string[];
  status: CategoryStatus;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  displayName?: string | null;
  iconEmoji?: string;
  customEmojiId?: string | null;
  slug?: string;
  description?: string;
  icon?: string;
  destinationIds?: string[];
}

export interface UpdateCategoryRequest {
  name?: string;
  displayName?: string | null;
  iconEmoji?: string;
  customEmojiId?: string | null;
  slug?: string;
  description?: string;
  icon?: string;
  destinationIds?: string[];
  status?: CategoryStatus;
}

// ==========================================
// 3. Source & Telegram Chat Types
// ==========================================
export type ChatType = 'channel' | 'supergroup' | 'group';
export type SourceStatus = 'active' | 'paused' | 'disabled';

export interface SourceDTO {
  _id: string;
  telegramChatId: string;
  title: string;
  username?: string | null;
  type: ChatType;
  status: SourceStatus;
  lastMessageId?: number | null;
  lastIngestedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 4. Destination Types
// ==========================================
export type DestinationStatus =
  | 'pending' | 'active' | 'permission_missing' | 'invalid' | 'disabled';

export type BotMemberRole =
  | 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked' | 'unknown';

export type DestinationSenderIdentity = 'channel' | 'anonymous_admin' | 'bot';

export interface DestinationVerificationRights {
  canPostMessages: boolean;
  canSendMessages: boolean;
  canEditMessages: boolean;
  canDeleteMessages: boolean;
  canManageTopics: boolean;
}

export interface DestinationVerification {
  chatType: ChatType;
  isForum: boolean;
  botRole: BotMemberRole;
  isMember: boolean;
  canPublish: boolean;
  canSendAsChat?: boolean;
  senderIdentity?: DestinationSenderIdentity;
  rights: DestinationVerificationRights;
  lastCheckedAt?: string | null;
  failureReason?: string | null;
}

export interface DestinationDTO {
  _id: string;
  telegramChatId: string;
  title: string;
  displayName?: string;
  iconEmoji?: string;
  customEmojiId?: string;
  username?: string | null;
  type: ChatType;
  status: DestinationStatus;
  verification: DestinationVerification;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 4b. Destination Group Types
// ==========================================
export type DestinationGroupStatus = 'active' | 'archived';

export interface DestinationGroupDTO {
  _id: string;
  name: string;
  description?: string | null;
  destinationIds: string[];
  status: DestinationGroupStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DestinationGroupWithDestinationsDTO extends DestinationGroupDTO {
  destinations?: DestinationDTO[];
  destinationCount?: number;
  activeCount?: number;
}

export interface CreateDestinationGroupRequest {
  name: string;
  description?: string | null;
  destinationIds?: string[];
}

export interface UpdateDestinationGroupRequest {
  name?: string;
  description?: string | null;
  destinationIds?: string[];
  status?: DestinationGroupStatus;
}

// ==========================================
// 5. Forwarding Rule Types
// ==========================================
export type PublishMode = 'forward' | 'copy';
export type WorkflowType = 'manual_approval' | 'automatic';

export interface ForwardingRuleDTO {
  _id: string;
  name: string;
  sourceId: string;
  categoryId?: string | null;
  destinationIds: string[];
  destinationGroupIds?: string[];
  publishMode: PublishMode;
  workflowType: WorkflowType;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 6. Message / Post Types
// ==========================================
export type MessageType = 'text' | 'photo' | 'video' | 'document' | 'audio' | 'animation' | 'album';

export type MessageStatus =
  | 'draft'
  | 'pending_approval'
  | 'publishing'
  | 'published'
  | 'partially_published'
  | 'failed'
  | 'archived';

export type MediaItemType = 'photo' | 'video' | 'document' | 'audio' | 'animation';

export interface MediaItem {
  mediaType: MediaItemType;
  fileId: string;
  fileUniqueId: string;
  caption?: string;
  entities?: unknown[];
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
  fileName?: string;
  mimeType?: string;
}

export interface MediaUploadResultDTO {
  fileId: string;
  fileUniqueId: string;
  mediaType: MediaItemType;
  fileName?: string;
  fileSize: number;
  mimeType: string;
  previewUrl?: string;
  width?: number;
  height?: number;
}

export interface MessageButton {
  text: string;
  url: string;
}

export interface MessageContent {
  text?: string;
  entities?: unknown[];
  mediaItems: MediaItem[];
  mediaGroupId?: string | null;
  buttons?: MessageButton[][];
}

export interface MessageDeliverySummary {
  targetCount: number;
  successfulDestinationIds: string[];
  failedDestinationIds: string[];
  lastAttemptedAt?: string | null;
}

export interface MessageDTO {
  _id: string;
  sourceId?: string | null;
  categoryId?: string | null;
  telegramChatId?: string | null;
  telegramMessageId?: number | null;
  mediaGroupId?: string | null;
  messageType: MessageType;
  content: MessageContent;
  status: MessageStatus;
  deliverySummary: MessageDeliverySummary;
  isEditedAtSource: boolean;
  sourceEditedAt?: string | null;
  silentPublish?: boolean;
  pinOnPublish?: boolean;
  disableWebPreview?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PostDTO = MessageDTO;
export type PostStatus = MessageStatus;

export interface CreatePostRequest {
  sourceId?: string | null;
  categoryId?: string | null;
  telegramChatId?: string | null;
  telegramMessageId?: number | null;
  mediaGroupId?: string | null;
  messageType?: MessageType;
  content: MessageContent;
  status?: MessageStatus;
}

export interface UpdatePostRequest {
  categoryId?: string | null;
  content?: Partial<MessageContent>;
  status?: MessageStatus;
}

// ==========================================
// 7. Publish Log Types
// ==========================================
export type PublishLogStatus = 'success' | 'failed';

export interface PublishLogError {
  code?: string;
  message?: string;
  rawTelegram?: unknown;
}

export interface PublishLogDTO {
  _id: string;
  messageId: string;
  sourceId?: string | null;
  categoryId?: string | null;
  destinationId: string;
  ruleId?: string | null;
  triggeredBy?: string | null;
  publishMode: PublishMode;
  status: PublishLogStatus;
  targetTelegramMessageId?: number | null;
  targetTelegramMessageIds?: number[];
  error?: PublishLogError | null;
  executionTimeMs: number;
  createdAt: string;
  message?: MessageDTO | null;
}

// ==========================================
// 8. Publish Execution Response
// ==========================================
export interface PublishResultData {
  aggregateStatus: MessageStatus;
  targetCount: number;
  successfulCount: number;
  failedCount: number;
  logs: PublishLogDTO[];
}

export interface RetryPublishResultData {
  aggregateStatus: MessageStatus;
  newlySuccessfulCount: number;
  stillFailedCount: number;
  logs: PublishLogDTO[];
}

export interface PublishManualRequest {
  messageId: string;
  destinationIds?: string[];
  destinationGroupIds?: string[];
  publishMode?: PublishMode;
}

// ==========================================
// 9. Standard Error Codes
// ==========================================
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  SETUP_ALREADY_COMPLETED: 'SETUP_ALREADY_COMPLETED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  TOKEN_INVALIDATED: 'TOKEN_INVALIDATED',
  SLUG_ALREADY_EXISTS: 'SLUG_ALREADY_EXISTS',
  SOURCE_ALREADY_EXISTS: 'SOURCE_ALREADY_EXISTS',
  DESTINATION_ALREADY_EXISTS: 'DESTINATION_ALREADY_EXISTS',
  DESTINATION_NOT_VERIFIED: 'DESTINATION_NOT_VERIFIED',
  DESTINATION_GROUP_NOT_FOUND: 'DESTINATION_GROUP_NOT_FOUND',
  DESTINATION_GROUP_ALREADY_EXISTS: 'DESTINATION_GROUP_ALREADY_EXISTS',
  CANNOT_EDIT_PUBLISHED: 'CANNOT_EDIT_PUBLISHED',
  NO_FAILED_DESTINATIONS: 'NO_FAILED_DESTINATIONS',
  ALREADY_SUCCESSFUL: 'ALREADY_SUCCESSFUL',
  TELEGRAM_CHAT_NOT_FOUND: 'TELEGRAM_CHAT_NOT_FOUND',
  BOT_NOT_MEMBER: 'BOT_NOT_MEMBER',
  BOT_KICKED: 'BOT_KICKED',
  BOT_NOT_ADMIN_IN_CHANNEL: 'BOT_NOT_ADMIN_IN_CHANNEL',
  MISSING_CHANNEL_POST_RIGHT: 'MISSING_CHANNEL_POST_RIGHT',
  BOT_RESTRICTED_FROM_SENDING: 'BOT_RESTRICTED_FROM_SENDING',
  TELEGRAM_TEMPORARY_UNAVAILABLE: 'TELEGRAM_TEMPORARY_UNAVAILABLE',
  TELEGRAM_RATE_LIMITED: 'TELEGRAM_RATE_LIMITED',
  TELEGRAM_API_ERROR: 'TELEGRAM_API_ERROR',
  SCHEDULE_PAST_DATE: 'SCHEDULE_PAST_DATE',
  NO_TARGETS_SELECTED: 'NO_TARGETS_SELECTED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type AppErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ==========================================
// 10. API Envelope Types
// ==========================================
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  meta?: PaginationMeta;
  message?: string;
  error?: string;
  details?: unknown;
  timestamp: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  service: string;
  timestamp: string;
  uptime: number;
  environment: string;
}

// ==========================================
// 11. Queue & Worker Status Types
// ==========================================
export interface QueueJobCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface QueueStatusResponse {
  redis: {
    status: 'connected' | 'disconnected' | 'connecting';
  };
  worker: {
    status: 'running' | 'stopped';
    concurrency: number;
  };
  queue: {
    name: string;
    isPaused: boolean;
    counts: QueueJobCounts;
  };
}

// ==========================================
// 12. Scheduled Post Types (Phase 4)
// ==========================================
export type ScheduledPostStatus =
  | 'scheduled' | 'processing' | 'published' | 'partially_published' | 'failed' | 'cancelled';

export interface ScheduledPostDTO {
  _id: string;
  messageId: string;
  createdBy: string;
  destinationIds: string[];
  categoryId?: string | null;
  publishMode: PublishMode;
  scheduledFor: string;
  timezone: string;
  status: ScheduledPostStatus;
  queueJobId?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  cancelledAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  retryCount: number;
  message?: MessageDTO;
}

export interface CreateScheduleRequest {
  messageId: string;
  destinationIds?: string[];
  destinationGroupIds?: string[];
  categoryId?: string | null;
  publishMode?: PublishMode;
  scheduledFor: string;
  timezone?: string;
}

export interface UpdateScheduleRequest {
  destinationIds?: string[];
  destinationGroupIds?: string[];
  categoryId?: string | null;
  publishMode?: PublishMode;
  scheduledFor?: string;
  timezone?: string;
}

export interface ScheduleStatsDTO {
  total: number;
  scheduled: number;
  processing: number;
  published: number;
  partiallyPublished?: number;
  failed: number;
  cancelled: number;
  dueToday: number;
  todayDue: number;
}

// ==========================================
// 12. Dashboard Telemetry & KPI Types (Phase 5B)
// ==========================================
export interface DashboardStatsDTO {
  kpis: {
    destinations: {
      total: number;
      verified: number;
      disabled: number;
    };
    drafts: {
      total: number;
      inbound: number;
    };
    scheduled: {
      total: number;
      todayDue: number;
      nextRunAt: string | null;
    };
    queue: {
      waiting: number;
      active: number;
      delayed: number;
      failed: number;
      completed: number;
      isPaused: boolean;
      workerStatus: 'running' | 'idle' | 'stopped';
    };
    delivery24h: {
      total: number;
      success: number;
      failed: number;
      successRate: number | null;
      displayRate: string;
    };
  };
  attention: {
    hasFailures: boolean;
    failureCount: number;
    failedItems: Array<{
      id: string;
      messageId: string;
      destinationName: string;
      error: string;
      createdAt: string;
    }>;
  };
  upcomingSchedules: Array<{
    id: string;
    scheduledFor: string;
    timezone: string;
    destinationCount: number;
    previewText: string;
    categoryName?: string;
    status: string;
  }>;
  recentActivity: Array<{
    id: string;
    publishMode: 'copy' | 'forward';
    status: 'success' | 'failed' | 'partial';
    destinationName: string;
    executionTimeMs: number;
    previewText?: string;
    createdAt: string;
  }>;
  infrastructure: {
    mongo: {
      status: 'connected' | 'disconnected';
      latencyMs?: number;
    };
    redis: {
      status: 'connected' | 'disconnected' | 'connecting';
      latencyMs?: number;
    };
    worker: {
      status: 'running' | 'idle' | 'stopped';
      concurrency: number;
    };
    telegramBot: {
      status: 'connected' | 'polling' | 'error';
      username?: string | null;
    };
    overallStatus: 'healthy' | 'degraded' | 'critical';
  };
}
