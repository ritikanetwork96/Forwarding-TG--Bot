import { type Context, InlineKeyboard } from 'grammy';
import { Types } from 'mongoose';
import { BotAdminAuthService } from './admin-auth.service.js';
import { botSessionManager } from './bot-session.service.js';
import { BotKeyboardService } from './bot-keyboard.service.js';
import { Message } from '../../models/message.model.js';
import { Category } from '../../models/category.model.js';
import { Destination } from '../../models/destination.model.js';
import { DestinationGroup } from '../../models/destination-group.model.js';
import { ForwardingRule } from '../../models/forwarding-rule.model.js';
import { Source } from '../../models/source.model.js';
import { ScheduledPost, type IScheduledPost } from '../../models/scheduled-post.model.js';
import { IngestionService, type TelegramRawMessage } from '../../services/ingestion.service.js';
import { RuleEngineService } from '../../services/rule-engine.service.js';
import { PublishService } from '../../services/publish.service.js';
import { ScheduleService } from '../../services/schedule.service.js';
import { CategoryService } from '../../services/category.service.js';
import { DestinationService } from '../../services/destination.service.js';
import { TelegramService } from '../telegram.service.js';
import { albumDebouncer } from '../debouncer.service.js';
import { getTelegramBot } from '../bot.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/index.js';
import type { MessageContent, MediaItem } from '@telegram-forwarder/shared';

export class BotAdminService {
  /**
   * Initializes bot admin album debouncer callback
   */
  public static initialize(): void {
    albumDebouncer.setFlushCallback(async (mediaGroupId, batch) => {
      if (batch.telegramChatId && !batch.telegramChatId.startsWith('-')) {
        await BotAdminService.handleFlushedAdminAlbum(mediaGroupId, batch);
      } else {
        await IngestionService.processFlushedAlbum(mediaGroupId, batch);
      }
    });
  }

  /**
   * Helper: Edits the current message if possible, otherwise sends a new reply
   */
  public static async sendOrEdit(
    ctx: Context,
    text: string,
    keyboard: InlineKeyboard
  ): Promise<void> {
    if (ctx.callbackQuery?.message) {
      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        return;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('message is not modified') || errMsg.includes('MESSAGE_NOT_MODIFIED')) {
          try {
            await ctx.answerCallbackQuery({ text: '🔄 Refreshed (Already up to date)' });
          } catch {
            // Callback answer might have already been sent
          }
          return;
        }

        // If the original message was media (photo/video), edit caption instead
        if (
          errMsg.includes('there is no text in the message to edit') ||
          errMsg.includes('no text in the message')
        ) {
          try {
            await ctx.editMessageCaption({
              caption: text,
              parse_mode: 'HTML',
              reply_markup: keyboard,
            });
            return;
          } catch (capErr: unknown) {
            const capErrMsg = capErr instanceof Error ? capErr.message : String(capErr);
            if (
              capErrMsg.includes('message is not modified') ||
              capErrMsg.includes('MESSAGE_NOT_MODIFIED')
            ) {
              try {
                await ctx.answerCallbackQuery({ text: '🔄 Refreshed (Already up to date)' });
              } catch {
                // Ignore
              }
              return;
            }
          }
        }
        // Fall back to reply if message edit fails due to expired or deleted message
      }
    }
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  // ==========================================
  // COMMAND HANDLERS
  // ==========================================

  public static async handleStart(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply(
        '⛔ <b>Access Denied</b>\n\n' +
          'You are not registered as an administrator for this bot.\n' +
          `Your Telegram User ID is: <code>${fromId}</code>\n\n` +
          'Please configure this ID in the system environment (<code>TELEGRAM_ADMIN_IDS</code>) or Web Admin Panel.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    botSessionManager.clearAdminState(fromId);
    botSessionManager.setAdminState(fromId, 'MAIN');

    const { text, keyboard } = await BotKeyboardService.renderDashboard(admin.name);
    await this.sendOrEdit(ctx, text, keyboard);
  }

  public static async handleNew(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply('⛔ Unauthorized.', { parse_mode: 'HTML' });
      return;
    }

    botSessionManager.setAdminState(fromId, 'NEW_POST_WAITING');
    const { text, keyboard } = BotKeyboardService.renderNewPostWaiting();
    await this.sendOrEdit(ctx, text, keyboard);
  }

  public static async handleDrafts(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply('⛔ Unauthorized.', { parse_mode: 'HTML' });
      return;
    }

    botSessionManager.setAdminState(fromId, 'DRAFTS');
    const { text, keyboard } = await BotKeyboardService.renderDrafts();
    await this.sendOrEdit(ctx, text, keyboard);
  }

  public static async handleRecent(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply('⛔ Unauthorized.', { parse_mode: 'HTML' });
      return;
    }

    botSessionManager.setAdminState(fromId, 'RECENT_POSTS');
    const { text, keyboard } = await BotKeyboardService.renderRecentPosts(1);
    await this.sendOrEdit(ctx, text, keyboard);
  }

  // Alias for /recent and /history for backward compatibility
  public static async handlePosts(ctx: Context): Promise<void> {
    await this.handleRecent(ctx);
  }

  public static async handleHistory(ctx: Context): Promise<void> {
    await this.handleRecent(ctx);
  }

  public static async handleScheduled(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply('⛔ Unauthorized.', { parse_mode: 'HTML' });
      return;
    }

    botSessionManager.setAdminState(fromId, 'SCHEDULED_POSTS');
    const { text, keyboard } = await BotKeyboardService.renderScheduledList(1);
    await this.sendOrEdit(ctx, text, keyboard);
  }

  public static parseScheduledDate(dateStr: string, timeStr: string, tz = 'Asia/Kolkata'): Date {
    const dateParts = dateStr.split('-').map(Number);
    const timeParts = timeStr.split(':').map(Number);
    const y = dateParts[0] ?? new Date().getFullYear();
    const m = (dateParts[1] ?? 1) - 1;
    const d = dateParts[2] ?? 1;
    const h = timeParts[0] ?? 0;
    const min = timeParts[1] ?? 0;

    const guessUtc = new Date(Date.UTC(y, m, d, h, min, 0));
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hourCycle: 'h23',
      });
      const parts = formatter.formatToParts(guessUtc);
      const partMap: Record<string, number> = {};
      for (const p of parts) {
        if (p.type !== 'literal') {
          partMap[p.type] = Number(p.value);
        }
      }
      const asLocalUtc = Date.UTC(
        partMap.year ?? y,
        (partMap.month ?? m + 1) - 1,
        partMap.day ?? d,
        partMap.hour ?? h,
        partMap.minute ?? min,
        partMap.second ?? 0
      );
      const offsetMs = asLocalUtc - guessUtc.getTime();
      return new Date(guessUtc.getTime() - offsetMs);
    } catch {
      // Fallback
    }

    return new Date(`${dateStr}T${timeStr}:00`);
  }

  public static parseCustomDateTimeInput(input: string, tz = 'Asia/Kolkata'): Date | null {
    const raw = input.trim();
    if (!raw) return null;

    // 1. Relative delays: e.g. "15m", "30 mins", "in 45m", "2h", "in 2 hours", "1d"
    const relMatch = raw.match(
      /^(?:in\s+)?(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i
    );
    if (relMatch && relMatch[1] && relMatch[2]) {
      const val = parseInt(relMatch[1], 10);
      const unit = relMatch[2].toLowerCase();
      let ms = 0;
      if (unit.startsWith('m')) ms = val * 60 * 1000;
      else if (unit.startsWith('h')) ms = val * 60 * 60 * 1000;
      else if (unit.startsWith('d')) ms = val * 24 * 60 * 60 * 1000;
      return new Date(Date.now() + ms);
    }

    // 2. Keyword today / tomorrow: e.g. "tomorrow 15:30", "today 18:00", "tomorrow 2:30pm"
    const keyMatch = raw.match(/^(today|tomorrow)\s+(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
    if (keyMatch && keyMatch[1] && keyMatch[2] && keyMatch[3]) {
      const isTomorrow = keyMatch[1].toLowerCase() === 'tomorrow';
      let hour = parseInt(keyMatch[2], 10);
      const min = parseInt(keyMatch[3], 10);
      const meridiem = keyMatch[4]?.toLowerCase();
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;

      const dateStr = BotKeyboardService.getLocalDateString(isTomorrow ? 1 : 0, tz);
      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      return BotAdminService.parseScheduledDate(dateStr, timeStr, tz);
    }

    // 3. Time only: e.g. "18:30", "2:30 pm", "9:00 am"
    const timeMatch = raw.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
    if (timeMatch && timeMatch[1] && timeMatch[2]) {
      let hour = parseInt(timeMatch[1], 10);
      const min = parseInt(timeMatch[2], 10);
      const meridiem = timeMatch[3]?.toLowerCase();
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;

      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const todayStr = BotKeyboardService.getLocalDateString(0, tz);
      let target = BotAdminService.parseScheduledDate(todayStr, timeStr, tz);
      if (target.getTime() <= Date.now() + 60 * 1000) {
        const tomorrowStr = BotKeyboardService.getLocalDateString(1, tz);
        target = BotAdminService.parseScheduledDate(tomorrowStr, timeStr, tz);
      }
      return target;
    }

    // 4. Standard Date + Time: e.g. "2026-09-29 18:30" or "2026/09/29 18:30"
    const fullMatch = raw.match(
      /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\s+(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i
    );
    if (fullMatch && fullMatch[1] && fullMatch[2] && fullMatch[3] && fullMatch[4] && fullMatch[5]) {
      const y = fullMatch[1];
      const m = String(parseInt(fullMatch[2], 10)).padStart(2, '0');
      const d = String(parseInt(fullMatch[3], 10)).padStart(2, '0');
      let hour = parseInt(fullMatch[4], 10);
      const min = parseInt(fullMatch[5], 10);
      const meridiem = fullMatch[6]?.toLowerCase();
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;

      const dateStr = `${y}-${m}-${d}`;
      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      return BotAdminService.parseScheduledDate(dateStr, timeStr, tz);
    }

    // 5. Day first: e.g. "29-09-2026 18:30" or "29/09/2026 18:30"
    const dayFirstMatch = raw.match(
      /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\s+(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i
    );
    if (
      dayFirstMatch &&
      dayFirstMatch[1] &&
      dayFirstMatch[2] &&
      dayFirstMatch[3] &&
      dayFirstMatch[4] &&
      dayFirstMatch[5]
    ) {
      const d = String(parseInt(dayFirstMatch[1], 10)).padStart(2, '0');
      const m = String(parseInt(dayFirstMatch[2], 10)).padStart(2, '0');
      const y = dayFirstMatch[3];
      let hour = parseInt(dayFirstMatch[4], 10);
      const min = parseInt(dayFirstMatch[5], 10);
      const meridiem = dayFirstMatch[6]?.toLowerCase();
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;

      const dateStr = `${y}-${m}-${d}`;
      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      return BotAdminService.parseScheduledDate(dateStr, timeStr, tz);
    }

    // 6. Generic Date fallback
    const directDate = new Date(raw);
    if (!isNaN(directDate.getTime())) {
      return directDate;
    }

    return null;
  }

  public static async handleShowDock(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) return;

    try {
      if (ctx.message) {
        await ctx.deleteMessage();
      }
    } catch {
      // Ignore
    }

    if (ctx.callbackQuery) {
      try {
        await ctx.answerCallbackQuery();
      } catch {
        // Ignore
      }
    }
  }

  public static async handleHideDock(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) return;

    // 1. Immediately delete user's incoming message so "❌ Hide Dock" or command never appears in chat history
    try {
      if (ctx.message) {
        await ctx.deleteMessage();
      }
    } catch {
      // Ignore if deletion failed
    }

    // 2. If called via callback query, answer it cleanly
    if (ctx.callbackQuery) {
      try {
        await ctx.answerCallbackQuery({ text: '📱 Quick Dock hidden' });
      } catch {
        // Ignore
      }
    }

    // 3. Remove reply keyboard silently with a transient message that gets instantly deleted
    try {
      const tempMsg = await ctx.reply('⌨️ <i>Dock hidden</i>', {
        parse_mode: 'HTML',
        disable_notification: true,
        reply_markup: { remove_keyboard: true },
      });
      // Delete temporary message after 300ms so chat is 100% spotless
      setTimeout(async () => {
        try {
          await ctx.api.deleteMessage(tempMsg.chat.id, tempMsg.message_id);
        } catch {
          // Ignore
        }
      }, 400);
    } catch {
      // Ignore
    }
  }

  public static async handleDestinations(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply('⛔ Unauthorized.', { parse_mode: 'HTML' });
      return;
    }

    botSessionManager.setAdminState(fromId, 'DESTINATION_LIST');
    const { text, keyboard } = await BotKeyboardService.renderDestinationList(1);
    await this.sendOrEdit(ctx, text, keyboard);
  }

  public static async handleAddDestination(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply('⛔ Unauthorized.', { parse_mode: 'HTML' });
      return;
    }

    botSessionManager.setAdminState(fromId, 'ADD_DEST_WAITING');
    let botUsername = 'bot';
    try {
      const botInfo = await getTelegramBot().api.getMe();
      botUsername = botInfo.username || 'bot';
    } catch {
      // Fallback
    }
    const { text, keyboard } = BotKeyboardService.renderAddDestinationPrompt(botUsername);
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  public static async handleCategories(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply('⛔ Unauthorized.', { parse_mode: 'HTML' });
      return;
    }

    botSessionManager.setAdminState(fromId, 'CATEGORY_LIST');
    const { text, keyboard } = await BotKeyboardService.renderCategoryList();
    await this.sendOrEdit(ctx, text, keyboard);
  }

  public static async handleActivity(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply('⛔ Unauthorized.', { parse_mode: 'HTML' });
      return;
    }

    botSessionManager.setAdminState(fromId, 'ACTIVITY');
    const { text, keyboard } = await BotKeyboardService.renderActivity();
    await this.sendOrEdit(ctx, text, keyboard);
  }

  public static async handleRules(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply('⛔ Unauthorized.', { parse_mode: 'HTML' });
      return;
    }

    botSessionManager.setAdminState(fromId, 'RULES_LIST');
    const { text, keyboard } = await BotKeyboardService.renderRulesList(1);
    await this.sendOrEdit(ctx, text, keyboard);
  }

  public static async handleApprovals(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply('⛔ Unauthorized.', { parse_mode: 'HTML' });
      return;
    }

    botSessionManager.setAdminState(fromId, 'APPROVALS');
    const { text, keyboard } = await BotKeyboardService.renderPendingApprovals(1);
    await this.sendOrEdit(ctx, text, keyboard);
  }

  public static async handleSettings(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply('⛔ Unauthorized.', { parse_mode: 'HTML' });
      return;
    }

    botSessionManager.setAdminState(fromId, 'SETTINGS');
    const { text, keyboard } = BotKeyboardService.renderSettings();
    await this.sendOrEdit(ctx, text, keyboard);
  }

  public static async handleHelp(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply('⛔ Unauthorized.', { parse_mode: 'HTML' });
      return;
    }

    botSessionManager.setAdminState(fromId, 'HELP');
    const { text, keyboard } = BotKeyboardService.renderHelp();
    await this.sendOrEdit(ctx, text, keyboard);
  }

  public static async handleCancel(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (fromId) {
      botSessionManager.clearAdminState(fromId);
    }
    const keyboard = new InlineKeyboard().text('⌂ Main Menu', 'nav:main');
    await ctx.reply('❌ Active interaction cancelled.', {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  public static async handleResetPasswordCommand(ctx: Context): Promise<void> {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply('⛔ <b>Access Denied:</b> You are not registered as an administrator.', {
        parse_mode: 'HTML',
      });
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    admin.resetPasswordOtp = otp;
    admin.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
    await admin.save();

    const dateStr = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true });

    await ctx.reply(
      `🔐 <b>WEB DASHBOARD PASSWORD RESET</b>\n\n` +
        `👤 <b>Admin:</b> <code>${admin.email}</code> (@${admin.username || 'admin'})\n` +
        `⏰ <b>Generated:</b> <code>${dateStr} (IST)</code>\n\n` +
        `🔢 <b>Your One-Time Verification Code (OTP):</b>\n` +
        `👉 <b><code>${otp}</code></b> 👈\n\n` +
        `⏱ <i>This OTP is valid for 10 minutes. Go to the Web Dashboard login screen and enter this code with your new password.</i>\n\n` +
        `🌐 <b>Dashboard:</b> <a href="${env.FRONTEND_URL}/login">${env.FRONTEND_URL}/login</a>`,
      {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }
    );
  }

  // ==========================================
  // INCOMING ADMIN CONTENT HANDLER
  // ==========================================

  public static async handleAdminPrivateMessage(ctx: Context): Promise<void> {
    if (!ctx.message || !ctx.from?.id) return;
    const fromId = ctx.from.id;

    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.reply('⛔ <b>Unauthorized:</b> You are not registered as an administrator.', {
        parse_mode: 'HTML',
      });
      return;
    }

    const rawMsg = ctx.message as unknown as TelegramRawMessage;
    const rawText = (ctx.message.text || '').trim();

    // 0. Handle Cancel Setup / Cancel Button Taps
    if (
      rawText === '❌ Cancel Setup' ||
      rawText === '❌ Cancel' ||
      rawText === 'Cancel' ||
      rawText === '/cancel'
    ) {
      botSessionManager.clearAdminState(fromId);
      await ctx.reply('❌ <b>Operation cancelled.</b> Returned to main dashboard.', {
        parse_mode: 'HTML',
        reply_markup: BotKeyboardService.getAdminBottomDock(),
      });
      const { text, keyboard } = await BotKeyboardService.renderDashboard(admin.name || 'Admin');
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      return;
    }

    // 0b. Handle Native Telegram request_chat (chat_shared / chats_shared event)
    const rawAny = rawMsg as any;
    let sharedChatId: number | string | null = null;
    if (rawAny?.chat_shared?.chat_id) {
      sharedChatId = rawAny.chat_shared.chat_id;
    } else if (rawAny?.chats_shared?.chat_ids?.[0]) {
      sharedChatId = rawAny.chats_shared.chat_ids[0];
    }
    if (sharedChatId) {
      await this.handleConnectDestinationChat(ctx, String(sharedChatId), fromId);
      return;
    }

    // 1. Handle Persistent Action Dock Taps (Robust matching for all dock variations)
    const normalized = rawText.toLowerCase().replace(/^[^\w\s]+/, '').trim();

    if (
      rawText === '✍️ New Post' ||
      rawText === '✍️ Create New Post' ||
      rawText === '🚀 Broadcast Studio' ||
      rawText === '✍️ New Broadcast' ||
      rawText === '✍️ Author New Post' ||
      normalized === 'new post' ||
      normalized === 'create new post' ||
      normalized === 'broadcast studio' ||
      normalized === 'new broadcast'
    ) {
      await this.handleNew(ctx);
      return;
    }

    if (
      rawText === '📢 Add Channel' ||
      rawText === '📢 Connect Channel' ||
      rawText === '➕ Add Channel' ||
      rawText === '📢 Add Channel / Group' ||
      rawText === '➕ Add Channel / Group' ||
      rawText === '➕ Connect Channel / Group' ||
      rawText === '📢 Choose Channel from My List' ||
      rawText === '👥 Choose Group from My List' ||
      normalized === 'add channel' ||
      normalized === 'connect channel' ||
      normalized === 'add channel / group' ||
      normalized === 'choose channel from my list' ||
      normalized === 'choose group from my list'
    ) {
      await this.handleAddDestination(ctx);
      return;
    }

    if (
      rawText === '⚡ Rules' ||
      rawText === '⚡ Forward Rules' ||
      rawText === '⚡ Auto Rules' ||
      rawText === '⚡ Automation Rules' ||
      normalized === 'rules' ||
      normalized === 'forward rules' ||
      normalized === 'auto rules' ||
      normalized === 'automation rules'
    ) {
      await this.handleRules(ctx);
      return;
    }

    if (
      rawText === '🎯 Channels' ||
      rawText === '🎯 Destinations' ||
      rawText === '🎯 Channels & Groups' ||
      rawText === '🎯 Connected Channels' ||
      normalized === 'channels' ||
      normalized === 'destinations' ||
      normalized === 'channels & groups' ||
      normalized === 'connected channels'
    ) {
      await this.handleDestinations(ctx);
      return;
    }

    if (
      rawText === '📁 Categories' ||
      normalized === 'categories'
    ) {
      await this.handleCategories(ctx);
      return;
    }

    if (
      rawText === '🕒 Scheduled' ||
      rawText === '🕒 Schedules' ||
      rawText === '🕒 Scheduled Posts' ||
      normalized === 'scheduled' ||
      normalized === 'schedules' ||
      normalized === 'scheduled posts'
    ) {
      await this.handleScheduled(ctx);
      return;
    }

    if (
      rawText === '📜 Post History' ||
      rawText === '📜 History' ||
      rawText === '📜 Logs' ||
      rawText === '📜 Broadcast Logs' ||
      rawText === '📜 Delivery Logs' ||
      rawText === '🕘 Recent Posts' ||
      rawText === '📝 Draft Stash' ||
      normalized === 'post history' ||
      normalized === 'history' ||
      normalized === 'logs' ||
      normalized === 'broadcast logs' ||
      normalized === 'delivery logs' ||
      normalized === 'recent posts' ||
      normalized === 'draft stash'
    ) {
      await this.handleRecent(ctx);
      return;
    }

    if (
      rawText === '📊 Dashboard' ||
      rawText === '📊 Main Console' ||
      rawText === '📊 Console' ||
      normalized === 'dashboard' ||
      normalized === 'main console' ||
      normalized === 'console'
    ) {
      await this.handleStart(ctx);
      return;
    }

    if (
      rawText === '⚙️ Settings' ||
      normalized === 'settings'
    ) {
      await this.handleSettings(ctx);
      return;
    }

    if (
      rawText === '❌ Hide Dock' ||
      rawText === '❌ Hide Quick Dock' ||
      normalized === 'hide dock' ||
      normalized === 'hide quick dock'
    ) {
      await this.handleHideDock(ctx);
      return;
    }

    if (
      rawText === '📱 Open Quick Dock' ||
      rawText === '📱 Show Quick Dock' ||
      rawText === '📱 Open Bottom Quick Dock' ||
      normalized === 'open quick dock' ||
      normalized === 'show quick dock'
    ) {
      await this.handleShowDock(ctx);
      return;
    }

    // 2. Handle In-Bot Creation & Edit States
    const adminState = botSessionManager.getAdminState(fromId);

    // 2-edit. In-Bot Post Text / Caption / Media Edit
    if (adminState?.state === 'EDIT_POST_TEXT') {
      const msgId = adminState.targetEntityId || adminState.activeMessageId;
      botSessionManager.clearAdminState(fromId);
      if (msgId && Types.ObjectId.isValid(msgId)) {
        const post = await Message.findById(msgId);
        if (post) {
          // If user sent a new photo, video, or document, update the media!
          if (rawMsg.photo && rawMsg.photo.length > 0) {
            const bestPhoto = rawMsg.photo[rawMsg.photo.length - 1];
            if (bestPhoto) {
              post.messageType = 'photo';
              post.content.mediaItems = [
                {
                  type: 'photo',
                  fileId: bestPhoto.file_id,
                  fileUniqueId: bestPhoto.file_unique_id,
                  fileSize: bestPhoto.file_size,
                  width: bestPhoto.width,
                  height: bestPhoto.height,
                } as unknown as MediaItem,
              ];
            }
          } else if (rawMsg.video) {
            post.messageType = 'video';
            post.content.mediaItems = [
              {
                type: 'video',
                fileId: rawMsg.video.file_id,
                fileUniqueId: rawMsg.video.file_unique_id,
                fileSize: rawMsg.video.file_size,
                mimeType: rawMsg.video.mime_type,
                duration: rawMsg.video.duration,
                width: rawMsg.video.width,
                height: rawMsg.video.height,
              } as unknown as MediaItem,
            ];
          } else if (rawMsg.document) {
            post.messageType = 'document';
            post.content.mediaItems = [
              {
                type: 'document',
                fileId: rawMsg.document.file_id,
                fileUniqueId: rawMsg.document.file_unique_id,
                fileSize: rawMsg.document.file_size,
                fileName: rawMsg.document.file_name,
                mimeType: rawMsg.document.mime_type,
              } as unknown as MediaItem,
            ];
          }

          post.content.text = rawText || rawMsg.caption || '';
          post.content.entities = (rawMsg.entities || rawMsg.caption_entities || []) as unknown[];
          await post.save();

          const session = botSessionManager.getOrCreate(msgId, post.categoryId?.toString());
          const { text: menuText, keyboard } = await BotKeyboardService.renderPostMenu(
            post,
            session
          );
          await ctx.reply(`✅ <b>Post updated successfully!</b>\n\n${menuText}`, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
          });
          return;
        }
      }
      await ctx.reply('❌ <b>Post no longer exists.</b>', { parse_mode: 'HTML' });
      return;
    }

    // 2-rename-dest. In-Bot Channel Rename
    if (adminState?.state === 'RENAME_DEST' && rawText) {
      const destId = adminState.targetEntityId || adminState.activeMessageId;
      botSessionManager.clearAdminState(fromId);
      if (destId && Types.ObjectId.isValid(destId)) {
        try {
          const dest = await Destination.findById(destId);
          if (dest) {
            dest.displayName = rawText.trim();
            await dest.save();
            const { text, keyboard } = BotKeyboardService.renderDestinationDetails(dest);
            await ctx.reply(`✅ <b>Channel display name updated!</b>\n\n${text}`, {
              parse_mode: 'HTML',
              reply_markup: keyboard,
            });
            return;
          }
        } catch (err: unknown) {
          logger.error('Error renaming destination:', err);
          const errMsg = err instanceof Error ? err.message : String(err);
          await ctx.reply(`⚠️ <b>Could not rename channel:</b> ${errMsg}`, { parse_mode: 'HTML' });
          return;
        }
      }
      const kb = new InlineKeyboard().text('🎯 View Channels', 'nav:dests');
      await ctx.reply('❌ <b>Destination not found or session expired.</b> Please select a channel from the list:', {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
      return;
    }

    // 2-rename-cat. In-Bot Category Rename
    if (adminState?.state === 'RENAME_CAT' && rawText) {
      const catId = adminState.targetEntityId || adminState.activeMessageId;
      botSessionManager.clearAdminState(fromId);
      if (catId && Types.ObjectId.isValid(catId)) {
        try {
          const cat = await Category.findById(catId);
          if (cat) {
            const newName = rawText.trim();
            cat.name = newName;
            cat.displayName = newName;
            await cat.save();
            const { text, keyboard } = BotKeyboardService.renderCategoryDetails(cat);
            await ctx.reply(`✅ <b>Category renamed!</b>\n\n${text}`, {
              parse_mode: 'HTML',
              reply_markup: keyboard,
            });
            return;
          }
        } catch (err: unknown) {
          logger.error('Error renaming category:', err);
          const errMsg = err instanceof Error ? err.message : String(err);
          await ctx.reply(`⚠️ <b>Could not rename category:</b> ${errMsg}`, { parse_mode: 'HTML' });
          return;
        }
      }
      const kb = new InlineKeyboard().text('📁 View Categories', 'nav:cats');
      await ctx.reply('❌ <b>Category not found or session expired.</b> Please select a category from the list:', {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
      return;
    }

    // 2-rename-rule. In-Bot Rule Rename
    if (adminState?.state === 'RENAME_RULE' && rawText) {
      const ruleId = adminState.targetEntityId || adminState.activeMessageId;
      botSessionManager.clearAdminState(fromId);
      if (ruleId && Types.ObjectId.isValid(ruleId)) {
        try {
          const rule = await ForwardingRule.findById(ruleId);
          if (rule) {
            rule.name = rawText.trim();
            await rule.save();
            const { text, keyboard } = await BotKeyboardService.renderRuleDetails(rule);
            await ctx.reply(`✅ <b>Forwarding rule renamed!</b>\n\n${text}`, {
              parse_mode: 'HTML',
              reply_markup: keyboard,
            });
            return;
          }
        } catch (err: unknown) {
          logger.error('Error renaming rule:', err);
          const errMsg = err instanceof Error ? err.message : String(err);
          await ctx.reply(`⚠️ <b>Could not rename rule:</b> ${errMsg}`, { parse_mode: 'HTML' });
          return;
        }
      }
      const kb = new InlineKeyboard().text('⚡ View Rules', 'nav:rules');
      await ctx.reply('❌ <b>Rule not found or session expired.</b> Please select a rule from the list:', {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
      return;
    }

    // 2-sched-custom. In-Bot Custom Date & Time Schedule
    if (adminState?.state === 'SCHEDULE_CUSTOM_WAITING' && rawText) {
      const messageId = adminState.targetEntityId || adminState.activeMessageId;
      if (!messageId || !Types.ObjectId.isValid(messageId)) {
        await ctx.reply('❌ <b>Post no longer exists.</b>', { parse_mode: 'HTML' });
        botSessionManager.clearAdminState(fromId);
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        await ctx.reply('❌ <b>Post no longer exists.</b>', { parse_mode: 'HTML' });
        botSessionManager.clearAdminState(fromId);
        return;
      }

      const session = botSessionManager.getOrCreate(messageId);
      const tz = session.scheduleTimezone || 'Asia/Kolkata';

      const parsed = BotAdminService.parseCustomDateTimeInput(rawText, tz);
      if (!parsed || parsed.getTime() <= Date.now() + 60 * 1000) {
        await ctx.reply(
          `⚠️ <b>Invalid or Past Time!</b>\n\n` +
            `Please specify a timing at least 1 minute in the future.\n\n` +
            `📌 <b>Accepted Formats:</b>\n` +
            `• <code>tomorrow 15:30</code> <i>(Tomorrow at 3:30 PM)</i>\n` +
            `• <code>2026-09-29 18:00</code> <i>(Full Date & Time)</i>\n` +
            `• <code>19:45</code> <i>(Today at 7:45 PM)</i>\n` +
            `• <code>in 45 mins</code> or <code>45m</code> <i>(Relative delay)</i>\n` +
            `• <code>in 2 hours</code> or <code>2h</code>\n\n` +
            `🌐 Active Timezone: <code>${tz}</code>`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
              .text('← Back to Presets', `b:${messageId}:sch`)
              .text('❌ Cancel', `b:${messageId}:menu`),
          }
        );
        return;
      }

      botSessionManager.clearAdminState(fromId);
      const chosenDate = parsed.toLocaleDateString('en-CA', { timeZone: tz });
      const chosenTime = parsed.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: tz,
      });

      session.scheduleDate = chosenDate;
      session.scheduleTime = chosenTime;

      const resolved = await this.resolveSessionDestinations(session);
      botSessionManager.setAdminState(fromId, 'SCHEDULE_CONFIRM', messageId);
      const { text, keyboard } = await BotKeyboardService.renderScheduleConfirmation(
        message,
        session,
        resolved
      );
      await ctx.reply(
        `✅ <b>Custom Schedule Configured:</b> <code>${chosenDate} ${chosenTime} (${tz})</code>\n\n${text}`,
        {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        }
      );
      return;
    }

    // 2-post-buttons. In-Bot Inline URL Button Ingestion
    if (adminState?.state === 'EDIT_POST_BUTTONS' && rawText) {
      const messageId = adminState.targetEntityId || adminState.activeMessageId;
      if (!messageId || !Types.ObjectId.isValid(messageId)) {
        await ctx.reply('❌ <b>Post no longer exists.</b>', { parse_mode: 'HTML' });
        botSessionManager.clearAdminState(fromId);
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        await ctx.reply('❌ <b>Post no longer exists.</b>', { parse_mode: 'HTML' });
        botSessionManager.clearAdminState(fromId);
        return;
      }

      const session = botSessionManager.getOrCreate(messageId);
      const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
      const newButtons: Array<{ text: string; url: string }> = [];
      const invalidLines: string[] = [];

      for (const line of lines) {
        let btnText = '';
        let btnUrl = '';

        if (line.includes('|')) {
          const sep = line.indexOf('|');
          btnText = line.substring(0, sep).trim();
          btnUrl = line.substring(sep + 1).trim();
        } else if (line.includes(' - ')) {
          const sep = line.indexOf(' - ');
          btnText = line.substring(0, sep).trim();
          btnUrl = line.substring(sep + 3).trim();
        }

        if (btnText && btnUrl) {
          if (
            !btnUrl.startsWith('http://') &&
            !btnUrl.startsWith('https://') &&
            !btnUrl.startsWith('tg://')
          ) {
            btnUrl = `https://${btnUrl}`;
          }
          newButtons.push({ text: btnText, url: btnUrl });
        } else {
          invalidLines.push(line);
        }
      }

      if (newButtons.length === 0) {
        await ctx.reply(
          `⚠️ <b>Invalid Button Format</b>\n\n` +
            `Please specify buttons in <code>Button Text | https://link.com</code> format.\n\n` +
            `<b>Examples:</b>\n` +
            `• <code>Join Channel | https://t.me/example</code>\n` +
            `• <code>Official Website | https://google.com</code>`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
              .text('🔙 Back to Buttons Menu', `b:${messageId}:btn_menu`)
              .text('❌ Cancel', `b:${messageId}:menu`),
          }
        );
        return;
      }

      session.urlButtons = [...(session.urlButtons || []), ...newButtons];
      message.content.buttons = session.urlButtons.map((btn) => [{ text: btn.text, url: btn.url }]);
      await message.save();

      botSessionManager.clearAdminState(fromId);
      const { text, keyboard } = BotKeyboardService.renderPostButtonsMenu(message, session);
      await ctx.reply(
        `✅ <b>${newButtons.length} URL button(s) added!</b>` +
          (invalidLines.length > 0 ? `\n<i>(${invalidLines.length} line(s) ignored)</i>` : '') +
          `\n\n${text}`,
        {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        }
      );
      return;
    }

    // 2a. In-Bot Category Creation
    if (adminState?.state === 'ADD_CAT_WAITING' && rawText) {
      botSessionManager.clearAdminState(fromId);
      try {
        const cat = await CategoryService.create({ name: rawText });
        await ctx.reply(
          `✅ <b>CATEGORY CREATED SUCCESSFULLY!</b>\n\n` +
            `• <b>Name:</b> <b>${BotKeyboardService.escapeHtml(cat.name)}</b>\n` +
            `• <b>Slug:</b> <code>${cat.slug}</code>\n\n` +
            `<i>You can now organize your broadcasts into this category.</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
              .text('📁 View Categories', 'nav:cats')
              .text('✍️ Author Post', 'nav:new')
              .row()
              .text('⌂ Main Menu', 'nav:main'),
          }
        );
      } catch (err) {
        await ctx.reply(
          `❌ <b>Could not create category:</b> ${err instanceof Error ? err.message : 'Unknown error'}`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
              .text('🔄 Try Again', 'nav:add_cat')
              .text('❌ Cancel', 'nav:cats'),
          }
        );
      }
      return;
    }

    // 2b. In-Bot Channel / Destination Linking
    if (adminState?.state === 'ADD_DEST_WAITING') {
      let targetChatIdOrUsername: string | null = null;

      const rawAnyState = rawMsg as any;
      if (rawAnyState?.chat_shared?.chat_id) {
        targetChatIdOrUsername = String(rawAnyState.chat_shared.chat_id);
      } else if (rawAnyState?.chats_shared?.chat_ids?.[0]) {
        targetChatIdOrUsername = String(rawAnyState.chats_shared.chat_ids[0]);
      } else {
        const msgObj = ctx.message as unknown as {
          forward_from_chat?: { id: number | string; title?: string; username?: string };
          forward_origin?: {
            type: string;
            chat?: { id: number | string; title?: string; username?: string };
          };
        };
        const forwardChat = msgObj.forward_from_chat || msgObj.forward_origin?.chat;
        if (forwardChat) {
          targetChatIdOrUsername = String(forwardChat.id);
        } else if (rawText) {
          targetChatIdOrUsername = rawText;
        }
      }

      if (targetChatIdOrUsername) {
        await this.handleConnectDestinationChat(ctx, targetChatIdOrUsername, fromId);
        return;
      }
    }

    // Handle Media Albums
    if (rawMsg.media_group_id) {
      const { mediaItem } = IngestionService.extractMediaItem(rawMsg);
      if (mediaItem) {
        albumDebouncer.addAlbumItem(
          rawMsg.media_group_id,
          String(fromId),
          rawMsg.message_id,
          mediaItem,
          rawMsg.text || rawMsg.caption,
          rawMsg.entities || rawMsg.caption_entities
        );
        return;
      }
    }

    try {
      const { mediaItem, messageType } = IngestionService.extractMediaItem(rawMsg);
      const text = rawMsg.text || rawMsg.caption || '';
      const entities = rawMsg.entities || rawMsg.caption_entities || [];
      const mediaItems: MediaItem[] = mediaItem ? [mediaItem] : [];

      const content: MessageContent = {
        text,
        entities,
        mediaItems,
        mediaGroupId: rawMsg.media_group_id || null,
      };

      const message = await Message.create({
        sourceId: null,
        categoryId: null,
        telegramChatId: String(fromId),
        telegramMessageId: rawMsg.message_id,
        ...(rawMsg.media_group_id ? { mediaGroupId: rawMsg.media_group_id } : {}),
        messageType,
        content,
        status: 'draft',
        deliverySummary: {
          targetCount: 0,
          successfulDestinationIds: [],
          failedDestinationIds: [],
        },
        isEditedAtSource: false,
      });

      logger.info(`Admin ${admin.email} authored new post draft ${message._id} via Telegram Bot`);

      botSessionManager.clearAdminState(fromId);
      const session = botSessionManager.getOrCreate(message._id.toString());
      const { text: menuText, keyboard } = await BotKeyboardService.renderPostMenu(
        message,
        session
      );

      await ctx.reply(menuText, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (err) {
      logger.error('Failed to save admin post draft from Telegram message:', err);
      await ctx.reply('❌ <b>Could not save post.</b>\nPlease try again.', { parse_mode: 'HTML' });
    }
  }

  private static async handleFlushedAdminAlbum(
    mediaGroupId: string,
    batch: {
      telegramChatId: string;
      items: Array<{
        telegramMessageId: number;
        mediaItem: MediaItem;
        text?: string;
        entities?: unknown[];
      }>;
    }
  ): Promise<void> {
    const { telegramChatId, items } = batch;
    if (items.length === 0) return;

    try {
      const mediaItems: MediaItem[] = items.map((i) => i.mediaItem);
      const captionItem = items.find((i) => Boolean(i.text));
      const text = captionItem?.text || '';
      const entities = captionItem?.entities || [];

      const content: MessageContent = {
        text,
        entities,
        mediaItems,
        mediaGroupId,
      };

      const firstItem = items[0];
      const representativeMessageId = firstItem ? firstItem.telegramMessageId : undefined;

      const message = await Message.create({
        sourceId: null,
        categoryId: null,
        telegramChatId: String(telegramChatId),
        ...(representativeMessageId !== undefined
          ? { telegramMessageId: representativeMessageId }
          : {}),
        mediaGroupId,
        messageType: 'album',
        content,
        status: 'draft',
        deliverySummary: {
          targetCount: 0,
          successfulDestinationIds: [],
          failedDestinationIds: [],
        },
        isEditedAtSource: false,
      });

      logger.info(
        `Admin authored new album post ${message._id} (${items.length} items) via Telegram Bot`
      );

      const session = botSessionManager.getOrCreate(message._id.toString());
      const { text: menuText, keyboard } = await BotKeyboardService.renderPostMenu(
        message,
        session
      );

      const bot = getTelegramBot();
      await bot.api.sendMessage(telegramChatId, menuText, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (err) {
      logger.error(`Failed to save admin album draft ${mediaGroupId}:`, err);
    }
  }

  // ==========================================
  // CALLBACK QUERY ROUTER
  // ==========================================

  public static async handleCallbackQuery(ctx: Context): Promise<void> {
    const callbackData = ctx.callbackQuery?.data;
    const fromId = ctx.from?.id;
    if (!callbackData || !fromId) return;

    // 1. Authorize Admin
    const admin = await BotAdminAuthService.getAuthorizedAdmin(fromId);
    if (!admin) {
      await ctx.answerCallbackQuery({
        text: '⛔ Unauthorized: Admin access required',
        show_alert: true,
      });
      return;
    }

    // 2. Global Navigation System (nav:*)
    if (callbackData.startsWith('nav:')) {
      await ctx.answerCallbackQuery();
      botSessionManager.clearAdminState(fromId);
      const target = callbackData.slice(4);

      if (target === 'main') {
        const { text, keyboard } = await BotKeyboardService.renderDashboard(admin.name);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target === 'new') {
        botSessionManager.setAdminState(fromId, 'NEW_POST_WAITING');
        const { text, keyboard } = BotKeyboardService.renderNewPostWaiting();
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target === 'approvals') {
        botSessionManager.setAdminState(fromId, 'APPROVALS');
        const { text, keyboard } = await BotKeyboardService.renderPendingApprovals(1);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target.startsWith('appr:')) {
        const page = parseInt(target.slice(5), 10) || 1;
        botSessionManager.setAdminState(fromId, 'APPROVALS');
        const { text, keyboard } = await BotKeyboardService.renderPendingApprovals(page);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target === 'drafts') {
        botSessionManager.setAdminState(fromId, 'DRAFTS');
        const { text, keyboard } = await BotKeyboardService.renderDrafts();
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target === 'recent' || target === 'history' || target === 'logs') {
        botSessionManager.setAdminState(fromId, 'RECENT_POSTS');
        const { text, keyboard } = await BotKeyboardService.renderRecentPosts(1);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target.startsWith('recent_p:') || target.startsWith('history_p:')) {
        const page = parseInt(target.replace(/^(recent_p:|history_p:)/, ''), 10) || 1;
        botSessionManager.setAdminState(fromId, 'RECENT_POSTS');
        const { text, keyboard } = await BotKeyboardService.renderRecentPosts(page);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target === 'scheduled') {
        botSessionManager.setAdminState(fromId, 'SCHEDULED_POSTS');
        const { text, keyboard } = await BotKeyboardService.renderScheduledList(1);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target.startsWith('schp:')) {
        const page = parseInt(target.slice(5), 10) || 1;
        botSessionManager.setAdminState(fromId, 'SCHEDULED_POSTS');
        const { text, keyboard } = await BotKeyboardService.renderScheduledList(page);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target === 'dests') {
        botSessionManager.setAdminState(fromId, 'DESTINATION_LIST');
        const { text, keyboard } = await BotKeyboardService.renderDestinationList(1);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target.startsWith('dst:')) {
        const page = parseInt(target.slice(4), 10) || 1;
        const { text, keyboard } = await BotKeyboardService.renderDestinationList(page);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target === 'cats') {
        botSessionManager.setAdminState(fromId, 'CATEGORY_LIST');
        const { text, keyboard } = await BotKeyboardService.renderCategoryList();
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target === 'rules') {
        botSessionManager.setAdminState(fromId, 'RULES_LIST');
        const { text, keyboard } = await BotKeyboardService.renderRulesList(1);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target.startsWith('rlp:')) {
        const page = parseInt(target.slice(4), 10) || 1;
        botSessionManager.setAdminState(fromId, 'RULES_LIST');
        const { text, keyboard } = await BotKeyboardService.renderRulesList(page);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target === 'activity') {
        botSessionManager.setAdminState(fromId, 'ACTIVITY');
        const { text, keyboard } = await BotKeyboardService.renderActivity();
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target === 'settings') {
        botSessionManager.setAdminState(fromId, 'SETTINGS');
        const { text, keyboard } = BotKeyboardService.renderSettings();
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target === 'help') {
        botSessionManager.setAdminState(fromId, 'HELP');
        const { text, keyboard } = BotKeyboardService.renderHelp();
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target === 'toggle_dock') {
        await ctx.answerCallbackQuery({ text: '📱 Bottom quick dock opened!' });
        await ctx.reply(
          `⚡ <b>QUICK ACCESS DOCK ACTIVATED</b>\n\n` +
            `Persistent bottom buttons are now pinned beneath your chat input for fast one-tap navigation.\n\n` +
            `<i>Tap any option below to access that workspace instantly:</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: BotKeyboardService.getAdminBottomDock(),
          }
        );
        return;
      }

      if (target === 'hidedock' || target === 'hide_dock') {
        await this.handleHideDock(ctx);
        return;
      }

      if (target === 'add_dest') {
        await ctx.answerCallbackQuery();
        botSessionManager.setAdminState(fromId, 'ADD_DEST_WAITING');
        let botUsername = 'bot';
        try {
          const botInfo = await getTelegramBot().api.getMe();
          botUsername = botInfo.username || 'bot';
        } catch {
          // Fall back to default username if getMe fails
        }
        const { text, keyboard } = BotKeyboardService.renderAddDestinationPrompt(botUsername);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target === 'add_cat') {
        botSessionManager.setAdminState(fromId, 'ADD_CAT_WAITING');
        const { text, keyboard } = BotKeyboardService.renderAddCategoryPrompt();
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (target === 'add_rule') {
        botSessionManager.setAdminState(fromId, 'RULE_CREATOR_SOURCE');
        botSessionManager.getOrCreateRuleDraft(fromId);
        // Sync any active destinations into sources so user can pick their channel
        const allDests = await Destination.find({ status: { $ne: 'deleted' } });
        for (const d of allDests) {
          await Source.findOneAndUpdate(
            { telegramChatId: d.telegramChatId },
            {
              title: d.title,
              username: d.username,
              type: d.type === 'group' ? 'group' : 'channel',
              status: 'active',
            },
            { upsert: true }
          );
        }
        const sources = await Source.find({ status: 'active' });
        const { text, keyboard } = BotKeyboardService.renderRuleCreatorStep1(sources);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      return;
    }

    // 2b. Help Guides
    if (callbackData === 'help:admin_perms') {
      await ctx.answerCallbackQuery();
      const { text, keyboard } = BotKeyboardService.renderPermissionGuidePrompt();
      await this.sendOrEdit(ctx, text, keyboard);
      return;
    }

    // 3. Detail Views (v:*)
    if (callbackData.startsWith('v:')) {
      await ctx.answerCallbackQuery();
      botSessionManager.clearAdminState(fromId);
      const parts = callbackData.split(':');
      const viewType = parts[1];
      const targetId = parts[2];

      if (viewType === 'post' && targetId && Types.ObjectId.isValid(targetId)) {
        const post = await Message.findById(targetId);
        if (post) {
          const { text, keyboard } = await BotKeyboardService.renderPostDetails(post);
          await this.sendOrEdit(ctx, text, keyboard);
          return;
        }
      }

      if (viewType === 'dest' && targetId && Types.ObjectId.isValid(targetId)) {
        const dest = await Destination.findById(targetId);
        if (dest) {
          const { text, keyboard } = BotKeyboardService.renderDestinationDetails(dest);
          await this.sendOrEdit(ctx, text, keyboard);
          return;
        }
      }

      if (viewType === 'cat' && targetId && Types.ObjectId.isValid(targetId)) {
        const cat = await Category.findById(targetId);
        if (cat) {
          const { text, keyboard } = BotKeyboardService.renderCategoryDetails(cat);
          await this.sendOrEdit(ctx, text, keyboard);
          return;
        }
      }

      if (viewType === 'sch' && targetId && Types.ObjectId.isValid(targetId)) {
        const schedule = await ScheduledPost.findById(targetId);
        if (schedule) {
          const message = await Message.findById(schedule.messageId);
          if (message) {
            const dests = await Destination.find({ _id: { $in: schedule.destinationIds } });
            botSessionManager.setAdminState(fromId, 'SCHEDULE_DETAILS');
            const { text, keyboard } = await BotKeyboardService.renderScheduleDetails(
              schedule,
              message,
              dests
            );
            await this.sendOrEdit(ctx, text, keyboard);
            return;
          }
        }
      }

      const { text, keyboard } = BotKeyboardService.renderExpiredNotice();
      await this.sendOrEdit(ctx, text, keyboard);
      return;
    }

    // 4. Draft Operations (dr:*)
    if (callbackData.startsWith('dr:')) {
      const parts = callbackData.split(':');
      const action = parts[1];
      const msgId = parts[2];

      if (!msgId || !Types.ObjectId.isValid(msgId)) {
        await ctx.answerCallbackQuery({ text: 'Invalid draft ID' });
        return;
      }

      if (action === 'view') {
        await ctx.answerCallbackQuery();
        const draft = await Message.findById(msgId);
        if (!draft) {
          const { text, keyboard } = BotKeyboardService.renderExpiredNotice();
          await this.sendOrEdit(ctx, text, keyboard);
          return;
        }
        const { text, keyboard } = BotKeyboardService.renderDraftView(draft);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'open') {
        await ctx.answerCallbackQuery();
        const draft = await Message.findById(msgId);
        if (!draft) {
          const { text, keyboard } = BotKeyboardService.renderExpiredNotice();
          await this.sendOrEdit(ctx, text, keyboard);
          return;
        }
        const session = botSessionManager.getOrCreate(msgId, draft.categoryId?.toString());
        const { text, keyboard } = await BotKeyboardService.renderPostMenu(draft, session);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'del') {
        await ctx.answerCallbackQuery();
        const { text, keyboard } = BotKeyboardService.renderDraftDeleteConfirm(msgId);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'cdel') {
        await Message.deleteOne({ _id: msgId, status: 'draft' });
        botSessionManager.clear(msgId);
        await ctx.answerCallbackQuery({ text: 'Draft deleted' });
        const { text, keyboard } = await BotKeyboardService.renderDrafts();
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      return;
    }

    // 4a. Pending Approval Queue Actions (appr:*)
    if (callbackData.startsWith('appr:')) {
      const parts = callbackData.split(':');
      const action = parts[1];
      const msgId = parts[2];

      if (!msgId || !Types.ObjectId.isValid(msgId)) {
        await ctx.answerCallbackQuery({ text: 'Invalid message ID' });
        return;
      }

      if (action === 'view') {
        await ctx.answerCallbackQuery();
        const message = await Message.findById(msgId);
        if (!message) {
          const { text, keyboard } = BotKeyboardService.renderExpiredNotice();
          await this.sendOrEdit(ctx, text, keyboard);
          return;
        }
        const { text, keyboard } = await BotKeyboardService.renderPendingApprovalDetails(message);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'pub') {
        const message = await Message.findById(msgId);
        if (!message || message.status !== 'pending_approval') {
          await ctx.answerCallbackQuery({ text: 'Post is no longer awaiting approval' });
          const { text, keyboard } = await BotKeyboardService.renderPendingApprovals(1);
          await this.sendOrEdit(ctx, text, keyboard);
          return;
        }

        // Determine destination targets
        let targetDestIds: string[] = [];
        if (message.sourceId) {
          const resolvedTargets = await RuleEngineService.evaluateMessageRules(
            message.sourceId,
            message.categoryId
          );
          for (const t of resolvedTargets) {
            targetDestIds.push(...t.destinationIds);
          }
        }

        if (targetDestIds.length === 0) {
          const activeDests = await Destination.find({
            status: 'active',
            'verification.canPublish': true,
          });
          targetDestIds = activeDests.map((d) => d._id.toString());
        }

        if (targetDestIds.length === 0) {
          await ctx.answerCallbackQuery({
            text: 'No verified active destinations found to broadcast to',
            show_alert: true,
          });
          return;
        }

        await ctx.answerCallbackQuery({ text: 'Publishing broadcast...' });

        try {
          const publishResult = await PublishService.publishAutomated({
            messageId: msgId,
            destinationIds: Array.from(new Set(targetDestIds)),
            publishMode: 'copy',
          });

          await ctx.reply(
            `✅ <b>Post Approved & Published!</b>\n\n` +
              `• Status: <b>${publishResult.aggregateStatus.toUpperCase()}</b>\n` +
              `• Delivered: <b>${publishResult.successfulCount}</b> destination(s)\n` +
              `• Failed: <b>${publishResult.failedCount}</b>\n\n` +
              `<i>Post removed from approval queue.</i>`,
            { parse_mode: 'HTML' }
          );

          const { text, keyboard } = await BotKeyboardService.renderPendingApprovals(1);
          await this.sendOrEdit(ctx, text, keyboard);
        } catch (pubErr) {
          logger.error(`Error publishing approved message ${msgId}:`, pubErr);
          await ctx.reply(
            `❌ <b>Publishing Error:</b> ${pubErr instanceof Error ? pubErr.message : 'Unknown error'}`,
            { parse_mode: 'HTML' }
          );
        }
        return;
      }

      if (action === 'rej') {
        const message = await Message.findById(msgId);
        if (message) {
          message.status = 'draft';
          await message.save();
        }
        await ctx.answerCallbackQuery({ text: 'Post dismissed from approval queue' });
        const { text, keyboard } = await BotKeyboardService.renderPendingApprovals(1);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      return;
    }

    // 4b. Scheduled Post Actions (sch_act:<schId>:<action>)
    if (callbackData.startsWith('sch_act:')) {
      const parts = callbackData.split(':');
      const schId = parts[1];
      const action = parts[2];

      if (!schId || !Types.ObjectId.isValid(schId)) {
        await ctx.answerCallbackQuery({ text: 'Invalid schedule ID' });
        return;
      }

      const schedule = await ScheduledPost.findById(schId);
      if (!schedule) {
        await ctx.answerCallbackQuery({ text: 'Schedule no longer exists' });
        const { text, keyboard } = await BotKeyboardService.renderScheduledList(1);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      const message = await Message.findById(schedule.messageId);
      if (!message) {
        await ctx.answerCallbackQuery({ text: 'Post no longer exists' });
        const { text, keyboard } = await BotKeyboardService.renderScheduledList(1);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'cancel_confirm') {
        await ctx.answerCallbackQuery();
        const { text, keyboard } = BotKeyboardService.renderCancelScheduleConfirm(
          schedule,
          message
        );
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'cancel_do') {
        await ScheduleService.cancelSchedule(schId, admin._id.toString());
        await ctx.answerCallbackQuery({ text: 'Schedule cancelled' });
        const { text, keyboard } = await BotKeyboardService.renderScheduledList(1);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'pub_now') {
        await ctx.answerCallbackQuery({ text: '🚀 Publishing now...' });
        await ScheduleService.publishNow(schId, admin._id.toString());
        const dests = await Destination.find({ _id: { $in: schedule.destinationIds } });
        const updated = await ScheduledPost.findById(schId);
        const { text, keyboard } = await BotKeyboardService.renderScheduleDetails(
          updated || schedule,
          message,
          dests
        );
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'resched') {
        await ctx.answerCallbackQuery();
        const session = botSessionManager.getOrCreate(
          schedule.messageId.toString(),
          schedule.categoryId?.toString()
        );
        session.scheduleTimezone = schedule.timezone || 'Asia/Kolkata';
        for (const dId of schedule.destinationIds) {
          session.selectedDestinationIds.add(dId.toString());
        }
        await ScheduleService.cancelSchedule(schId, admin._id.toString());
        botSessionManager.setAdminState(fromId, 'SCHEDULE_DATE', schedule.messageId.toString());
        const { text, keyboard } = BotKeyboardService.renderScheduleDatePicker(message, session);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      return;
    }

    // 4c. Forwarding Rule Actions (rule:<action>:<ruleId>)
    if (callbackData.startsWith('rule:')) {
      const parts = callbackData.split(':');
      const action = parts[1];
      const ruleId = parts[2];

      if (!ruleId || !Types.ObjectId.isValid(ruleId)) {
        await ctx.answerCallbackQuery({ text: 'Invalid rule ID' });
        return;
      }

      const rule = await ForwardingRule.findById(ruleId);
      if (!rule) {
        await ctx.answerCallbackQuery({ text: 'Rule no longer exists' });
        const { text, keyboard } = await BotKeyboardService.renderRulesList(1);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'v') {
        await ctx.answerCallbackQuery();
        botSessionManager.setAdminState(fromId, 'RULE_DETAILS');
        const { text, keyboard } = await BotKeyboardService.renderRuleDetails(rule);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 't') {
        rule.isActive = !rule.isActive;
        await rule.save();
        await ctx.answerCallbackQuery({
          text: rule.isActive ? '🟢 Rule activated!' : '⏸️ Rule paused!',
        });
        const { text, keyboard } = await BotKeyboardService.renderRuleDetails(rule);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'm') {
        rule.publishMode = rule.publishMode === 'forward' ? 'copy' : 'forward';
        await rule.save();
        await ctx.answerCallbackQuery({ text: `Mode: ${rule.publishMode.toUpperCase()}` });
        const { text, keyboard } = await BotKeyboardService.renderRuleDetails(rule);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'w') {
        rule.workflowType = rule.workflowType === 'automatic' ? 'manual_approval' : 'automatic';
        await rule.save();
        await ctx.answerCallbackQuery({
          text: rule.workflowType === 'automatic' ? '⚡ Instant Auto' : '🛡️ Hold for Approval',
        });
        const { text, keyboard } = await BotKeyboardService.renderRuleDetails(rule);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'd_ask') {
        await ctx.answerCallbackQuery();
        const { text, keyboard } = BotKeyboardService.renderConfirmDeleteRule(rule);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'd_do') {
        await ForwardingRule.deleteOne({ _id: ruleId });
        await ctx.answerCallbackQuery({ text: '🗑 Rule deleted' });
        const { text, keyboard } = await BotKeyboardService.renderRulesList(1);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'rename') {
        await ctx.answerCallbackQuery();
        botSessionManager.setAdminState(fromId, 'RENAME_RULE', null, ruleId);
        const { text, keyboard } = BotKeyboardService.renderRenameRulePrompt(rule);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'edest') {
        await ctx.answerCallbackQuery();
        let ruleDestFilter: any = {
          status: 'active',
          'verification.canPublish': true,
        };
        if (rule.sourceId) {
          const src = await Source.findById(rule.sourceId);
          if (src?.telegramChatId) {
            ruleDestFilter.telegramChatId = { $ne: src.telegramChatId };
          }
        }
        const allDests = await Destination.find(ruleDestFilter);
        const { text, keyboard } = BotKeyboardService.renderRuleEditDests(rule, allDests);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'td') {
        const destId = parts[3];
        if (destId && Types.ObjectId.isValid(destId)) {
          const destObjId = new Types.ObjectId(destId);
          if (!rule.destinationIds) rule.destinationIds = [];
          const existingIdx = rule.destinationIds.findIndex((d) => d.toString() === destId);
          if (existingIdx >= 0) {
            rule.destinationIds.splice(existingIdx, 1);
          } else {
            rule.destinationIds.push(destObjId);
          }
          await rule.save();
          await ctx.answerCallbackQuery();

          let ruleDestFilter: any = {
            status: 'active',
            'verification.canPublish': true,
          };
          if (rule.sourceId) {
            const src = await Source.findById(rule.sourceId);
            if (src?.telegramChatId) {
              ruleDestFilter.telegramChatId = { $ne: src.telegramChatId };
            }
          }
          const allDests = await Destination.find(ruleDestFilter);
          const { text, keyboard } = BotKeyboardService.renderRuleEditDests(rule, allDests);
          await this.sendOrEdit(ctx, text, keyboard);
          return;
        }
      }

      return;
    }

    // 4d. Destination Actions (dest:*)
    if (callbackData.startsWith('dest:')) {
      const parts = callbackData.split(':');
      const action = parts[1];
      const destId = parts[2];

      if (action === 'vfy_all') {
        await ctx.answerCallbackQuery({ text: '🔄 Verifying all destinations...' });
        const allDests = await Destination.find();
        for (const d of allDests) {
          try {
            await DestinationService.verify(d._id.toString());
          } catch {
            // Destination might be temporarily inaccessible
          }
        }
        const { text, keyboard } = await BotKeyboardService.renderDestinationList(1);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (!destId || !Types.ObjectId.isValid(destId)) {
        await ctx.answerCallbackQuery({ text: 'Invalid destination ID' });
        return;
      }

      if (action === 'vfy') {
        try {
          await DestinationService.verify(destId);
          await ctx.answerCallbackQuery({ text: '🟢 Permissions verified!' });
        } catch {
          await ctx.answerCallbackQuery({ text: '⚠️ Verification probe failed' });
        }
        const updatedDest = await Destination.findById(destId);
        if (updatedDest) {
          const { text, keyboard } = BotKeyboardService.renderDestinationDetails(updatedDest);
          await this.sendOrEdit(ctx, text, keyboard);
        }
        return;
      }

      if (action === 'rename') {
        await ctx.answerCallbackQuery();
        const targetDest = await Destination.findById(destId);
        if (targetDest) {
          botSessionManager.setAdminState(fromId, 'RENAME_DEST', null, destId);
          const { text, keyboard } = BotKeyboardService.renderRenameDestinationPrompt(targetDest);
          await this.sendOrEdit(ctx, text, keyboard);
        }
        return;
      }

      if (action === 'del_ask') {
        await ctx.answerCallbackQuery();
        const targetDest = await Destination.findById(destId);
        if (targetDest) {
          const { text, keyboard } = BotKeyboardService.renderConfirmDeleteDestination(targetDest);
          await this.sendOrEdit(ctx, text, keyboard);
        }
        return;
      }

      if (action === 'del_do') {
        await DestinationService.delete(destId);
        await ctx.answerCallbackQuery({ text: '🗑 Destination disconnected' });
        const { text, keyboard } = await BotKeyboardService.renderDestinationList(1);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      return;
    }

    // 4e. Category Actions (cat:*)
    if (callbackData.startsWith('cat:')) {
      const parts = callbackData.split(':');
      const action = parts[1];
      const catId = parts[2];

      if (!catId || !Types.ObjectId.isValid(catId)) {
        await ctx.answerCallbackQuery({ text: 'Invalid category ID' });
        return;
      }

      if (action === 'rename') {
        await ctx.answerCallbackQuery();
        const targetCat = await Category.findById(catId);
        if (targetCat) {
          botSessionManager.setAdminState(fromId, 'RENAME_CAT', null, catId);
          const { text, keyboard } = BotKeyboardService.renderRenameCategoryPrompt(targetCat);
          await this.sendOrEdit(ctx, text, keyboard);
        }
        return;
      }

      if (action === 'del_ask') {
        await ctx.answerCallbackQuery();
        const targetCat = await Category.findById(catId);
        if (targetCat) {
          const { text, keyboard } = BotKeyboardService.renderConfirmDeleteCategory(targetCat);
          await this.sendOrEdit(ctx, text, keyboard);
        }
        return;
      }

      if (action === 'edest') {
        await ctx.answerCallbackQuery();
        const targetCat = await Category.findById(catId);
        if (targetCat) {
          const allDests = await Destination.find({
            status: 'active',
            'verification.canPublish': true,
          });
          const { text, keyboard } = BotKeyboardService.renderCategoryEditDests(targetCat, allDests);
          await this.sendOrEdit(ctx, text, keyboard);
        }
        return;
      }

      if (action === 'td') {
        const destId = parts[3];
        const targetCat = await Category.findById(catId);
        if (targetCat && destId && Types.ObjectId.isValid(destId)) {
          const curDests: any[] = (targetCat as any).destinationIds || [];
          const idx = curDests.findIndex((id) => id.toString() === destId);
          if (idx >= 0) {
            curDests.splice(idx, 1);
          } else {
            curDests.push(new Types.ObjectId(destId));
          }
          (targetCat as any).destinationIds = curDests;
          await targetCat.save();

          await ctx.answerCallbackQuery();
          const allDests = await Destination.find({
            status: 'active',
            'verification.canPublish': true,
          });
          const { text, keyboard } = BotKeyboardService.renderCategoryEditDests(targetCat, allDests);
          await this.sendOrEdit(ctx, text, keyboard);
        }
        return;
      }

      if (action === 'del_do') {
        await CategoryService.delete(catId);
        await ctx.answerCallbackQuery({ text: '🗑 Category deleted' });
        const { text, keyboard } = await BotKeyboardService.renderCategoryList();
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      return;
    }

    // 4e2. Post Record Actions (post:*)
    if (callbackData.startsWith('post:')) {
      const parts = callbackData.split(':');
      const action = parts[1];
      const postId = parts[2];

      if (!postId || !Types.ObjectId.isValid(postId)) {
        await ctx.answerCallbackQuery({ text: 'Invalid post ID' });
        return;
      }

      if (action === 'del_ask') {
        await ctx.answerCallbackQuery();
        const post = await Message.findById(postId);
        if (post) {
          const { text, keyboard } = BotKeyboardService.renderConfirmDeletePost(post);
          await this.sendOrEdit(ctx, text, keyboard);
        }
        return;
      }

      if (action === 'del_do') {
        await Message.deleteOne({ _id: postId });
        await ctx.answerCallbackQuery({ text: '🗑 Post deleted from history' });
        const { text, keyboard } = await BotKeyboardService.renderRecentPosts(1);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      return;
    }

    // 4f. In-Bot Rule Creator Wizard (rc:*)
    if (callbackData.startsWith('rc:')) {
      const parts = callbackData.split(':');
      const action = parts[1];
      const arg = parts[2];
      const draft = botSessionManager.getOrCreateRuleDraft(fromId);

      if (action === 'src') {
        if (arg === 'all') {
          draft.sourceId = null;
          draft.sourceChatId = undefined;
          draft.sourceTitle = 'All Monitored Sources';
        } else if (arg && Types.ObjectId.isValid(arg)) {
          const src = await Source.findById(arg);
          if (src) {
            draft.sourceId = src._id.toString();
            draft.sourceChatId = src.telegramChatId;
            draft.sourceTitle = src.title;

            // Prevent self-routing loop by removing matching destination from selections
            const matchingDest = await Destination.findOne({ telegramChatId: src.telegramChatId });
            if (matchingDest) {
              draft.destinationIds.delete(matchingDest._id.toString());
            }
          }
        }
        await ctx.answerCallbackQuery({ text: `Source: ${draft.sourceTitle || 'All'}` });
        botSessionManager.setAdminState(fromId, 'RULE_CREATOR_DESTS');
        const destFilter: any = { status: { $ne: 'deleted' } };
        if (draft.sourceChatId) {
          destFilter.telegramChatId = { $ne: draft.sourceChatId };
        }
        const dests = await Destination.find(destFilter);
        const { text, keyboard } = BotKeyboardService.renderRuleCreatorStep2(
          dests,
          draft.destinationIds
        );
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'td' && arg) {
        if (draft.destinationIds.has(arg)) {
          draft.destinationIds.delete(arg);
        } else {
          draft.destinationIds.add(arg);
        }
        await ctx.answerCallbackQuery();
        const destFilter: any = { status: { $ne: 'deleted' } };
        if (draft.sourceChatId) {
          destFilter.telegramChatId = { $ne: draft.sourceChatId };
        }
        const dests = await Destination.find(destFilter);
        const { text, keyboard } = BotKeyboardService.renderRuleCreatorStep2(
          dests,
          draft.destinationIds
        );
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'to_step1') {
        await ctx.answerCallbackQuery();
        botSessionManager.setAdminState(fromId, 'RULE_CREATOR_SOURCE');
        const sources = await Source.find({ status: 'active' });
        const { text, keyboard } = BotKeyboardService.renderRuleCreatorStep1(sources);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'to_step2') {
        await ctx.answerCallbackQuery();
        botSessionManager.setAdminState(fromId, 'RULE_CREATOR_DESTS');
        const destFilter: any = { status: { $ne: 'deleted' } };
        if (draft.sourceChatId) {
          destFilter.telegramChatId = { $ne: draft.sourceChatId };
        }
        const dests = await Destination.find(destFilter);
        const { text, keyboard } = BotKeyboardService.renderRuleCreatorStep2(
          dests,
          draft.destinationIds
        );
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'to_step3') {
        if (draft.destinationIds.size === 0) {
          await ctx.answerCallbackQuery({
            text: '⚠️ Please select at least one target channel or group to forward to!',
            show_alert: true,
          });
          return;
        }
        await ctx.answerCallbackQuery();
        botSessionManager.setAdminState(fromId, 'RULE_CREATOR_MODE');
        const { text, keyboard } = BotKeyboardService.renderRuleCreatorStep3(draft);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 't_mode') {
        draft.publishMode = draft.publishMode === 'forward' ? 'copy' : 'forward';
        await ctx.answerCallbackQuery({ text: `Mode: ${draft.publishMode.toUpperCase()}` });
        const { text, keyboard } = BotKeyboardService.renderRuleCreatorStep3(draft);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 't_wf') {
        draft.workflowType = draft.workflowType === 'automatic' ? 'manual_approval' : 'automatic';
        await ctx.answerCallbackQuery({
          text: draft.workflowType === 'automatic' ? '⚡ Instant Auto' : '🛡️ Hold for Approval',
        });
        const { text, keyboard } = BotKeyboardService.renderRuleCreatorStep3(draft);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      if (action === 'save') {
        if (draft.destinationIds.size === 0) {
          await ctx.answerCallbackQuery({
            text: '⚠️ Please select at least one target channel or group to forward to!',
            show_alert: true,
          });
          return;
        }

        const sourceTitle = draft.sourceTitle || 'All Sources';
        const ruleName = `${sourceTitle} ➔ ${draft.destinationIds.size} Targets`;

        const newRule = await ForwardingRule.create({
          name: ruleName,
          sourceId: draft.sourceId ? new Types.ObjectId(draft.sourceId) : null,
          destinationIds: Array.from(draft.destinationIds).map((id) => new Types.ObjectId(id)),
          destinationGroupIds: [],
          categoryId: null,
          publishMode: draft.publishMode,
          workflowType: draft.workflowType,
          isActive: true,
          priority: 0,
        });

        botSessionManager.clearRuleDraft(fromId);
        botSessionManager.setAdminState(fromId, 'RULE_DETAILS');
        await ctx.answerCallbackQuery({ text: '🟢 Automation Rule created & active!' });
        const { text, keyboard } = await BotKeyboardService.renderRuleDetails(newRule);
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }

      return;
    }

    // 5. Legacy cmd:* compatibility
    if (callbackData.startsWith('cmd:')) {
      const cmd = callbackData.slice(4);
      await ctx.answerCallbackQuery();
      switch (cmd) {
        case 'new':
          await this.handleNew(ctx);
          break;
        case 'posts':
          await this.handleRecent(ctx);
          break;
        case 'destinations':
          await this.handleDestinations(ctx);
          break;
        case 'categories':
          await this.handleCategories(ctx);
          break;
      }
      return;
    }

    // 6. Post Wizard Callbacks (b:<messageId>:<action>[:<arg>])
    if (!callbackData.startsWith('b:')) return;

    const parts = callbackData.split(':');
    if (parts.length < 3) return;

    const messageId = parts[1];
    const action = parts[2];
    const arg = parts[3];

    if (!messageId || !action) return;

    if (!Types.ObjectId.isValid(messageId)) {
      await ctx.answerCallbackQuery({ text: 'Invalid post ID' });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      await ctx.answerCallbackQuery({
        text: 'This post is no longer available.',
        show_alert: true,
      });
      const { text, keyboard } = BotKeyboardService.renderExpiredNotice();
      await this.sendOrEdit(ctx, text, keyboard);
      return;
    }

    if (action === 'retry') {
      await ctx.answerCallbackQuery({ text: '🔁 Retrying failed destinations...' });
      const retryResult = await PublishService.retryFailed(messageId, admin._id.toString());

      const dests = await Destination.find();
      const destMap = new Map<string, { title: string; telegramChatId: string }>();
      for (const d of dests) {
        destMap.set(d._id.toString(), { title: d.title, telegramChatId: d.telegramChatId });
      }

      const { text, keyboard } = BotKeyboardService.renderPublishResult(
        message,
        {
          aggregateStatus: retryResult.aggregateStatus,
          targetCount: retryResult.logs.length,
          successfulCount: retryResult.newlySuccessfulCount,
          failedCount: retryResult.stillFailedCount,
          logs: retryResult.logs,
        },
        destMap
      );
      await this.sendOrEdit(ctx, text, keyboard);
      return;
    }

    if (action === 'close') {
      await ctx.answerCallbackQuery();
      botSessionManager.clear(messageId);
      await this.handleStart(ctx);
      return;
    }

    let session = botSessionManager.get(messageId);
    if (!session) {
      if (message.status === 'draft') {
        session = botSessionManager.getOrCreate(messageId, message.categoryId?.toString());
      } else {
        await ctx.answerCallbackQuery({
          text: 'This action has expired.',
          show_alert: true,
        });
        const { text, keyboard } = BotKeyboardService.renderExpiredNotice();
        await this.sendOrEdit(ctx, text, keyboard);
        return;
      }
    }

    try {
      switch (action) {
        case 'menu': {
          await ctx.answerCallbackQuery();
          botSessionManager.clearAdminState(fromId);
          botSessionManager.setAdminState(fromId, 'POST_EDITOR', messageId);
          const { text, keyboard } = await BotKeyboardService.renderPostMenu(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'edit_text': {
          await ctx.answerCallbackQuery();
          botSessionManager.setAdminState(fromId, 'EDIT_POST_TEXT', messageId);
          const { text, keyboard } = BotKeyboardService.renderEditTextPrompt(message);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'del_draft': {
          await Message.deleteOne({ _id: messageId, status: 'draft' });
          botSessionManager.clear(messageId);
          await ctx.answerCallbackQuery({ text: '🗑 Draft deleted' });
          const { text, keyboard } = await BotKeyboardService.renderDrafts();
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'preview': {
          await ctx.answerCallbackQuery();
          const { text, keyboard } = await BotKeyboardService.renderPreview(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'btn_menu': {
          await ctx.answerCallbackQuery();
          botSessionManager.setAdminState(fromId, 'EDIT_POST_BUTTONS', messageId);
          const { text, keyboard } = BotKeyboardService.renderPostButtonsMenu(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'btn_add': {
          await ctx.answerCallbackQuery();
          botSessionManager.setAdminState(fromId, 'EDIT_POST_BUTTONS', messageId);
          await ctx.reply(
            `➕ <b>ADD INLINE URL BUTTONS</b>\n\n` +
              `Type and send your button name and URL separated by <code>|</code>:\n\n` +
              `<code>Button Text | https://yourlink.com</code>\n\n` +
              `<i>You can also send multiple lines for multiple buttons:</i>\n` +
              `<code>Join Channel | https://t.me/yourchannel\nWebsite | https://example.com</code>`,
            {
              parse_mode: 'HTML',
              reply_markup: new InlineKeyboard()
                .text('🔙 Back to Buttons Menu', `b:${messageId}:btn_menu`)
                .text('❌ Cancel', `b:${messageId}:menu`),
            }
          );
          break;
        }

        case 'btn_clear': {
          session.urlButtons = [];
          if (message.content) {
            message.content.buttons = [];
            await message.save();
          }
          await ctx.answerCallbackQuery({ text: '🗑 All buttons cleared' });
          const { text, keyboard } = BotKeyboardService.renderPostButtonsMenu(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 't_silent': {
          session.silentPublish = !session.silentPublish;
          await ctx.answerCallbackQuery({
            text: session.silentPublish ? '🔕 Silent Notification: ON' : '🔔 Notification Sound: ON',
          });
          const { text, keyboard } = await BotKeyboardService.renderPostMenu(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 't_pin': {
          session.pinOnPublish = !session.pinOnPublish;
          await ctx.answerCallbackQuery({
            text: session.pinOnPublish ? '📌 Pin on Publish: ON' : '📌 Pin on Publish: OFF',
          });
          const { text, keyboard } = await BotKeyboardService.renderPostMenu(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 't_prev': {
          session.disableWebPreview = !session.disableWebPreview;
          await ctx.answerCallbackQuery({
            text: session.disableWebPreview ? '🌐 Web Link Preview: OFF' : '🌐 Web Link Preview: ON',
          });
          const { text, keyboard } = await BotKeyboardService.renderPostMenu(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'view_cats': {
          await ctx.answerCallbackQuery();
          const { text, keyboard } = await BotKeyboardService.renderCategorySelector(
            message,
            session
          );
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'sc': {
          session.selectedCategoryIds = session.selectedCategoryIds || new Set<string>();

          if (!arg || arg === 'none') {
            session.selectedCategoryIds.clear();
            session.categoryId = null;
            message.categoryId = null;
            await message.save();
            await ctx.answerCallbackQuery({ text: 'All categories cleared' });
            const { text, keyboard } = await BotKeyboardService.renderCategorySelector(
              message,
              session
            );
            await this.sendOrEdit(ctx, text, keyboard);
            break;
          }

          const catId = arg;
          let toast = '';
          if (session.selectedCategoryIds.has(catId)) {
            session.selectedCategoryIds.delete(catId);
            toast = '◻️ Category unselected';
          } else {
            session.selectedCategoryIds.add(catId);
            let autoLinked = 0;
            const cat = await Category.findById(catId);
            if (cat && (cat as any).destinationIds?.length > 0) {
              for (const dId of (cat as any).destinationIds) {
                session.selectedDestinationIds.add(dId.toString());
                autoLinked++;
              }
            } else if (cat) {
              const matchedGroup = await DestinationGroup.findOne({
                name: { $regex: new RegExp(`^${cat.name}$`, 'i') },
                status: 'active',
              });
              if (matchedGroup && matchedGroup.destinationIds?.length > 0) {
                session.selectedGroupIds.add(matchedGroup._id.toString());
                for (const dId of matchedGroup.destinationIds) {
                  session.selectedDestinationIds.add(dId.toString());
                  autoLinked++;
                }
              }
            }
            toast =
              autoLinked > 0
                ? `✅ Category added (+${autoLinked} channels linked)`
                : '✅ Category selected';
          }

          const firstCatId = Array.from(session.selectedCategoryIds)[0] || null;
          session.categoryId = firstCatId;
          message.categoryId = firstCatId ? new Types.ObjectId(firstCatId) : null;
          await message.save();

          await ctx.answerCallbackQuery({ text: toast });
          const { text, keyboard } = await BotKeyboardService.renderCategorySelector(
            message,
            session
          );
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'view_dests': {
          await ctx.answerCallbackQuery();
          const { text, keyboard } = await BotKeyboardService.renderDestinationSelector(
            message,
            session
          );
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'td': {
          if (arg) {
            if (session.selectedDestinationIds.has(arg)) {
              session.selectedDestinationIds.delete(arg);
            } else {
              session.selectedDestinationIds.add(arg);
            }
          }
          await ctx.answerCallbackQuery();
          const { text, keyboard } = await BotKeyboardService.renderDestinationSelector(
            message,
            session
          );
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'tg': {
          if (arg) {
            if (session.selectedGroupIds.has(arg)) {
              session.selectedGroupIds.delete(arg);
            } else {
              session.selectedGroupIds.add(arg);
            }
          }
          await ctx.answerCallbackQuery();
          const { text, keyboard } = await BotKeyboardService.renderDestinationSelector(
            message,
            session
          );
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'dp': {
          if (arg) {
            session.destPage = parseInt(arg, 10) || 1;
          }
          await ctx.answerCallbackQuery();
          const { text, keyboard } = await BotKeyboardService.renderDestinationSelector(
            message,
            session
          );
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'd_all': {
          const verifiedDests = await Destination.find({
            status: 'active',
            'verification.canPublish': true,
          });
          for (const d of verifiedDests) {
            session.selectedDestinationIds.add(d._id.toString());
          }
          await ctx.answerCallbackQuery({ text: 'All verified destinations selected' });
          const { text, keyboard } = await BotKeyboardService.renderDestinationSelector(
            message,
            session
          );
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'd_clr': {
          session.selectedDestinationIds.clear();
          session.selectedGroupIds.clear();
          await ctx.answerCallbackQuery({ text: 'Selections cleared' });
          const { text, keyboard } = await BotKeyboardService.renderDestinationSelector(
            message,
            session
          );
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'toggle_mode': {
          session.publishMode = session.publishMode === 'forward' ? 'copy' : 'forward';
          const modeNotification =
            session.publishMode === 'copy'
              ? '📤 Mode: Copy (Clean post without source attribution)'
              : '↪️ Mode: Forward (Preserves Telegram forward attribution)';
          await ctx.answerCallbackQuery({ text: modeNotification });
          const { text, keyboard } = await BotKeyboardService.renderPostMenu(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'req_pub': {
          if (session.selectedDestinationIds.size === 0 && session.selectedGroupIds.size === 0) {
            await ctx.answerCallbackQuery({
              text: '⚠️ No target channels selected! Please choose at least one channel or category first.',
              show_alert: true,
            });
            return;
          }

          const resolved = await this.resolveSessionDestinations(session);
          if (resolved.length === 0) {
            await ctx.answerCallbackQuery({
              text: '⚠️ None of the selected channels are currently verified for publishing. Check bot admin rights.',
              show_alert: true,
            });
            return;
          }

          await ctx.answerCallbackQuery();
          const { text, keyboard } = await BotKeyboardService.renderPublishConfirmation(
            message,
            session,
            resolved
          );
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'confirm_pub': {
          if (session.isPublishing) {
            await ctx.answerCallbackQuery({
              text: 'Posting is already in progress...',
              show_alert: true,
            });
            return;
          }

          const freshMessage = await Message.findById(messageId);
          if (freshMessage?.status === 'published' || freshMessage?.status === 'publishing') {
            await ctx.answerCallbackQuery({
              text: 'This post is already published or in progress',
              show_alert: true,
            });
            return;
          }

          session.isPublishing = true;
          await ctx.answerCallbackQuery({ text: '🚀 Posting to channels...' });

          // Persist URL buttons and broadcast options to Message document before dispatch
          if (freshMessage) {
            freshMessage.content.buttons = (session.urlButtons || []).map((btn) => [
              { text: btn.text, url: btn.url },
            ]);
            freshMessage.silentPublish = session.silentPublish;
            freshMessage.pinOnPublish = session.pinOnPublish;
            freshMessage.disableWebPreview = session.disableWebPreview;
            await freshMessage.save();
          }

          const resolved = await this.resolveSessionDestinations(session);
          const destinationIds = resolved.map((r) => r.id);

          const destinationMap = new Map<string, { title: string; telegramChatId: string }>();
          for (const r of resolved) {
            destinationMap.set(r.id, { title: r.title, telegramChatId: r.telegramChatId });
          }

          const publishResult = await PublishService.publishManual({
            messageId,
            destinationIds,
            publishMode: session.publishMode,
            userId: admin._id.toString(),
          });

          session.isPublishing = false;
          botSessionManager.clear(messageId);

          const { text, keyboard } = BotKeyboardService.renderPublishResult(
            message,
            publishResult,
            destinationMap
          );
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'sch': {
          await ctx.answerCallbackQuery();
          session.scheduleTimezone = session.scheduleTimezone || 'Asia/Kolkata';
          botSessionManager.setAdminState(fromId, 'SCHEDULE_TIME_ADJUSTER', messageId);
          const { text, keyboard } = BotKeyboardService.renderScheduleTimeAdjuster(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'sch_adjust': {
          await ctx.answerCallbackQuery();
          session.scheduleTimezone = session.scheduleTimezone || 'Asia/Kolkata';
          botSessionManager.setAdminState(fromId, 'SCHEDULE_TIME_ADJUSTER', messageId);
          const { text, keyboard } = BotKeyboardService.renderScheduleTimeAdjuster(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'adj_d': {
          const tz = session.scheduleTimezone || 'Asia/Kolkata';
          const delta = parseInt(arg || '0', 10);
          const todayStr = BotKeyboardService.getLocalDateString(0, tz);

          if (delta === 0) {
            session.scheduleDate = todayStr;
          } else {
            const curDate = session.scheduleDate || todayStr;
            const parts = curDate.split('-').map((v) => parseInt(v, 10));
            const y = parts[0] ?? 2026;
            const m = parts[1] ?? 1;
            const d = parts[2] ?? 1;
            const dateObj = new Date(Date.UTC(y, m - 1, d + delta));
            const newDateStr = dateObj.toISOString().slice(0, 10);
            if (newDateStr >= todayStr) {
              session.scheduleDate = newDateStr;
            } else {
              session.scheduleDate = todayStr;
            }
          }

          await ctx.answerCallbackQuery({ text: `Date: ${session.scheduleDate}` });
          const { text, keyboard } = BotKeyboardService.renderScheduleTimeAdjuster(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'sd_adj': {
          const tz = session.scheduleTimezone || 'Asia/Kolkata';
          const delta = parseInt(arg || '0', 10);
          const todayStr = BotKeyboardService.getLocalDateString(0, tz);

          if (delta === 0) {
            session.scheduleDate = todayStr;
          } else {
            const curDate = session.scheduleDate || todayStr;
            const parts = curDate.split('-').map((v) => parseInt(v, 10));
            const y = parts[0] ?? 2026;
            const m = parts[1] ?? 1;
            const d = parts[2] ?? 1;
            const dateObj = new Date(Date.UTC(y, m - 1, d + delta));
            const newDateStr = dateObj.toISOString().slice(0, 10);
            if (newDateStr >= todayStr) {
              session.scheduleDate = newDateStr;
            } else {
              session.scheduleDate = todayStr;
            }
          }

          await ctx.answerCallbackQuery({ text: `Date: ${session.scheduleDate}` });
          const { text, keyboard } = BotKeyboardService.renderScheduleDatePicker(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'adj_h': {
          const delta = parseInt(arg || '0', 10);
          const time = session.scheduleTime || '12:00';
          const [hStr, mStr] = time.split(':');
          let h = parseInt(hStr || '12', 10);
          if (delta === 0) {
            const tz = session.scheduleTimezone || 'Asia/Kolkata';
            const nowH = parseInt(
              new Date().toLocaleTimeString([], { hour: '2-digit', hour12: false, timeZone: tz }),
              10
            );
            h = (nowH + 1) % 24;
          } else {
            h = (h + delta + 24) % 24;
          }
          session.scheduleTime = `${String(h).padStart(2, '0')}:${mStr || '00'}`;
          await ctx.answerCallbackQuery({ text: `Time: ${session.scheduleTime}` });
          const { text, keyboard } = BotKeyboardService.renderScheduleTimeAdjuster(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'adj_m': {
          const delta = parseInt(arg || '0', 10);
          const time = session.scheduleTime || '12:00';
          const [hStr, mStr] = time.split(':');
          let h = parseInt(hStr || '12', 10);
          let m = parseInt(mStr || '00', 10);
          if (delta === 0) {
            m = 0;
          } else {
            let totalMin = h * 60 + m + delta;
            if (totalMin < 0) totalMin += 24 * 60;
            totalMin = totalMin % (24 * 60);
            h = Math.floor(totalMin / 60);
            m = totalMin % 60;
          }
          session.scheduleTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          await ctx.answerCallbackQuery({ text: `Time: ${session.scheduleTime}` });
          const { text, keyboard } = BotKeyboardService.renderScheduleTimeAdjuster(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'adj_set': {
          const tz = session.scheduleTimezone || 'Asia/Kolkata';
          if (arg?.startsWith('+')) {
            let minutesToAdd = 15;
            if (arg === '+30m') minutesToAdd = 30;
            else if (arg === '+1h') minutesToAdd = 60;
            else if (arg === '+3h') minutesToAdd = 180;
            else if (arg === '+6h') minutesToAdd = 360;

            const future = new Date(Date.now() + minutesToAdd * 60 * 1000);
            session.scheduleDate = future.toLocaleDateString('en-CA', { timeZone: tz });
            session.scheduleTime = future.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: tz,
            });
          } else if (arg) {
            session.scheduleTime = arg;
          }
          await ctx.answerCallbackQuery({ text: `Set to: ${session.scheduleTime}` });
          const { text, keyboard } = BotKeyboardService.renderScheduleTimeAdjuster(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'adj_confirm': {
          if (session.selectedDestinationIds.size === 0 && session.selectedGroupIds.size === 0) {
            const allVerified = await Destination.find({
              status: 'active',
              'verification.canPublish': true,
            });
            if (allVerified.length > 0) {
              for (const d of allVerified) {
                session.selectedDestinationIds.add(d._id.toString());
              }
            } else {
              await ctx.answerCallbackQuery({
                text: '⚠️ Please select at least one channel first!',
                show_alert: true,
              });
              const { text, keyboard } = await BotKeyboardService.renderDestinationSelector(
                message,
                session
              );
              await this.sendOrEdit(ctx, text, keyboard);
              return;
            }
          }

          const resolved = await this.resolveSessionDestinations(session);
          if (resolved.length === 0) {
            await ctx.answerCallbackQuery({
              text: '⚠️ Selected channels are not verified for publishing. Check bot admin permissions.',
              show_alert: true,
            });
            return;
          }

          const tz = session.scheduleTimezone || 'Asia/Kolkata';
          const dateStr = session.scheduleDate || BotKeyboardService.getLocalDateString(0, tz);
          const timeStr = session.scheduleTime || '12:00';
          let scheduledForDate = BotAdminService.parseScheduledDate(dateStr, timeStr, tz);

          const nowMs = Date.now();
          if (scheduledForDate.getTime() <= nowMs + 10 * 1000) {
            const diffMin = Math.round((nowMs - scheduledForDate.getTime()) / 60000);
            if (diffMin <= 15) {
              // Gracefully bump by 2 minutes so user's intended schedule succeeds immediately
              scheduledForDate = new Date(nowMs + 2 * 60 * 1000);
            } else {
              await ctx.answerCallbackQuery({
                text: `⚠️ ${timeStr} is in the past! Please select a future time.`,
                show_alert: true,
              });
              const { text, keyboard } = BotKeyboardService.renderScheduleTimeAdjuster(message, session);
              await this.sendOrEdit(
                ctx,
                `⚠️ <b>Selected time (${timeStr}) has passed!</b>\n\n` +
                  `Please tap <b>+15m</b>, <b>+1 Hour</b>, or <b>Tomorrow</b> to dial a future time:\n\n${text}`,
                keyboard
              );
              return;
            }
          }

          try {
            await ctx.answerCallbackQuery({ text: '🕒 Scheduling broadcast...' });

            // Persist buttons & toggles
            message.content.buttons = (session.urlButtons || []).map((btn) => [
              { text: btn.text, url: btn.url },
            ]);
            message.silentPublish = session.silentPublish;
            message.pinOnPublish = session.pinOnPublish;
            message.disableWebPreview = session.disableWebPreview;
            await message.save();

            const scheduledPost = await ScheduleService.createSchedule(
              {
                messageId,
                destinationIds: resolved.map((r) => r.id),
                categoryId: session.categoryId,
                publishMode: session.publishMode,
                scheduledFor: scheduledForDate.toISOString(),
                timezone: tz,
              },
              admin._id.toString()
            );

            botSessionManager.clear(messageId);
            botSessionManager.clearAdminState(fromId);

            const { text, keyboard } = BotKeyboardService.renderScheduleSuccess(
              scheduledPost as unknown as IScheduledPost,
              message
            );
            await this.sendOrEdit(ctx, text, keyboard);
          } catch (err: unknown) {
            logger.error('Error creating schedule in bot:', err);
            const errMsg = err instanceof Error ? err.message : String(err);
            await ctx.answerCallbackQuery({
              text: `⚠️ Scheduling error: ${errMsg}`,
              show_alert: true,
            });
            await ctx.reply(`⚠️ <b>Could not schedule broadcast:</b> ${BotKeyboardService.escapeHtml(errMsg)}`, {
              parse_mode: 'HTML',
              reply_markup: new InlineKeyboard().text('← Back to Post Editor', `b:${messageId}:menu`),
            });
          }
          break;
        }

        case 's_tz': {
          await ctx.answerCallbackQuery();
          const { text, keyboard } = BotKeyboardService.renderScheduleTimezonePicker(
            message,
            session
          );
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'stz': {
          if (arg) {
            session.scheduleTimezone = arg;
          }
          await ctx.answerCallbackQuery({ text: `Timezone set to ${session.scheduleTimezone}` });
          const { text, keyboard } = BotKeyboardService.renderScheduleDatePicker(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'sd': {
          if (arg) {
            session.scheduleDate = arg;
          }
          await ctx.answerCallbackQuery({ text: `Date set: ${session.scheduleDate}` });
          botSessionManager.setAdminState(fromId, 'SCHEDULE_TIME_ADJUSTER', messageId);
          const { text, keyboard } = BotKeyboardService.renderScheduleTimeAdjuster(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'st': {
          const tz = session.scheduleTimezone || 'Asia/Kolkata';
          let chosenDate = session.scheduleDate || BotKeyboardService.getLocalDateString(0, tz);
          let chosenTime = arg || '12:00';

          if (arg === '15m' || arg === '30m' || arg === '1h' || arg === '3h') {
            let minutesToAdd = 15;
            if (arg === '30m') minutesToAdd = 30;
            else if (arg === '1h') minutesToAdd = 60;
            else if (arg === '3h') minutesToAdd = 180;

            const future = new Date(Date.now() + minutesToAdd * 60 * 1000);
            chosenDate = future.toLocaleDateString('en-CA', { timeZone: tz });
            chosenTime = future.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: tz,
            });
          }

          session.scheduleDate = chosenDate;
          session.scheduleTime = chosenTime;

          const scheduledForDate = BotAdminService.parseScheduledDate(chosenDate, chosenTime, tz);
          if (scheduledForDate.getTime() <= Date.now()) {
            await ctx.answerCallbackQuery({
              text: '⚠️ Time has already passed. Please select a future time slot.',
              show_alert: true,
            });
            return;
          }

          await ctx.answerCallbackQuery();
          const resolved = await this.resolveSessionDestinations(session);
          botSessionManager.setAdminState(fromId, 'SCHEDULE_CONFIRM', messageId);
          const { text, keyboard } = await BotKeyboardService.renderScheduleConfirmation(
            message,
            session,
            resolved
          );
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'st_custom': {
          await ctx.answerCallbackQuery();
          botSessionManager.setAdminState(fromId, 'SCHEDULE_TIME_ADJUSTER', messageId);
          const { text, keyboard } = BotKeyboardService.renderScheduleTimeAdjuster(message, session);
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 's_confirm': {
          if (session.selectedDestinationIds.size === 0 && session.selectedGroupIds.size === 0) {
            await ctx.answerCallbackQuery({
              text: '⚠️ Please select at least one destination first',
              show_alert: true,
            });
            return;
          }

          const resolved = await this.resolveSessionDestinations(session);
          if (resolved.length === 0) {
            await ctx.answerCallbackQuery({
              text: '⚠️ None of the selected destinations are currently verified for publishing',
              show_alert: true,
            });
            return;
          }

          const tz = session.scheduleTimezone || 'Asia/Kolkata';
          const dateStr = session.scheduleDate || BotKeyboardService.getLocalDateString(0, tz);
          const timeStr = session.scheduleTime || '12:00';
          const scheduledForDate = BotAdminService.parseScheduledDate(dateStr, timeStr, tz);

          if (scheduledForDate.getTime() <= Date.now()) {
            await ctx.answerCallbackQuery({
              text: '⚠️ Scheduled time has already passed. Please pick a future time.',
              show_alert: true,
            });
            return;
          }

          await ctx.answerCallbackQuery({ text: '🕒 Scheduling broadcast...' });

          // Persist buttons & toggles
          message.content.buttons = (session.urlButtons || []).map((btn) => [
            { text: btn.text, url: btn.url },
          ]);
          message.silentPublish = session.silentPublish;
          message.pinOnPublish = session.pinOnPublish;
          message.disableWebPreview = session.disableWebPreview;
          await message.save();

          const scheduledPost = await ScheduleService.createSchedule(
            {
              messageId,
              destinationIds: resolved.map((r) => r.id),
              categoryId: session.categoryId,
              publishMode: session.publishMode,
              scheduledFor: scheduledForDate.toISOString(),
              timezone: tz,
            },
            admin._id.toString()
          );

          botSessionManager.clear(messageId);
          botSessionManager.clearAdminState(fromId);

          const { text, keyboard } = BotKeyboardService.renderScheduleSuccess(
            scheduledPost as unknown as IScheduledPost,
            message
          );
          await this.sendOrEdit(ctx, text, keyboard);
          break;
        }

        case 'cnc': {
          botSessionManager.clear(messageId);
          botSessionManager.clearAdminState(fromId);
          await ctx.answerCallbackQuery({ text: 'Post cancelled' });
          const keyboard = new InlineKeyboard().text('⌂ Main Menu', 'nav:main');
          await this.sendOrEdit(
            ctx,
            `❌ <b>Post cancelled.</b>\nDraft ID: <code>${messageId.slice(-6)}</code> remains saved in the Web Panel.\n\nSend a new message anytime to launch the Post Editor.`,
            keyboard
          );
          break;
        }

        default:
          await ctx.answerCallbackQuery({ text: 'Unknown action' });
      }
    } catch (err: unknown) {
      if (session) session.isPublishing = false;
      logger.error(`Error handling bot callback ${callbackData}:`, err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      await ctx.answerCallbackQuery({
        text: `Error: ${errorMsg.slice(0, 60)}`,
        show_alert: true,
      });
    }
  }

  public static async resolveSessionDestinations(session: {
    selectedDestinationIds: Set<string>;
    selectedGroupIds: Set<string>;
  }): Promise<Array<{ id: string; title: string; telegramChatId: string }>> {
    const rawIds = new Set<string>(session.selectedDestinationIds);

    if (session.selectedGroupIds.size > 0) {
      const groups = await DestinationGroup.find({
        _id: { $in: Array.from(session.selectedGroupIds) },
        status: 'active',
      });
      for (const group of groups) {
        for (const destId of group.destinationIds || []) {
          rawIds.add(destId.toString());
        }
      }
    }

    if (rawIds.size === 0) return [];

    const verified = await Destination.find({
      _id: { $in: Array.from(rawIds) },
      status: 'active',
      'verification.canPublish': true,
    });

    return verified.map((d) => ({
      id: d._id.toString(),
      title: d.title,
      telegramChatId: d.telegramChatId,
    }));
  }

  /**
   * Universal handler for connecting/linking a destination channel or group
   */
  public static async handleConnectDestinationChat(
    ctx: Context,
    targetChatIdOrUsername: string,
    fromId: number
  ): Promise<void> {
    botSessionManager.clearAdminState(fromId);

    try {
      const probeResult = await TelegramService.verifyDestination(targetChatIdOrUsername);
      const cleanChatId = String(probeResult.metadata?.id || targetChatIdOrUsername).trim();

      let dest = await Destination.findOne({ telegramChatId: cleanChatId });
      if (!dest) {
        dest = await Destination.create({
          telegramChatId: cleanChatId,
          title: probeResult.metadata?.title || 'Connected Channel',
          username: probeResult.metadata?.username
            ? probeResult.metadata.username.toLowerCase().trim()
            : null,
          type: probeResult.metadata?.type || 'channel',
          status: probeResult.canPublish ? 'active' : 'permission_missing',
          verification: probeResult.verification,
        });
      } else {
        if (probeResult.metadata?.title) dest.title = probeResult.metadata.title;
        if (probeResult.metadata?.username) dest.username = probeResult.metadata.username;
        dest.verification = probeResult.verification;
        dest.status = probeResult.canPublish ? 'active' : 'permission_missing';
        await dest.save();
      }

      if (probeResult.canPublish) {
        await ctx.reply(
          `🎉 <b>CHANNEL CONNECTED & VERIFIED!</b>\n\n` +
            `• <b>Title:</b> <b>${BotKeyboardService.escapeHtml(dest.title)}</b>\n` +
            `• <b>Chat ID:</b> <code>${dest.telegramChatId}</code>\n` +
            `• <b>Type:</b> ${dest.type.toUpperCase()}\n` +
            `• <b>Status:</b> 🟢 Active & Ready to Publish\n` +
            `• <b>Role:</b> <code>${dest.verification?.botRole || 'administrator'}</code>\n\n` +
            `<i>This destination is now active in your broadcast targets and ready for automation rules.</i>`,
          {
            parse_mode: 'HTML',
          }
        );
        await Source.findOneAndUpdate(
          { telegramChatId: cleanChatId },
          {
            title: dest.title,
            username: dest.username,
            type: dest.type === 'group' ? 'group' : 'channel',
            status: 'active',
          },
          { upsert: true }
        );

        const navKeyboard = new InlineKeyboard()
          .text('🎯 View Channels', `v:dest:${dest._id.toString()}`)
          .text('➕ Add Another', 'nav:add_dest')
          .row()
          .text('⌂ Main Menu', 'nav:main');
        await ctx.reply('Quick actions:', { reply_markup: navKeyboard });
      } else {
        await ctx.reply(
          `⚠️ <b>CHANNEL LINKED, BUT PERMISSIONS MISSING</b>\n\n` +
            `• <b>Title:</b> <b>${BotKeyboardService.escapeHtml(dest.title)}</b>\n` +
            `• <b>Chat ID:</b> <code>${dest.telegramChatId}</code>\n` +
            `• <b>Missing:</b> ${dest.verification?.failureReason || 'Bot cannot post messages'}\n\n` +
            `<i>Please ensure the bot has been granted 'Post Messages' rights in channel settings, then tap Verify below:</i>`,
          {
            parse_mode: 'HTML',
          }
        );
        const navKeyboard = new InlineKeyboard()
          .text('🔄 Verify Permissions Now', `dest:vfy:${dest._id.toString()}`)
          .row()
          .text('🎯 View Channels & Groups', 'nav:dests');
        await ctx.reply('Permissions check:', { reply_markup: navKeyboard });
      }
    } catch (err) {
      logger.error('Error connecting destination channel:', err);
      await ctx.reply(
        `❌ <b>Could not connect channel:</b> ${err instanceof Error ? err.message : 'Unknown error'}\n\n` +
          `<i>Make sure the bot has been added to the channel or group as an administrator with posting rights.</i>`,
        {
          parse_mode: 'HTML',
        }
      );
      const navKeyboard = new InlineKeyboard()
        .text('🔄 Try Again', 'nav:add_dest')
        .text('❌ Cancel', 'nav:dests');
      await ctx.reply('Options:', { reply_markup: navKeyboard });
    }
  }

  /**
   * Automatic In-Flight Destination Registration
   * Triggers when bot is added to or promoted in ANY channel or group
   */
  public static async handleMyChatMemberUpdate(ctx: Context): Promise<void> {
    const update = ctx.myChatMember;
    if (!update) return;

    const chat = update.chat;
    const from = update.from;
    const newMember = update.new_chat_member;

    logger.info(
      `Received my_chat_member update: chat=${chat.id} (${'title' in chat ? chat.title : 'no title'}), new_status=${newMember.status}, from=${from?.id} (${from?.first_name || 'user'})`
    );

    const chatIdStr = String(chat.id);
    const chatType = chat.type; // 'channel' | 'group' | 'supergroup'
    const title =
      ('title' in chat && chat.title) || (chat.username ? `@${chat.username}` : `Chat ${chatIdStr}`);
    const username = chat.username ? chat.username.toLowerCase().trim() : null;

    // 1. If bot is promoted to administrator or member
    if (
      newMember.status === 'administrator' ||
      (chatType !== 'channel' && newMember.status === 'member')
    ) {
      const isChannel = chatType === 'channel';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adminRights = newMember.status === 'administrator' ? (newMember as any) : {};

      const canPost = isChannel ? Boolean(adminRights.can_post_messages) : true;
      const canEdit = Boolean(adminRights.can_edit_messages);
      const canDelete = Boolean(adminRights.can_delete_messages);

      const canPublish = isChannel ? canPost : true;

      // Upsert into MongoDB
      let dest = await Destination.findOne({ telegramChatId: chatIdStr });
      if (!dest) {
        dest = await Destination.create({
          telegramChatId: chatIdStr,
          title,
          username,
          type: isChannel ? 'channel' : 'group',
          status: canPublish ? 'active' : 'permission_missing',
          verification: {
            chatType: isChannel ? 'channel' : 'supergroup',
            isForum: false,
            botRole: newMember.status,
            isMember: true,
            canPublish,
            canSendAsChat: false,
            senderIdentity: 'bot',
            rights: {
              canPostMessages: canPost,
              canSendMessages: true,
              canEditMessages: canEdit,
              canDeleteMessages: canDelete,
              canManageTopics: Boolean(adminRights.can_manage_topics),
            },
            lastCheckedAt: new Date().toISOString(),
            failureReason: canPublish ? null : 'Missing "Post Messages" permission',
          },
        });
      } else {
        dest.title = title;
        if (username) dest.username = username;
        dest.type = isChannel ? 'channel' : 'group';
        dest.status = canPublish ? 'active' : 'permission_missing';
        dest.verification = {
          chatType: isChannel ? 'channel' : 'supergroup',
          isForum: false,
          botRole: newMember.status,
          isMember: true,
          canPublish,
          canSendAsChat: false,
          senderIdentity: 'bot',
          rights: {
            canPostMessages: canPost,
            canSendMessages: true,
            canEditMessages: canEdit,
            canDeleteMessages: canDelete,
            canManageTopics: Boolean(adminRights.can_manage_topics),
          },
          lastCheckedAt: new Date().toISOString(),
          failureReason: canPublish ? null : 'Missing "Post Messages" permission',
        };
        await dest.save();
      }

      // Sync to Source so this channel/group is available for forwarding rules
      await Source.findOneAndUpdate(
        { telegramChatId: chatIdStr },
        {
          title: dest.title,
          username: dest.username,
          type: dest.type === 'group' ? 'group' : 'channel',
          status: 'active',
        },
        { upsert: true }
      );

      // Notify the operator in their private chat
      if (from?.id) {
        try {
          if (canPublish) {
            const successText =
              `🎉 <b>DESTINATION AUTOMATICALLY CONNECTED!</b>\n\n` +
              `• <b>Chat Name:</b> <b>${BotKeyboardService.escapeHtml(title)}</b>\n` +
              `• <b>Chat ID:</b> <code>${chatIdStr}</code>\n` +
              `• <b>Type:</b> ${isChannel ? '📢 Channel' : '👥 Group'}\n` +
              `• <b>Status:</b> 🟢 <b>Active & Ready to Publish</b>\n\n` +
              `✅ <b>Permissions Confirmed:</b>\n` +
              `• ✍️ Post Messages: <b>Granted</b>\n` +
              `• ✏️ Edit Messages: <b>${canEdit ? 'Granted' : 'Optional'}</b>\n` +
              `• 🗑️ Delete Messages: <b>${canDelete ? 'Granted' : 'Optional'}</b>\n\n` +
              `<i>This destination is now active across your bot! You can broadcast posts or create forwarding rules.</i>`;

            const navKb = new InlineKeyboard()
              .text('🎯 View Destination', `v:dest:${dest._id.toString()}`)
              .text('⚡ Create Rule', 'nav:add_rule')
              .row()
              .text('✍️ New Post', 'nav:new')
              .text('⌂ Dashboard', 'nav:main');

            await getTelegramBot().api.sendMessage(from.id, successText, {
              parse_mode: 'HTML',
              reply_markup: navKb,
            });
          } else {
            let botUsername = 'bot';
            try {
              const me = await getTelegramBot().api.getMe();
              botUsername = me.username || 'bot';
            } catch {
              // fallback
            }

            const warnText =
              `⚠️ <b>BOT ADDED TO "${BotKeyboardService.escapeHtml(title)}", BUT MISSING RIGHTS!</b>\n\n` +
              `The bot is an administrator, but <b>"Post Messages"</b> permission is currently turned OFF.\n\n` +
              `🔧 <b>Quick Fix (10 seconds):</b>\n` +
              `1. Open Channel ➔ Edit (✏️) ➔ Administrators\n` +
              `2. Tap <b>@${botUsername}</b>\n` +
              `3. Turn ON <b>"Post Messages"</b> and <b>"Edit Messages"</b>\n` +
              `4. Save\n\n` +
              `<i>The bot will immediately verify and activate your destination!</i>`;

            await getTelegramBot().api.sendMessage(from.id, warnText, { parse_mode: 'HTML' });
          }
        } catch (err) {
          logger.warn(`Could not send private notification to admin ${from.id}:`, err);
        }
      }
      return;
    }

    // 2. If bot is kicked or left
    if (newMember.status === 'left' || newMember.status === 'kicked') {
      const dest = await Destination.findOne({ telegramChatId: chatIdStr });
      if (dest) {
        dest.status = 'disabled';
        if (dest.verification) {
          dest.verification.isMember = false;
          dest.verification.canPublish = false;
          dest.verification.botRole = newMember.status;
        }
        await dest.save();
      }

      if (from?.id) {
        try {
          await getTelegramBot().api.sendMessage(
            from.id,
            `ℹ️ Bot was removed from <b>${BotKeyboardService.escapeHtml(title)}</b>. Destination has been marked inactive.`,
            { parse_mode: 'HTML' }
          );
        } catch {
          // ignore
        }
      }
    }
  }
}
