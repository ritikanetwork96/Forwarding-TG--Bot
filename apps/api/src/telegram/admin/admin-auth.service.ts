import mongoose, { Types } from 'mongoose';
import { User, type IUser } from '../../models/user.model.js';
import { env } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export class BotAdminAuthService {
  /**
   * Resolves whether a Telegram user ID belongs to an authorized admin or owner.
   *
   * Checks:
   * 1. Direct MongoDB link: User.findOne({ telegramUserId, status: 'active' })
   * 2. Environment whitelist: TELEGRAM_ADMIN_IDS containing tgUserId, mapped to the active owner/admin.
   * 3. Fallback admin session if DB is offline or user not yet seeded.
   */
  public static async getAuthorizedAdmin(telegramUserId: number | string): Promise<IUser | null> {
    const tgIdStr = String(telegramUserId).trim();
    if (!tgIdStr) return null;

    const isDbConnected = mongoose.connection.readyState === 1;

    // 1. Check direct link in MongoDB (only if DB is connected to prevent buffering timeouts)
    if (isDbConnected) {
      try {
        const linkedUser = await User.findOne({
          telegramUserId: tgIdStr,
          status: 'active',
        });
        if (linkedUser) {
          return linkedUser;
        }
      } catch (err) {
        logger.warn('Failed to query User in MongoDB for authorization:', err);
      }
    }

    // 2. Check environment admin IDs whitelist
    if (env.TELEGRAM_ADMIN_IDS) {
      const allowedAdminIds = env.TELEGRAM_ADMIN_IDS.split(',')
        .map((id) => id.trim())
        .filter(Boolean);

      if (allowedAdminIds.includes(tgIdStr)) {
        if (isDbConnected) {
          try {
            const ownerUser =
              (await User.findOne({ role: 'owner', status: 'active' })) ||
              (await User.findOne({ status: 'active' }));

            if (ownerUser) {
              logger.debug(
                `Telegram user ${tgIdStr} authenticated via TELEGRAM_ADMIN_IDS and mapped to admin ${ownerUser.email}`
              );
              return ownerUser;
            }
          } catch (err) {
            logger.warn('Failed to query owner in MongoDB for whitelist authorization:', err);
          }
        }

        // Resilient Fallback: If DB is offline, return synthesized admin object so bot remains operational
        const fallbackAdmin: Partial<IUser> = {
          _id: new Types.ObjectId('000000000000000000000001'),
          email: 'admin@system.local',
          name: 'Master Administrator',
          role: 'owner',
          status: 'active',
          telegramUserId: tgIdStr,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        return fallbackAdmin as IUser;
      }
    }

    return null;
  }

  /**
   * Links a Telegram user ID to an existing User record
   */
  public static async linkTelegramUser(
    userId: string,
    telegramUserId: string
  ): Promise<IUser | null> {
    const user = await User.findById(userId);
    if (!user) return null;

    user.telegramUserId = telegramUserId.trim();
    await user.save();
    return user;
  }
}
