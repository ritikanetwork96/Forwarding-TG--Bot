import type {
  ChatType,
  DestinationVerification,
  PublishMode,
  MediaItem,
} from '@telegram-forwarder/shared';

export interface TelegramChatMetadata {
  id: string;
  title: string;
  username?: string | null;
  type: ChatType;
  isForum?: boolean;
}

export interface VerificationProbeResult {
  canPublish: boolean;
  verification: DestinationVerification;
  metadata?: TelegramChatMetadata;
}

export interface InlineButtonParam {
  text: string;
  url: string;
}

export interface TelegramPublishParams {
  toChatId: string;
  fromChatId?: string | null;
  telegramMessageId?: number | null;
  publishMode: PublishMode;
  text?: string;
  mediaItems?: MediaItem[];
  mediaGroupId?: string | null;
  buttons?: InlineButtonParam[][];
  silent?: boolean;
  pin?: boolean;
  disableWebPreview?: boolean;
}

export interface TelegramPublishResult {
  success: boolean;
  targetTelegramMessageId?: number | null;
  targetTelegramMessageIds?: number[];
  error?: {
    code?: string;
    message?: string;
    rawTelegram?: unknown;
  };
}
