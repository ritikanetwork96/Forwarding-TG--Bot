import { getTelegramBot, getBotInfo } from './bot.js';
import { normalizeTelegramError, isTransientTelegramError } from './normalizer.js';
import type { ChatType, BotMemberRole, DestinationVerification } from '@telegram-forwarder/shared';
import type { VerificationProbeResult, TelegramChatMetadata } from './types.js';
import { logger } from '../utils/logger.js';

export class DestinationVerifierService {
  /**
   * Probe a Telegram chat and evaluate publish-capability based on chat type
   */
  public static async probeDestination(telegramChatId: string): Promise<VerificationProbeResult> {
    const bot = getTelegramBot();
    const botInfo = await getBotInfo();

    try {
      logger.info(`Probing destination chat ID: ${telegramChatId}`);

      // 1. Fetch chat metadata
      const chat = await bot.api.getChat(telegramChatId);
      const chatType = chat.type as ChatType;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isForum = Boolean((chat as any).is_forum);

      const metadata: TelegramChatMetadata = {
        id: String(chat.id),
        title:
          'title' in chat && chat.title
            ? chat.title
            : 'username' in chat && chat.username
              ? `@${chat.username}`
              : `Chat ${chat.id}`,
        username: 'username' in chat && chat.username ? chat.username : null,
        type: chatType,
        isForum,
      };

      // If chat is a private user chat
      if (chatType === 'private') {
        const anyChat = chat as any;
        const userTitle =
          [anyChat.first_name, anyChat.last_name].filter(Boolean).join(' ') ||
          metadata.title ||
          `User ${chat.id}`;
        metadata.title = userTitle;
        return {
          canPublish: true,
          metadata,
          verification: {
            chatType: 'private',
            isForum: false,
            botRole: 'member',
            isMember: true,
            canPublish: true,
            canSendAsChat: false,
            senderIdentity: 'bot',
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
        };
      }

      // 2. Fetch bot's membership status in the chat
      const member = await bot.api.getChatMember(telegramChatId, botInfo.id);
      const role = member.status as BotMemberRole;

      logger.info(`Chat probed: type=${chatType}, role=${role}, title="${metadata.title}"`);

      // 3. Evaluate rights and publish capability based on chat type
      const rights = {
        canPostMessages: false,
        canSendMessages: false,
        canEditMessages: false,
        canDeleteMessages: false,
        canManageTopics: false,
      };

      let isMember = false;
      let canPublish = false;
      let failureReason: string | null = null;

      // Handle definitive kicked/left states across all chat types
      if (role === 'kicked') {
        return {
          canPublish: false,
          metadata,
          verification: {
            chatType,
            isForum,
            botRole: 'kicked',
            isMember: false,
            canPublish: false,
            canSendAsChat: false,
            senderIdentity: 'bot',
            rights,
            lastCheckedAt: new Date().toISOString(),
            failureReason: 'Bot was kicked/banned from the chat',
          },
        };
      }

      if (role === 'left') {
        return {
          canPublish: false,
          metadata,
          verification: {
            chatType,
            isForum,
            botRole: 'left',
            isMember: false,
            canPublish: false,
            canSendAsChat: false,
            senderIdentity: 'bot',
            rights,
            lastCheckedAt: new Date().toISOString(),
            failureReason: 'Bot is not a member of the chat',
          },
        };
      }

      isMember = true;

      // Type-specific permission checks
      if (chatType === 'channel') {
        if (role !== 'administrator') {
          canPublish = false;
          failureReason = 'Bot must be an administrator in broadcast channels';
        } else {
          // Channel Administrator
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const adminRights = member as any;
          rights.canPostMessages = Boolean(adminRights.can_post_messages);
          rights.canEditMessages = Boolean(adminRights.can_edit_messages);
          rights.canDeleteMessages = Boolean(adminRights.can_delete_messages);

          if (!rights.canPostMessages) {
            canPublish = false;
            failureReason = "Bot administrator rights lack 'Post Messages' privilege";
          } else {
            canPublish = true;
          }
        }
      } else if (chatType === 'supergroup') {
        if (role === 'creator' || role === 'administrator') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const adminRights = member as any;
          rights.canSendMessages = true;
          rights.canDeleteMessages = Boolean(adminRights.can_delete_messages);
          rights.canEditMessages = Boolean(adminRights.can_edit_messages);
          rights.canManageTopics = Boolean(adminRights.can_manage_topics);
          canPublish = true;
        } else if (role === 'member') {
          // Unrestricted member in supergroup
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const chatPerms = (chat as any).permissions;
          const sendAllowed = chatPerms ? chatPerms.can_send_messages !== false : true;
          rights.canSendMessages = sendAllowed;

          if (!sendAllowed) {
            canPublish = false;
            failureReason = 'Supergroup default permissions forbid sending messages';
          } else {
            canPublish = true;
          }
        } else if (role === 'restricted') {
          // Restricted member in supergroup
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const restr = member as any;
          isMember = Boolean(restr.is_member);
          rights.canSendMessages = Boolean(restr.can_send_messages);

          if (!isMember) {
            canPublish = false;
            failureReason = 'Bot is restricted and not an active member';
          } else if (!rights.canSendMessages) {
            canPublish = false;
            failureReason = 'Bot is restricted from sending messages in this supergroup';
          } else {
            canPublish = true;
          }
        }
      } else {
        // Basic Group
        if (role === 'creator' || role === 'administrator') {
          rights.canSendMessages = true;
          canPublish = true;
        } else if (role === 'member') {
          rights.canSendMessages = true;
          canPublish = true;
        } else if (role === 'restricted') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const restr = member as any;
          isMember = Boolean(restr.is_member);
          rights.canSendMessages = Boolean(restr.can_send_messages);

          if (!isMember || !rights.canSendMessages) {
            canPublish = false;
            failureReason = 'Bot is restricted from sending messages in this group';
          } else {
            canPublish = true;
          }
        }
      }

      // 4. Capability-aware sender identity detection
      let canSendAsChat = false;
      let senderIdentity: 'channel' | 'anonymous_admin' | 'bot' = 'bot';

      if (chatType === 'channel') {
        // Broadcast channel posts inherently publish under the channel's identity
        canSendAsChat = canPublish;
        senderIdentity = 'channel';
      } else if (chatType === 'supergroup' || chatType === 'group') {
        // Check if bot has anonymous administrator privilege in the group
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isAnonymous = Boolean((member as any).is_anonymous);
        if (canPublish && isAnonymous) {
          canSendAsChat = true;
          senderIdentity = 'anonymous_admin';
        } else {
          canSendAsChat = false;
          senderIdentity = 'bot';
        }
      }

      const verification: DestinationVerification = {
        chatType,
        isForum,
        botRole: role,
        isMember,
        canPublish,
        canSendAsChat,
        senderIdentity,
        rights,
        lastCheckedAt: new Date().toISOString(),
        failureReason,
      };

      return {
        canPublish,
        verification,
        metadata,
      };
    } catch (error) {
      if (isTransientTelegramError(error)) {
        logger.warn(`Transient Telegram error during destination verification:`, error);
      } else {
        logger.error(`Error during destination verification for ${telegramChatId}:`, error);
      }
      throw normalizeTelegramError(error);
    }
  }
}
