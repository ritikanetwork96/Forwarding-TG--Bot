import { User, type IUser } from '../models/user.model.js';
import { hashPassword, comparePassword, generateToken } from '../utils/crypto.js';
import { AuthenticationError, ConflictError, BadRequestError, AppError } from '../utils/errors.js';
import { ErrorCodes, type AuthSessionData, type UserDTO } from '@telegram-forwarder/shared';
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getTelegramBot, isBotConfigured } from '../telegram/bot.js';

export function formatUserDTO(user: IUser): UserDTO {
  return {
    _id: user._id.toString(),
    email: user.email,
    username: user.username || (user.email.includes('@') ? user.email.split('@')[0] : user.email),
    name: user.name,
    role: user.role,
    status: user.status,
    tag: user.tag || null,
    canManageAdmins: user.role === 'owner' || Boolean(user.canManageAdmins),
    tokenVersion: user.tokenVersion,
    telegramUserId: user.telegramUserId || null,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export class AuthService {
  /**
   * Auto-provisions or synchronizes the primary owner account from environment configuration (.env)
   * This ensures fixed admin credentials and completely disables public self-registration.
   */
  public static async seedInitialAdmin(): Promise<void> {
    const ownerEmail = env.ADMIN_EMAIL.toLowerCase().trim();
    const ownerUsername = env.ADMIN_USERNAME.toLowerCase().trim();

    // Check if an owner already exists
    const existingOwner = await User.findOne({
      $or: [
        { role: 'owner' },
        { email: ownerEmail },
        { username: ownerUsername },
      ],
    });

    if (!existingOwner) {
      const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
      await User.create({
        email: ownerEmail,
        username: ownerUsername,
        passwordHash,
        name: env.ADMIN_NAME.trim(),
        role: 'owner',
        status: 'active',
        canManageAdmins: true,
        tag: 'Owner',
        tokenVersion: 0,
      });
      logger.info(`✅ System Owner auto-provisioned securely from .env configuration (${ownerEmail})`);
    } else {
      // Ensure existing owner has active status and owner privileges
      if (existingOwner.status !== 'active' || existingOwner.role !== 'owner' || !existingOwner.canManageAdmins) {
        existingOwner.status = 'active';
        existingOwner.role = 'owner';
        existingOwner.canManageAdmins = true;
        await existingOwner.save();
        logger.info(`✅ System Owner status and privileges verified.`);
      }
    }
  }

  /**
   * Disabled first-time registration: permanently rejects public setup.
   */
  public static async setupFirstOwner(_data: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthSessionData> {
    throw new ConflictError(
      'Public registration is disabled. Administrator access is provisioned securely via system environment.',
      ErrorCodes.SETUP_ALREADY_COMPLETED
    );
  }

  /**
   * Authenticate admin user
   */
  public static async login(data: { email: string; password: string }): Promise<AuthSessionData> {
    const rawIdentifier = (data.email || '').trim();
    const isEmail = rawIdentifier.includes('@');

    const query = isEmail
      ? { email: rawIdentifier.toLowerCase() }
      : {
          $or: [
            { username: rawIdentifier.toLowerCase() },
            { email: rawIdentifier.toLowerCase() },
            { name: { $regex: new RegExp(`^${rawIdentifier}$`, 'i') } },
            ...(rawIdentifier.toLowerCase() === 'admin' ? [{ role: 'owner' }] : []),
          ],
        };

    const user = await User.findOne(query).select('+passwordHash +tokenVersion');

    if (!user) {
      throw new AuthenticationError('Invalid username/email or password', ErrorCodes.INVALID_CREDENTIALS);
    }

    const isValid = await comparePassword(data.password, user.passwordHash);
    if (!isValid) {
      throw new AuthenticationError('Invalid username/email or password', ErrorCodes.INVALID_CREDENTIALS);
    }

    if (user.status !== 'active') {
      throw new AuthenticationError(
        'Account is disabled. Please contact the system owner.',
        ErrorCodes.ACCOUNT_DISABLED
      );
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    return {
      user: formatUserDTO(user),
      token,
    };
  }

  /**
   * Requests a one-time password reset OTP sent via Telegram Bot
   */
  public static async requestTelegramPasswordReset(
    identifier: string,
    clientIp: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanId = (identifier || '').trim().toLowerCase();
    if (!cleanId) {
      throw new BadRequestError('Username or email is required');
    }

    const user = await User.findOne({
      $or: [
        { email: cleanId },
        { username: cleanId },
        ...(cleanId === 'admin' ? [{ role: 'owner' }] : []),
      ],
    }).select('+resetPasswordOtp +resetPasswordExpires');

    if (!user) {
      // Neutral message to prevent username enumeration attacks
      return {
        success: true,
        message: 'If an authorized administrator matches this identifier, a verification code was sent to Telegram.',
      };
    }

    if (user.status !== 'active') {
      throw new AuthenticationError('This account is disabled. Contact system owner.');
    }

    // Generate secure 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = expires;
    await user.save();

    // Determine target Telegram Chat ID:
    // 1. user.telegramUserId
    // 2. env.TELEGRAM_ADMIN_IDS
    const targetChatIds: string[] = [];
    if (user.telegramUserId) {
      targetChatIds.push(user.telegramUserId);
    }
    if (env.TELEGRAM_ADMIN_IDS) {
      const configuredAdmins = env.TELEGRAM_ADMIN_IDS.split(',').map((id) => id.trim()).filter(Boolean);
      for (const id of configuredAdmins) {
        if (!targetChatIds.includes(id)) {
          targetChatIds.push(id);
        }
      }
    }

    if (targetChatIds.length === 0 || !isBotConfigured()) {
      logger.warn(`Password reset requested for ${user.email}, but no Telegram chat ID is configured to receive the alert!`);
      throw new AppError(
        'Telegram Bot or Telegram Admin ID is not configured. Please verify TELEGRAM_ADMIN_IDS in .env',
        500
      );
    }

    const bot = getTelegramBot();
    const dateStr = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true });

    const messageHtml =
      `🔐 <b>SECURITY ALERT: PASSWORD RESET REQUEST</b>\n\n` +
      `A password reset was requested for administrator account:\n` +
      `👤 <b>Account:</b> <code>${user.email}</code> (@${user.username || 'admin'})\n` +
      `🌐 <b>IP Address:</b> <code>${clientIp}</code>\n` +
      `⏰ <b>Requested At:</b> <code>${dateStr} (IST)</code>\n\n` +
      `🔢 <b>Your 6-Digit One-Time Code (OTP):</b>\n` +
      `👉 <b><code>${otp}</code></b> 👈\n\n` +
      `⏱ <i>This OTP is valid for 10 minutes. Enter it in the Web Dashboard to choose a new password.</i>\n\n` +
      `⚠️ <i>If you did NOT request this reset, your account is still secure. Do NOT share this code with anyone.</i>`;

    let sent = false;
    for (const chatId of targetChatIds) {
      try {
        await bot.api.sendMessage(chatId, messageHtml, { parse_mode: 'HTML' });
        sent = true;
      } catch (tgErr) {
        logger.error(`Failed to send password reset OTP to chat ${chatId}:`, tgErr);
      }
    }

    if (!sent) {
      throw new AppError('Failed to deliver verification code to Telegram. Please check your bot chat.', 502);
    }

    return {
      success: true,
      message: 'Verification code has been dispatched directly to your Telegram Bot!',
    };
  }

  /**
   * Verifies OTP and updates password with global session invalidation
   */
  public static async verifyTelegramPasswordReset(data: {
    identifier: string;
    otp: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    const cleanId = (data.identifier || '').trim().toLowerCase();
    const cleanOtp = (data.otp || '').trim();

    if (!data.newPassword || data.newPassword.length < 8) {
      throw new BadRequestError('New password must be at least 8 characters');
    }

    const user = await User.findOne({
      $or: [
        { email: cleanId },
        { username: cleanId },
        ...(cleanId === 'admin' ? [{ role: 'owner' }] : []),
      ],
    }).select('+passwordHash +tokenVersion +resetPasswordOtp +resetPasswordExpires');

    if (!user || !user.resetPasswordOtp || !user.resetPasswordExpires) {
      throw new AuthenticationError('Invalid or expired verification code');
    }

    if (new Date() > user.resetPasswordExpires) {
      user.resetPasswordOtp = null;
      user.resetPasswordExpires = null;
      await user.save();
      throw new AuthenticationError('Verification code has expired. Please request a new one.');
    }

    if (user.resetPasswordOtp !== cleanOtp) {
      throw new AuthenticationError('Incorrect verification code. Please check your Telegram.');
    }

    // Set new password
    user.passwordHash = await hashPassword(data.newPassword);
    user.tokenVersion += 1; // Invalidate all previous JWT sessions!
    user.resetPasswordOtp = null;
    user.resetPasswordExpires = null;
    await user.save();

    // Send confirmation notification on Telegram
    if (isBotConfigured()) {
      try {
        const bot = getTelegramBot();
        const targetChatId = user.telegramUserId || env.TELEGRAM_ADMIN_IDS?.split(',')[0]?.trim();
        if (targetChatId) {
          await bot.api.sendMessage(
            targetChatId,
            `✅ <b>PASSWORD CHANGED SUCCESSFULLY</b>\n\n` +
              `The password for administrator <code>${user.email}</code> was successfully updated.\n` +
              `All previous dashboard sessions have been revoked for your security.`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (notifyErr) {
        logger.warn('Failed to send password change confirmation notice:', notifyErr);
      }
    }

    return {
      success: true,
      message: 'Password successfully changed! You can now sign in with your new password.',
    };
  }

  /**
   * Logout user: increments tokenVersion, instantly invalidating all issued JWTs
   */
  public static async logout(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $inc: { tokenVersion: 1 },
    });
  }
}
