import { DestinationVerifierService } from './verifier.service.js';
import { TelegramMessageService } from './message.service.js';
import { getTelegramBot } from './bot.js';
import type {
  TelegramPublishParams,
  TelegramPublishResult,
  VerificationProbeResult,
  TelegramChatMetadata,
} from './types.js';
import type { ChatType } from '@telegram-forwarder/shared';

export class TelegramService {
  /**
   * Probe and verify permissions for a target destination chat
   */
  public static async verifyDestination(telegramChatId: string): Promise<VerificationProbeResult> {
    return DestinationVerifierService.probeDestination(telegramChatId);
  }

  /**
   * Execute message publishing (forward, copy, text, album)
   */
  public static async publishMessage(
    params: TelegramPublishParams
  ): Promise<TelegramPublishResult> {
    return TelegramMessageService.dispatchPublish(params);
  }

  /**
   * Query chat metadata from Telegram API
   */
  public static async getChatMetadata(telegramChatId: string): Promise<TelegramChatMetadata> {
    const bot = getTelegramBot();
    const chat = await bot.api.getChat(telegramChatId);
    return {
      id: String(chat.id),
      title:
        'title' in chat && chat.title
          ? chat.title
          : 'username' in chat && chat.username
            ? `@${chat.username}`
            : `Chat ${chat.id}`,
      username: 'username' in chat && chat.username ? chat.username : null,
      type: chat.type as ChatType,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      isForum: Boolean((chat as any).is_forum),
    };
  }
}
