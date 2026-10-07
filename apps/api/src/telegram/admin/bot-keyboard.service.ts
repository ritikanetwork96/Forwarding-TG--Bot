import mongoose from 'mongoose';
import { InlineKeyboard, Keyboard } from 'grammy';
import type { IMessage } from '../../models/message.model.js';
import type { ICategory } from '../../models/category.model.js';
import type { IDestination } from '../../models/destination.model.js';
import type { IForwardingRule } from '../../models/forwarding-rule.model.js';
import type { ISource } from '../../models/source.model.js';
import { Category } from '../../models/category.model.js';
import { Destination } from '../../models/destination.model.js';
import { DestinationGroup } from '../../models/destination-group.model.js';
import { ForwardingRule } from '../../models/forwarding-rule.model.js';
import { Source } from '../../models/source.model.js';
import { ScheduledPost, type IScheduledPost } from '../../models/scheduled-post.model.js';
import { env } from '../../config/index.js';
import type { BotPostSession, RuleDraft } from './bot-session.service.js';
import type { PublishResultData } from '@telegram-forwarder/shared';

const DEST_PAGE_SIZE = 6;
const LIST_PAGE_SIZE = 8;

export class BotKeyboardService {
  /**
   * Safe HTML escaping utility
   */
  public static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Validates whether a URL is a public web URL suitable for Telegram InlineKeyboard buttons.
   * Telegram Bot API strictly rejects 'localhost', '127.0.0.1', and internal addresses with 400 Bad Request.
   */
  public static isPublicTelegramUrl(url?: string): boolean {
    if (!url) return false;
    const trimmed = url.trim().toLowerCase();
    if (
      trimmed.includes('localhost') ||
      trimmed.includes('127.0.0.1') ||
      trimmed.includes('0.0.0.0') ||
      trimmed.includes('::1')
    ) {
      return false;
    }
    return trimmed.startsWith('https://') || trimmed.startsWith('http://');
  }

  /**
   * Formats a category display string for inline buttons
   */
  public static formatCategoryLabel(cat: {
    displayName?: string | null;
    name: string;
    iconEmoji?: string | null;
    destinationIds?: unknown[];
  }): string {
    const emoji = cat.iconEmoji || '📁';
    const name = cat.displayName || cat.name;
    const count = Array.isArray(cat.destinationIds) ? cat.destinationIds.length : 0;
    return `${emoji} ${name} (${count} ${count === 1 ? 'Channel' : 'Channels'})`;
  }

  /**
   * Formats a category display string with optional custom emoji HTML tag
   */
  public static formatCategoryHtml(cat: {
    displayName?: string | null;
    name: string;
    iconEmoji?: string | null;
    customEmojiId?: string | null;
  }): string {
    const name = this.escapeHtml(cat.displayName || cat.name);
    if (cat.customEmojiId) {
      return `<tg-emoji emoji-id="${cat.customEmojiId}">${cat.iconEmoji || '📁'}</tg-emoji> ${name}`;
    }
    return `${cat.iconEmoji || '📁'} ${name}`;
  }

  /**
   * Formats a destination display string
   */
  public static formatDestinationLabel(dest: {
    displayName?: string | null;
    title: string;
    iconEmoji?: string | null;
  }): string {
    const emoji = dest.iconEmoji || '';
    const title = dest.displayName || dest.title;
    return emoji ? `${emoji} ${title}` : title;
  }

  /**
   * Generates a clean content preview for any media or text type
   */
  public static formatContentPreview(message: IMessage): string {
    const text = (message.content.text || '').trim();
    const mediaCount = message.content.mediaItems?.length || 0;
    const firstMedia = message.content.mediaItems?.[0];

    let header = '';

    if (message.messageType === 'album') {
      header = `📦 <b>Album • ${mediaCount} items</b>`;
    } else if (message.messageType === 'photo') {
      header = `📷 <b>Photo</b>`;
    } else if (message.messageType === 'video') {
      header = `🎥 <b>Video</b>`;
    } else if (message.messageType === 'document') {
      const fileName = firstMedia?.fileName || 'document';
      header = `📄 <b>Document:</b> <code>${this.escapeHtml(fileName)}</code>`;
    } else if (message.messageType === 'audio') {
      header = `🎵 <b>Audio</b>`;
    } else if (message.messageType === 'animation') {
      header = `🎞️ <b>Animation / GIF</b>`;
    } else {
      header = `📝 <b>Text Post</b>`;
    }

    if (!text) {
      return header;
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    // Show up to 1200 characters inside an expandable blockquote so large 400-word posts are fully viewable without cluttering
    const isLong = text.length > 1200;
    const displayText = isLong ? text.substring(0, 1190) + '...' : text;

    return (
      `${header}\n` +
      `<blockquote expandable>📝 <b>Content Preview (${wordCount} words):</b>\n` +
      `${this.escapeHtml(displayText)}</blockquote>`
    );
  }

  /**
   * Checks whether the MongoDB connection is alive
   */
  public static isDbReady(): boolean {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Standard offline screen for submenus when DB is unreachable
   */
  public static renderDbOffline(backTarget = 'nav:main'): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const text =
      `🔴 <b>DATABASE CURRENTLY OFFLINE</b>\n\n` +
      `The database is not reachable from your server's current IP.\n\n` +
      `🔑 <b>Whitelist Required in MongoDB Atlas:</b>\n` +
      `• IP: <code>223.181.41.63</code> (or <code>0.0.0.0/0</code>)\n` +
      `• Path: <i>Security ➔ Network Access ➔ Add IP Address</i>\n\n` +
      `<i>Once whitelisted in Atlas, tap Refresh below:</i>`;

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh Status', 'nav:main')
      .row()
      .text('← Back to Main Menu', backTarget);

    return { text, keyboard };
  }

  // ==========================================
  // 1. MAIN EXECUTIVE DASHBOARD (/start)
  // ==========================================

  public static async renderDashboard(_adminName?: string): Promise<{
    text: string;
    keyboard: InlineKeyboard;
  }> {
    const isDbConnected = this.isDbReady();
    let destCount = 0;
    let catCount = 0;
    let draftCount = 0;
    let scheduledCount = 0;
    let pendingCount = 0;
    let rulesCount = 0;

    if (isDbConnected) {
      try {
        const { Message } = await import('../../models/message.model.js');
        [destCount, catCount, draftCount, scheduledCount, pendingCount, rulesCount] =
          await Promise.all([
            Destination.countDocuments({ status: 'active', 'verification.canPublish': true }),
            Category.countDocuments({ status: 'active' }),
            Message.countDocuments({ status: 'draft' }),
            ScheduledPost.countDocuments({ status: 'scheduled' }),
            Message.countDocuments({ status: 'pending_approval' }),
            ForwardingRule.countDocuments(),
          ]);
      } catch (err) {
        // Fallback to 0 counts on error
      }
    }

    const text =
      `<blockquote><b>TELEGRAM RELAY</b>\n` +
      `<i>Automated Forwarding & Broadcast System</i></blockquote>\n\n` +
      `<b>Welcome back!</b>\n\n` +
      `<blockquote><b>System Status:</b>\n` +
      (isDbConnected
        ? `🟢 Connected • All systems operational`
        : `🔴 Offline • Database reconnecting`) +
      `</blockquote>\n\n` +
      `<blockquote><b>Overview:</b>\n` +
      `📢 <b>Channels & Groups:</b> <code>${destCount}</code> connected\n` +
      `📁 <b>Categories:</b> <code>${catCount}</code>\n` +
      `⚡ <b>Forward Rules:</b> <code>${rulesCount}</code> active\n` +
      `🕒 <b>Scheduled:</b> <code>${scheduledCount}</code> queued\n` +
      `📝 <b>Drafts:</b> <code>${draftCount}</code>` +
      (pendingCount > 0 ? `\n⚠️ <b>Pending Approvals:</b> <code>${pendingCount}</code>` : '') +
      `</blockquote>\n\n` +
      `<i>Select an option below or send/forward any message to start:</i>`;

    const keyboard = new InlineKeyboard();

    keyboard
      .text('✍️ New Post', 'nav:new')
      .text('📢 Add Channel / Group', 'nav:add_dest')
      .row();

    if (pendingCount > 0) {
      keyboard.text(`📥 Inbound Approvals (${pendingCount}) ⚠️`, 'nav:approvals').row();
    }

    keyboard
      .text(`📢 Channels & Groups (${destCount})`, 'nav:dests')
      .text(`📁 Categories (${catCount})`, 'nav:cats')
      .row()
      .text(`⚡ Forward Rules (${rulesCount})`, 'nav:rules')
      .text(`🕒 Scheduled (${scheduledCount})`, 'nav:scheduled')
      .row()
      .text(`📝 Drafts (${draftCount})`, 'nav:drafts')
      .text('📜 History & Logs', 'nav:history')
      .row()
      .text('❓ Help', 'nav:help')
      .text('🔄 Refresh', 'nav:main')
      .row();

    if (this.isPublicTelegramUrl(env.FRONTEND_URL)) {
      if (env.FRONTEND_URL.startsWith('https://')) {
        keyboard.webApp('💎 Open Admin Panel 🚀', env.FRONTEND_URL).row();
      } else {
        keyboard.url('💎 Open Admin Panel ↗', env.FRONTEND_URL).row();
      }
    }

    return { text, keyboard };
  }

  // ==========================================
  // 2. NEW POST WAITING STATE
  // ==========================================

  public static renderNewPostWaiting(): { text: string; keyboard: InlineKeyboard } {
    const text =
      `<blockquote>💎 <b>NEW POST • COMPOSE & BROADCAST</b>\n` +
      `<i>Send text, photo, video, document, audio, animation or album to start</i></blockquote>\n\n` +
      `✦ <b>Studio Capabilities:</b>\n` +
      `• Native Telegram entities (bold, spoilers, links) preserved\n` +
      `• Multi-item albums bundled together smoothly\n` +
      `• Attach custom interactive URL buttons with 1 tap\n` +
      `• Instant broadcast across channels or scheduled queue\n\n` +
      `<i>Kindly send your content now, or tap Back to return:</i>`;

    const keyboard = new InlineKeyboard().text('← Back to Main Menu', 'nav:main');
    return { text, keyboard };
  }

  // ==========================================
  // 3. POST EDITOR & CATEGORY DISPATCH
  // ==========================================

  /**
   * Fast Category-Driven Broadcast Prompt
   * Triggered when an admin forwards/authors a message in the bot.
   * Shows 1-tap buttons for all Categories + "Send to All Targets".
   */
  public static async renderCategoryBroadcastPrompt(
    message: IMessage
  ): Promise<{ text: string; keyboard: InlineKeyboard }> {
    const msgId = message._id.toString();
    const categories = await Category.find({ status: { $ne: 'deleted' } }).sort({ name: 1 });
    const allActiveDests = await Destination.find({
      status: 'active',
      'verification.canPublish': { $ne: false },
    });

    const chCount = allActiveDests.filter((d) => d.type === 'channel').length;
    const grpCount = allActiveDests.filter(
      (d) => d.type === 'group' || d.type === 'supergroup'
    ).length;
    const usrCount = allActiveDests.filter((d) => d.type === 'private').length;
    const totalCount = allActiveDests.length;

    const preview = this.formatContentPreview(message);

    const text =
      `<blockquote>📥 <b>POST RECEIVED & READY!</b></blockquote>\n\n` +
      `${preview}\n\n` +
      `<blockquote>🎯 <b>Choose Category to Broadcast:</b>\n` +
      `• Total Network: <code>${totalCount}</code> (📢 ${chCount} ch | 👥 ${grpCount} grp | 👤 ${usrCount} usr)</blockquote>\n\n` +
      `<i>Tap a Category button below to immediately dispatch this message to all connected channels, groups, and users:</i>`;

    const keyboard = new InlineKeyboard();

    // 1. One button per active category
    for (const cat of categories) {
      const count = (cat.destinationIds || []).length;
      const emoji = cat.iconEmoji || '📁';
      const catName = cat.displayName || cat.name;
      keyboard
        .text(`${emoji} ${catName} (${count} targets)`, `bcast_cat:${msgId}:${cat._id}`)
        .row();
    }

    // 2. Broadcast to ALL targets button
    keyboard.text(`📢 🚀 Send to ALL Targets (${totalCount})`, `bcast_all:${msgId}`).row();

    // 3. Advanced Editor & Cancel
    keyboard.text('⚙️ Advanced Options', `b:${msgId}:menu`).text('❌ Cancel', `b:${msgId}:cnc`);

    return { text, keyboard };
  }

  public static async renderPostMenu(
    message: IMessage,
    session: BotPostSession
  ): Promise<{ text: string; keyboard: InlineKeyboard }> {
    const msgId = message._id.toString();

    // 1. Resolve Category Names
    let categoryHtml = 'None';
    const catIds = session.selectedCategoryIds && session.selectedCategoryIds.size > 0
      ? Array.from(session.selectedCategoryIds)
      : (session.categoryId ? [session.categoryId] : []);
    if (catIds.length > 0) {
      const cats = await Category.find({ _id: { $in: catIds } });
      if (cats.length > 0) {
        categoryHtml = cats.map((c) => this.formatCategoryHtml(c)).join(', ');
      }
    }

    // 2. Count Channels & Groups
    const totalDests = session.selectedDestinationIds.size;
    const totalGroups = session.selectedGroupIds.size;
    let targetSummary = `${totalDests}`;
    if (totalGroups > 0) {
      targetSummary += ` (+${totalGroups} grp)`;
    }

    // 3. Format Preview
    const preview = this.formatContentPreview(message);
    const modeText = session.publishMode === 'forward' ? '↪️ Forward' : '📤 Copy (Clean)';
    const btnCount = session.urlButtons?.length || 0;

    const text =
      `<blockquote>✍️ <b>POST READY TO SEND</b></blockquote>\n\n` +
      `${preview}\n\n` +
      `<blockquote>⚙️ <b>Send Settings:</b>\n` +
      `• 📁 <b>Categories:</b> ${categoryHtml}\n` +
      `• 📢 <b>Channels & Groups:</b> <code>${targetSummary}</code> selected\n` +
      `• 📤 <b>Send Type:</b> <code>${modeText}</code>  •  🔘 <b>Buttons:</b> <code>${btnCount}</code></blockquote>\n\n` +
      `<i>Select categories or channels below to send:</i>`;

    const keyboard = new InlineKeyboard()
      .text('🚀 Send Now', `b:${msgId}:req_pub`)
      .row()
      .text(`📁 Categories (${catIds.length})`, `b:${msgId}:view_cats`)
      .text(`📢 Channels (${targetSummary})`, `b:${msgId}:view_dests`)
      .row()
      .text('✏️ Edit Message', `b:${msgId}:edit_text`)
      .text(`🔘 Buttons (${btnCount})`, `b:${msgId}:btn_menu`)
      .row()
      .text(
        session.publishMode === 'forward' ? '↪️ Type: Forward' : '📤 Type: Copy (Clean)',
        `b:${msgId}:toggle_mode`
      )
      .text('🕒 Schedule', `b:${msgId}:sch`)
      .row()
      .text('❌ Cancel', `b:${msgId}:cnc`);

    return { text, keyboard };
  }

  public static renderEditTextPrompt(message: IMessage): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const msgId = message._id.toString();
    const rawText = (message.content.text || '').trim();
    const wordCount = rawText ? rawText.split(/\s+/).filter(Boolean).length : 0;
    const hasMedia = (message.content.mediaItems?.length || 0) > 0;

    const mediaNotice = hasMedia
      ? `🖼 <i>This post has media attached. You can send a replacement photo/video, or just send text to update the caption.</i>\n\n`
      : '';

    const text =
      `<blockquote>✏️ <b>EDIT POST CONTENT</b>\n` +
      `<i>Tap the text box below to copy everything to clipboard!</i></blockquote>\n\n` +
      mediaNotice +
      `📋 <b>Current Content (${wordCount} words) — Tap Box to Copy:</b>\n` +
      `<pre><code>${this.escapeHtml(rawText || '[Empty]')}</code></pre>\n\n` +
      `💡 <b>How to edit easily:</b>\n` +
      `1️⃣ <b>Tap the text box above</b> once (it automatically copies to your clipboard!).\n` +
      `2️⃣ <b>Paste into chat bar</b>, make your edits, and hit send!\n` +
      `3️⃣ Or send a replacement photo/video if desired.`;

    const keyboard = new InlineKeyboard().text('← Cancel & Return to Editor', `b:${msgId}:menu`);
    return { text, keyboard };
  }

  public static renderPostButtonsMenu(
    message: IMessage,
    session: BotPostSession
  ): { text: string; keyboard: InlineKeyboard } {
    const msgId = message._id.toString();
    const buttons = session.urlButtons || [];

    let buttonListing = '<i>No inline buttons attached yet.</i>\n';
    if (buttons.length > 0) {
      buttonListing = buttons
        .map(
          (b, i) =>
            `${i + 1}. <b>[${this.escapeHtml(b.text)}]</b> ➔ <code>${b.url}</code>`
        )
        .join('\n');
    }

    const text =
      `<blockquote>🔘 <b>INLINE URL BUTTONS</b>\n` +
      `<i>Interactive buttons attached beneath your post</i></blockquote>\n\n` +
      `<b>Attached Buttons (${buttons.length}):</b>\n` +
      `${buttonListing}\n\n` +
      `✍️ <b>How to Add Buttons (Send in chat):</b>\n` +
      `Type button text and URL separated by <code>|</code>:\n` +
      `• <code>Join Channel | https://t.me/yourchannel</code>\n` +
      `• <code>Official Website | https://example.com</code>\n` +
      `• <code>Claim Offer | https://link.com/deal</code>\n\n` +
      `<i>You can send multiple buttons on new lines!</i>`;

    const keyboard = new InlineKeyboard()
      .text('➕ Add URL Button', `b:${msgId}:btn_add`);

    if (buttons.length > 0) {
      keyboard.text('🗑 Clear All', `b:${msgId}:btn_clear`);
    }

    keyboard
      .row()
      .text('← Back to Post Editor', `b:${msgId}:menu`);

    return { text, keyboard };
  }

  // ==========================================
  // 4. POST PREVIEW
  // ==========================================

  public static async renderPreview(
    message: IMessage,
    session: BotPostSession
  ): Promise<{ text: string; keyboard: InlineKeyboard }> {
    const msgId = message._id.toString();

    let categoryHtml = 'None';
    if (session.categoryId) {
      const cat = await Category.findById(session.categoryId);
      if (cat) categoryHtml = this.formatCategoryHtml(cat);
    }

    const preview = this.formatContentPreview(message);
    const rawText = (message.content.text || '').trim();

    // Resolve destinations for preview
    const resolved = await Destination.find({
      _id: { $in: Array.from(session.selectedDestinationIds) },
      status: 'active',
      'verification.canPublish': true,
    });

    const destLines = resolved.map((d) => {
      const title = this.formatDestinationLabel(d);
      const identityNote =
        d.verification.senderIdentity === 'channel'
          ? 'Channel Identity'
          : d.verification.senderIdentity === 'anonymous_admin'
            ? 'Anonymous Admin'
            : 'Bot';
      return `  • <b>${this.escapeHtml(title)}</b> <i>(${identityNote})</i>`;
    });

    const destSummary =
      destLines.length > 0 ? destLines.join('\n') : '  <i>No destinations selected yet</i>';

    const modeExplanation =
      session.publishMode === 'forward'
        ? '↪️ <b>Forward</b> (Preserves original sender & source link)'
        : '📤 <b>Copy</b> (Clean post without source attribution)';

    const text =
      `👁 <b>POST PREVIEW</b>\n\n` +
      `${preview}\n\n` +
      (rawText ? `<b>Full Caption / Text:</b>\n<i>"${this.escapeHtml(rawText)}"</i>\n\n` : '') +
      `📁 <b>Category:</b> ${categoryHtml}\n` +
      `📤 <b>Publish Mode:</b> ${modeExplanation}\n` +
      `🔘 <b>URL Buttons:</b> <code>${session.urlButtons?.length || 0}</code> attached\n` +
      `🔔 <b>Notification:</b> <code>${session.silentPublish ? 'Silent (Muted)' : 'Normal Sound'}</code>\n` +
      `📌 <b>Auto-Pin:</b> <code>${session.pinOnPublish ? 'Enabled' : 'Disabled'}</code>\n\n` +
      `🎯 <b>Target Destinations (${resolved.length}):</b>\n${destSummary}\n\n` +
      `<i>Preview does not broadcast. Tap Publish when ready:</i>`;

    const keyboard = new InlineKeyboard();

    // Render the interactive URL buttons so author can click & test them!
    if (session.urlButtons && session.urlButtons.length > 0) {
      for (const btn of session.urlButtons) {
        if (btn.text && btn.url) {
          keyboard.url(`🔗 ${btn.text}`, btn.url).row();
        }
      }
    }

    keyboard
      .text('🚀 Publish Now', `b:${msgId}:req_pub`)
      .row()
      .text('← Back to Editor', `b:${msgId}:menu`);

    return { text, keyboard };
  }

  // ==========================================
  // 5. CATEGORY SELECTOR (WIZARD)
  // ==========================================

  public static async renderCategorySelector(
    message: IMessage,
    session: BotPostSession
  ): Promise<{ text: string; keyboard: InlineKeyboard }> {
    const msgId = message._id.toString();
    const categories = await Category.find({ status: 'active' }).sort({ name: 1 });

    const selectedSet = session.selectedCategoryIds || new Set<string>();
    if (session.categoryId && selectedSet.size === 0) {
      selectedSet.add(session.categoryId);
      session.selectedCategoryIds = selectedSet;
    }

    const selectedCount = selectedSet.size;
    const selectedNames: string[] = [];
    for (const cat of categories) {
      if (selectedSet.has(cat._id.toString())) {
        selectedNames.push(this.formatCategoryLabel(cat));
      }
    }

    const text =
      `<blockquote>📁 <b>SELECT CATEGORIES</b>\n` +
      `<i>Choose which categories to send this post to</i></blockquote>\n\n` +
      `<b>Selected (${selectedCount}):</b> ` +
      (selectedNames.length > 0 ? `<code>${selectedNames.join(', ')}</code>` : `<i>None</i>`) +
      `\n\n<i>Tap a category to select/unselect:</i>`;

    const keyboard = new InlineKeyboard();

    for (const cat of categories) {
      const catIdStr = cat._id.toString();
      const isSelected = selectedSet.has(catIdStr);
      const label = this.formatCategoryLabel(cat);
      keyboard
        .text(`${isSelected ? '✅ ' : '◻️ '}${label}`, `b:${msgId}:sc:${catIdStr}`)
        .row();
    }

    keyboard
      .text('✓ Done', `b:${msgId}:menu`)
      .row()
      .text('🗑 Clear All', `b:${msgId}:sc:none`);

    return { text, keyboard };
  }

  // ==========================================
  // 6. CATEGORIES LIST (MAIN MENU BROWSING)
  // ==========================================

  public static async renderCategoryList(): Promise<{
    text: string;
    keyboard: InlineKeyboard;
  }> {
    if (!this.isDbReady()) return this.renderDbOffline();
    const categories = await Category.find({ status: 'active' }).sort({ name: 1 });

    if (categories.length === 0) {
      const text =
        `<blockquote>📁 <b>Categories</b>\n` +
        `<i>No categories configured yet</i></blockquote>\n\n` +
        `Create categories to group channels & groups together:`;
      const keyboard = new InlineKeyboard()
        .text('➕ Create New Category', 'nav:add_cat')
        .row()
        .text('← Back to Main Menu', 'nav:main');
      return { text, keyboard };
    }

    let text =
      `<blockquote>📁 <b>Categories (${categories.length})</b>\n` +
      `<i>Grouped channels and groups</i></blockquote>\n\n` +
      `Tap any category to view its channels:\n\n`;

    const keyboard = new InlineKeyboard();

    for (const cat of categories) {
      const label = this.formatCategoryLabel(cat);
      text += `• <b>${this.escapeHtml(label)}</b>\n`;
      keyboard.text(label, `v:cat:${cat._id.toString()}`).row();
    }

    keyboard
      .text('➕ Create New Category', 'nav:add_cat')
      .row()
      .text('← Back to Main Menu', 'nav:main');

    return { text, keyboard };
  }

  public static renderAddCategoryPrompt(): { text: string; keyboard: InlineKeyboard } {
    const text =
      `<blockquote>➕ <b>CREATE CONTENT CATEGORY</b>\n` +
      `<i>Organize broadcasts into thematic streams</i></blockquote>\n\n` +
      `Send a title for the new category (e.g. <code>💎 VIP Signals</code>, <code>📰 Breaking News</code>, <code>⚡ Flash Deals</code>):\n\n` +
      `<i>Send the name now, or tap Cancel:</i>`;

    const keyboard = new InlineKeyboard().text('❌ Cancel', 'nav:cats');
    return { text, keyboard };
  }

  public static renderConfirmDeleteCategory(category: ICategory): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const catId = category._id.toString();
    const text =
      `🗑 <b>DELETE CATEGORY</b>\n\n` +
      `Are you sure you want to permanently delete category <b>${this.escapeHtml(category.name)}</b>?\n\n` +
      `<i>Posts currently assigned to this category will remain intact.</i>`;

    const keyboard = new InlineKeyboard()
      .text('❌ Confirm Delete', `cat:del_do:${catId}`)
      .row()
      .text('← Keep Category', `v:cat:${catId}`);

    return { text, keyboard };
  }

  // ==========================================
  // 7. CATEGORY DETAILS VIEW
  // ==========================================

  public static renderCategoryDetails(category: ICategory): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const emoji = category.iconEmoji || '📁';
    const linkedCount = (category as any).destinationIds?.length || 0;

    const text =
      `📁 <b>CATEGORY DETAILS</b>\n\n` +
      `<b>Name:</b> ${this.escapeHtml(category.name)}\n` +
      (category.displayName ? `<b>Display Name:</b> ${this.escapeHtml(category.displayName)}\n` : '') +
      `<b>Icon:</b> ${emoji}\n` +
      (category.customEmojiId ? `<b>Custom Emoji:</b> <code>${category.customEmojiId}</code>\n` : '') +
      `<b>Linked Channels:</b> <code>${linkedCount}</code> channels & groups\n` +
      `<b>Status:</b> ${category.status === 'active' ? '🟢 Active' : '⚪ Archived'}\n\n` +
      `<i>When you select this Category in a post, its linked channels auto-select immediately!</i>`;

    const catId = category._id ? category._id.toString() : '';
    const keyboard = new InlineKeyboard();

    if (catId) {
      keyboard
        .text(`📢 Link Channels (${linkedCount})`, `cat:edest:${catId}`)
        .row()
        .text('✏️ Rename Category', `cat:rename:${catId}`)
        .text('🗑 Delete Category', `cat:del_ask:${catId}`)
        .row();
    }

    keyboard.text('← Back to Categories', 'nav:cats').text('⌂ Main Menu', 'nav:main');

    return { text, keyboard };
  }

  public static renderCategoryEditDests(
    category: ICategory,
    destinations: IDestination[]
  ): { text: string; keyboard: InlineKeyboard } {
    const catId = category._id.toString();
    const currentDestIds = new Set(
      ((category as any).destinationIds || []).map((id: any) => id.toString())
    );

    const text =
      `<blockquote>📁 <b>LINK CHANNELS TO CATEGORY</b>\n` +
      `<i>Auto-Select Channels when Category is Chosen</i></blockquote>\n\n` +
      `Category: <b>${this.escapeHtml(category.name)}</b>\n` +
      `Active Linked Channels: <b>${currentDestIds.size}</b> channel(s)\n\n` +
      `<i>When you select this Category in a post, these channels will auto-select instantly!</i>`;

    const keyboard = new InlineKeyboard();

    for (const d of destinations) {
      const isChecked = currentDestIds.has(d._id.toString());
      const label = `${isChecked ? '✅ ' : '◻️ '}📢 ${d.title}`;
      keyboard.text(label, `cat:td:${catId}:${d._id.toString()}`).row();
    }

    keyboard.text('✅ Done Linking Channels', `v:cat:${catId}`).row();
    return { text, keyboard };
  }

  public static renderRenameCategoryPrompt(category: ICategory): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const catId = category._id.toString();
    const text =
      `<blockquote>✏️ <b>RENAME CATEGORY</b>\n` +
      `<i>Update category title and display tag</i></blockquote>\n\n` +
      `Current Name: <b>${this.escapeHtml(category.name)}</b>\n` +
      `Slug: <code>${category.slug}</code>\n\n` +
      `<i>Send the new name for this category now:</i>`;

    const keyboard = new InlineKeyboard().text('❌ Cancel', `v:cat:${catId}`);
    return { text, keyboard };
  }

  // ==========================================
  // 8. DESTINATION SELECTOR (WIZARD)
  // ==========================================

  public static async renderDestinationSelector(
    message: IMessage,
    session: BotPostSession
  ): Promise<{ text: string; keyboard: InlineKeyboard }> {
    const msgId = message._id.toString();

    // Query active verified destinations
    const destinations = await Destination.find({
      status: 'active',
      'verification.canPublish': true,
    }).sort({ title: 1 });

    // Query active groups
    const groups = await DestinationGroup.find({ status: 'active' }).sort({ name: 1 });

    interface TargetItem {
      id: string;
      title: string;
      isGroup: boolean;
      memberCount?: number;
      senderIdentity?: string;
    }

    const items: TargetItem[] = [
      ...groups.map((g) => ({
        id: g._id.toString(),
        title: g.name,
        isGroup: true,
        memberCount: g.destinationIds?.length || 0,
      })),
      ...destinations.map((d) => ({
        id: d._id.toString(),
        title: this.formatDestinationLabel(d),
        isGroup: false,
        senderIdentity: d.verification.senderIdentity,
      })),
    ];

    if (items.length === 0) {
      const text =
        `🎯 <b>Select Broadcast Channels</b>\n\n` +
        `<i>No verified channels or groups connected yet.</i>\n\n` +
        `Kindly connect your channel or group first to publish this broadcast post:`;
      const keyboard = new InlineKeyboard()
        .text('➕ Add Channel / Group', 'nav:add_dest')
        .row()
        .text('← Back to Editor', `b:${msgId}:menu`);
      return { text, keyboard };
    }

    const totalPages = Math.max(1, Math.ceil(items.length / DEST_PAGE_SIZE));
    const currentPage = Math.min(Math.max(1, session.destPage), totalPages);
    session.destPage = currentPage;

    const startIndex = (currentPage - 1) * DEST_PAGE_SIZE;
    const pageItems = items.slice(startIndex, startIndex + DEST_PAGE_SIZE);

    const selectedCount = session.selectedDestinationIds.size + session.selectedGroupIds.size;

    const text =
      `🎯 <b>Select Broadcast Channels</b>\n\n` +
      `<b>Selected:</b> ${selectedCount} channel${selectedCount === 1 ? '' : 's'} (Page ${currentPage}/${totalPages})\n\n` +
      `<i>Tap to select or unselect channels for this broadcast:</i>`;

    const keyboard = new InlineKeyboard();

    for (const item of pageItems) {
      if (item.isGroup) {
        const isChecked = session.selectedGroupIds.has(item.id);
        keyboard
          .text(
            `${isChecked ? '✅ ' : '◻️ '}👥 ${item.title} (${item.memberCount})`,
            `b:${msgId}:tg:${item.id}`
          )
          .row();
      } else {
        const isChecked = session.selectedDestinationIds.has(item.id);
        keyboard
          .text(`${isChecked ? '✅ ' : '◻️ '}📢 ${item.title}`, `b:${msgId}:td:${item.id}`)
          .row();
      }
    }

    // Pagination controls if more than 1 page
    if (totalPages > 1) {
      const prevPage = currentPage > 1 ? currentPage - 1 : totalPages;
      const nextPage = currentPage < totalPages ? currentPage + 1 : 1;

      keyboard
        .text('◀️ Prev', `b:${msgId}:dp:${prevPage}`)
        .text(`[ ${currentPage}/${totalPages} ]`, `b:${msgId}:menu`)
        .text('Next ▶️', `b:${msgId}:dp:${nextPage}`)
        .row();
    }

    // Bulk actions and Add Channel
    keyboard
      .text('✅ Select All', `b:${msgId}:d_all`)
      .text('🧹 Clear All', `b:${msgId}:d_clr`)
      .row()
      .text('➕ Add Channel', 'nav:add_dest')
      .text('← Back to Editor', `b:${msgId}:menu`);

    return { text, keyboard };
  }

  // ==========================================
  // 9. DESTINATIONS LIST (MAIN MENU BROWSING)
  // ==========================================

  public static async renderDestinationList(page = 1): Promise<{
    text: string;
    keyboard: InlineKeyboard;
  }> {
    if (!this.isDbReady()) return this.renderDbOffline();
    const destinations = await Destination.find().sort({ title: 1 });

    if (destinations.length === 0) {
      const text =
        `📢 <b>Channels & Groups</b>\n\n` +
        `No channels or groups connected yet.\n\n` +
        `Add your Telegram channels and groups to start forwarding and broadcasting:`;
      const keyboard = new InlineKeyboard()
        .text('➕ Add Channel / Group', 'nav:add_dest')
        .row()
        .text('← Back to Main Menu', 'nav:main');
      return { text, keyboard };
    }

    const totalPages = Math.max(1, Math.ceil(destinations.length / LIST_PAGE_SIZE));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * LIST_PAGE_SIZE;
    const pageItems = destinations.slice(startIndex, startIndex + LIST_PAGE_SIZE);

    let text =
      `📢 <b>Channels & Groups (${destinations.length})</b>\n\n` +
      `📢 Channel • 👥 Group • 🔴 Offline\n\n`;

    const keyboard = new InlineKeyboard();

    for (const d of pageItems) {
      const isGroup = (d as any).type === 'group' || (d as any).type === 'supergroup';
      const typeIcon = isGroup ? '👥' : '📢';
      const statusIcon = !d.verification?.canPublish && d.status === 'invalid' ? '🔴' : typeIcon;
      const label = this.formatDestinationLabel(d);
      text += `${typeIcon} <b>${this.escapeHtml(label)}</b>\n`;
      keyboard.text(`${statusIcon} ${label}`, `v:dest:${d._id.toString()}`).row();
    }

    if (totalPages > 1) {
      const prevPage = currentPage > 1 ? currentPage - 1 : totalPages;
      const nextPage = currentPage < totalPages ? currentPage + 1 : 1;
      keyboard
        .text('◀️ Prev', `nav:dst:${prevPage}`)
        .text(`[ ${currentPage}/${totalPages} ]`, 'nav:dests')
        .text('Next ▶️', `nav:dst:${nextPage}`)
        .row();
    }

    keyboard
      .text('➕ Add Channel / Group', 'nav:add_dest')
      .text('🔄 Verify All', 'dest:vfy_all')
      .row()
      .text('← Back to Main Menu', 'nav:main');

    return { text, keyboard };
  }

  public static renderAddDestinationPrompt(botUsername: string): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const channelDeepLink = `https://t.me/${botUsername}?startchannel=true`;
    const groupDeepLink = `https://t.me/${botUsername}?startgroup=true`;

    const text =
      `<blockquote>📢 <b>CONNECT CHANNELS & GROUPS (GC)</b>\n` +
      `<i>Fast 1-Tap Connection Setup</i></blockquote>\n\n` +
      `Choose any convenient method below to connect your destination:\n\n` +
      `1️⃣ <b>1-Tap Pick from Your Telegram List:</b>\n` +
      `Tap <b>"📢 Pick Channel"</b> or <b>"👥 Pick Group / GC"</b> below to select ANY channel or group you are joined in.\n\n` +
      `2️⃣ <b>Forward Any Post (Fastest):</b>\n` +
      `Simply forward any message from your channel or group directly into this chat! The bot will instantly link and verify it.\n\n` +
      `3️⃣ <b>Send Channel @Username:</b>\n` +
      `Send your channel's public username (e.g. <code>@MyChannel</code>) or numeric Chat ID in chat.\n\n` +
      `<blockquote>🔑 <b>Permissions Info:</b>\n` +
      `• 👥 <b>Groups & Supergroups:</b> Bot ka admin hona zaroori nahi hai! Normal member banakar add karoge to bhi messages send ho jayenge.\n` +
      `• 📢 <b>Channels:</b> Bot ko Admin banana padega (Telegram rule: Channel me sirf Admins post kar sakte hain).</blockquote>`;

    const keyboard = new InlineKeyboard()
      .url('📢 Pick Channel (All Channels)', channelDeepLink)
      .row()
      .url('👥 Pick Group / GC (All Groups)', groupDeepLink)
      .row()
      .text('📖 Permissions Guide', 'help:admin_perms')
      .text('← Back to Channels', 'nav:dests');

    return { text, keyboard };
  }

  public static renderPermissionGuidePrompt(): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const text =
      `<blockquote>📖 <b>ADMIN PERMISSIONS GUIDE</b>\n` +
      `<i>Recommended privileges for reliable broadcasting</i></blockquote>\n\n` +
      `To ensure uninterrupted publishing and post updates, kindly grant these permissions to the bot:\n\n` +
      `<blockquote>🔑 <b>Essential Permissions:</b>\n` +
      `• ✍️ <b>Post Messages:</b> Compulsory to send broadcasts\n` +
      `• ✏️ <b>Edit Messages:</b> Recommended for updating captions and buttons\n` +
      `• 🗑️ <b>Delete Messages:</b> Recommended for post recalls and cleanup\n` +
      `• 📌 <b>Pin Messages:</b> Optional for pinning important updates</blockquote>\n\n` +
      `<blockquote>🔒 <b>Permissions You Can Safely Keep OFF:</b>\n` +
      `• ❌ Add New Admins: Not required\n` +
      `• ❌ Manage Video Chats: Not required\n` +
      `• ❌ Change Channel Info: Not required</blockquote>\n\n` +
      `<i>Tap below to proceed with connecting your channel:</i>`;

    const keyboard = new InlineKeyboard()
      .text('➕ Back to Add Channel', 'nav:add_dest')
      .row()
      .text('🎯 View Channels', 'nav:dests');

    return { text, keyboard };
  }

  public static renderConfirmDeleteDestination(dest: IDestination): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const destId = dest._id.toString();
    const text =
      `🗑 <b>DISCONNECT DESTINATION</b>\n\n` +
      `Are you sure you want to disconnect channel <b>${this.escapeHtml(dest.title)}</b> (<code>${dest.telegramChatId}</code>)?\n\n` +
      `<i>The bot will no longer broadcast messages to this target.</i>`;

    const keyboard = new InlineKeyboard()
      .text('❌ Confirm Disconnect', `dest:del_do:${destId}`)
      .row()
      .text('← Keep Destination', `v:dest:${destId}`);

    return { text, keyboard };
  }

  // ==========================================
  // 10. DESTINATION DETAILS VIEW
  // ==========================================

  public static renderDestinationDetails(dest: IDestination): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const canPublish = dest.verification?.canPublish;
    const statusIcon = canPublish
      ? '🟢 Active'
      : dest.status === 'invalid'
        ? '🔴 Invalid'
        : '🟡 Needs Verification';

    let senderIdentityDesc = 'Bot Identity';
    let identityExplanation = 'Posts appear from the Bot account';

    if (dest.verification?.senderIdentity === 'channel') {
      senderIdentityDesc = 'Channel Identity 📢';
      identityExplanation = 'Broadcast channel posts inherently publish under the channel name';
    } else if (dest.verification?.senderIdentity === 'anonymous_admin') {
      senderIdentityDesc = 'Anonymous Administrator 🛡️';
      identityExplanation =
        'Bot is configured as anonymous group administrator; posts appear as group';
    } else if (dest.type === 'supergroup' || dest.type === 'group') {
      senderIdentityDesc = 'Standard Bot (Bot Identity)';
      identityExplanation =
        'Bot publishes as bot member (anonymous admin rights not granted in group)';
    }

    const text =
      `📢 <b>CHANNEL / GROUP DETAILS</b>\n\n` +
      `<b>Title:</b> ${this.escapeHtml(dest.title)}\n` +
      (dest.displayName ? `<b>Display Name:</b> ${this.escapeHtml(dest.displayName)}\n` : '') +
      `<b>Chat ID:</b> <code>${dest.telegramChatId}</code>\n` +
      `<b>Type:</b> ${dest.type.toUpperCase()}\n` +
      `<b>Status:</b> ${statusIcon}\n` +
      `<b>Identity:</b> ${senderIdentityDesc}\n` +
      `<b>Bot Role:</b> <code>${dest.verification?.botRole || 'unknown'}</code>\n` +
      `<b>Can Send:</b> ${canPublish ? '✅ Yes' : '❌ No'}\n\n` +
      `💡 <i>${identityExplanation}</i>\n\n` +
      (dest.verification?.failureReason
        ? `⚠️ <b>Failure Reason:</b> ${this.escapeHtml(dest.verification.failureReason)}\n\n`
        : '') +
      `<i>Display names and permissions can also be managed in the Admin Panel.</i>`;

    const destId = dest._id ? dest._id.toString() : '';
    const keyboard = new InlineKeyboard();

    if (destId) {
      keyboard
        .text('✏️ Rename', `dest:rename:${destId}`)
        .text('🔄 Verify Rights', `dest:vfy:${destId}`)
        .row()
        .text('🗑 Disconnect Channel', `dest:del_ask:${destId}`)
        .row();
    }

    keyboard.text('← Back to Channels & Groups', 'nav:dests').text('⌂ Main Menu', 'nav:main');

    return { text, keyboard };
  }

  public static renderRenameDestinationPrompt(dest: IDestination): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const destId = dest._id ? dest._id.toString() : '';
    const text =
      `<blockquote>✏️ <b>RENAME CHANNEL</b>\n` +
      `<i>Update custom channel display label</i></blockquote>\n\n` +
      `Channel: <b>${this.escapeHtml(dest.title)}</b>\n` +
      (dest.displayName
        ? `Current Display Name: <b>${this.escapeHtml(dest.displayName)}</b>\n`
        : '') +
      `Chat ID: <code>${dest.telegramChatId}</code>\n\n` +
      `<i>Send the new display name for this channel now:</i>`;

    const keyboard = new InlineKeyboard().text('❌ Cancel', `v:dest:${destId}`);
    return { text, keyboard };
  }

  // ==========================================
  // 11. RECENT POSTS LIST
  // ==========================================

  public static async renderRecentPosts(page = 1): Promise<{
    text: string;
    keyboard: InlineKeyboard;
  }> {
    if (!this.isDbReady()) return this.renderDbOffline();
    const { Message } = await import('../../models/message.model.js');
    const totalCount = await Message.countDocuments();
    const pageSize = 8;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const skip = (currentPage - 1) * pageSize;

    const posts = await Message.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize);

    const [publishedCount, partialCount, failedCount, draftCount] = await Promise.all([
      Message.countDocuments({ status: 'published' }),
      Message.countDocuments({ status: 'partially_published' }),
      Message.countDocuments({ status: 'failed' }),
      Message.countDocuments({ status: 'draft' }),
    ]);

    if (posts.length === 0) {
      const text =
        `📜 <b>History & Logs</b>\n\n` +
        `<i>No posts found in history.</i>\n\n` +
        `Create and publish your first post to see delivery logs and statistics:`;
      const keyboard = new InlineKeyboard()
        .text('✍️ New Post', 'nav:new')
        .row()
        .text('🔄 Refresh', 'nav:recent')
        .text('← Back to Main Menu', 'nav:main');
      return { text, keyboard };
    }

    const text =
      `📜 <b>History & Logs</b>\n` +
      `<i>Page ${currentPage} of ${totalPages} • Total: ${totalCount}</i>\n\n` +
      `📊 <b>Delivery Status:</b>\n` +
      `🟢 Sent: <b>${publishedCount}</b>  •  🟡 Partial: <b>${partialCount}</b>\n` +
      `🔴 Failed: <b>${failedCount}</b>  •  📝 Drafts: <b>${draftCount}</b>\n\n` +
      `<i>Tap any post below to inspect delivery details or repost:</i>`;

    const keyboard = new InlineKeyboard();

    for (const p of posts) {
      const statusIcon =
        p.status === 'published'
          ? '🟢'
          : p.status === 'partially_published'
            ? '🟡'
            : p.status === 'failed'
              ? '🔴'
              : '📝';

      const typeIcon =
        p.messageType === 'photo'
          ? '🖼'
          : p.messageType === 'video'
            ? '📹'
            : p.messageType === 'document'
              ? '📄'
              : '💬';

      const timeStr = p.createdAt.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const dateStr = p.createdAt.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      });

      const rawSnippet = (p.content.text || `[${p.messageType.toUpperCase()}]`)
        .replace(/\n+/g, ' ')
        .trim();
      const snippet = rawSnippet.length > 18 ? rawSnippet.substring(0, 18) + '…' : rawSnippet;
      const targetCount = p.deliverySummary?.targetCount ?? 0;

      const label = `${statusIcon} ${typeIcon} [${dateStr} ${timeStr}] ${snippet} • ${targetCount}🎯`;
      keyboard.text(label, `v:post:${p._id.toString()}`).row();
    }

    if (totalPages > 1) {
      const prevPage = currentPage > 1 ? currentPage - 1 : totalPages;
      const nextPage = currentPage < totalPages ? currentPage + 1 : 1;
      keyboard
        .text('◀️ Prev', `nav:recent_p:${prevPage}`)
        .text(`[ ${currentPage}/${totalPages} ]`, 'nav:recent')
        .text('Next ▶️', `nav:recent_p:${nextPage}`)
        .row();
    }

    keyboard
      .text('🔄 Refresh Feed', 'nav:recent')
      .text('🚀 New Broadcast', 'nav:new')
      .row()
      .text('← Back to Main Menu', 'nav:main');

    return { text, keyboard };
  }

  // ==========================================
  // 12. POST DETAILS VIEW
  // ==========================================

  public static async renderPostDetails(message: IMessage): Promise<{
    text: string;
    keyboard: InlineKeyboard;
  }> {
    const msgId = message._id.toString();

    let categoryHtml = 'None';
    if (message.categoryId) {
      const cat = await Category.findById(message.categoryId);
      if (cat) categoryHtml = this.formatCategoryHtml(cat);
    }

    const preview = this.formatContentPreview(message);

    const statusBadge =
      message.status === 'published'
        ? '🟢 Published'
        : message.status === 'partially_published'
          ? '🟡 Partially Published'
          : message.status === 'failed'
            ? '🔴 Failed'
            : '📝 Draft';

    const delivery = message.deliverySummary;

    const text =
      `📋 <b>POST DETAILS</b>\n\n` +
      `<b>ID:</b> <code>${msgId.slice(-8)}</code>\n` +
      `<b>Status:</b> ${statusBadge}\n` +
      `<b>Category:</b> ${categoryHtml}\n` +
      `<b>Type:</b> ${message.messageType.toUpperCase()}\n` +
      `<b>Created:</b> ${message.createdAt.toLocaleString()}\n\n` +
      `<b>Content:</b>\n${preview}\n\n` +
      `<b>Delivery Summary:</b>\n` +
      `• Targets: ${delivery.targetCount}\n` +
      `• Successful: ${delivery.successfulDestinationIds.length}\n` +
      `• Failed: ${delivery.failedDestinationIds.length}\n` +
      (delivery.lastAttemptedAt
        ? `• Last Attempt: ${new Date(delivery.lastAttemptedAt).toLocaleTimeString()}\n`
        : '');

    const keyboard = new InlineKeyboard();

    if (message.status === 'draft') {
      keyboard
        .text('✏️ Open in Editor', `dr:open:${msgId}`)
        .text('🗑 Delete Draft', `dr:del:${msgId}`)
        .row();
    } else {
      if (delivery.failedDestinationIds.length > 0) {
        keyboard
          .text(`🔁 Retry Failed (${delivery.failedDestinationIds.length})`, `b:${msgId}:retry`)
          .row();
      }
      keyboard.text('🗑 Delete from History', `post:del_ask:${msgId}`).row();
    }

    keyboard.text('← Back to Recent Posts', 'nav:recent').text('⌂ Main Menu', 'nav:main');

    return { text, keyboard };
  }

  public static renderConfirmDeletePost(message: IMessage): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const msgId = message._id.toString();
    const text =
      `🗑 <b>DELETE POST RECORD</b>\n\n` +
      `Are you sure you want to permanently delete post record <code>${msgId.slice(-8)}</code>?\n\n` +
      `<i>This will remove the post entry and logs from the system history.</i>`;

    const keyboard = new InlineKeyboard()
      .text('❌ Confirm Delete', `post:del_do:${msgId}`)
      .row()
      .text('← Keep Post', `v:post:${msgId}`);

    return { text, keyboard };
  }

  // ==========================================
  // 13. DRAFTS VIEW
  // ==========================================

  public static async renderDrafts(): Promise<{
    text: string;
    keyboard: InlineKeyboard;
  }> {
    if (!this.isDbReady()) return this.renderDbOffline();
    const { Message } = await import('../../models/message.model.js');
    const drafts = await Message.find({ status: 'draft' }).sort({ createdAt: -1 }).limit(10);

    if (drafts.length === 0) {
      const text =
        `<blockquote><b>SAVED DRAFTS</b>\n` +
        `<i>No unpublished drafts found</i></blockquote>\n\n` +
        `No drafts saved in storage.\nSend any message or media to create a new draft.`;
      const keyboard = new InlineKeyboard()
        .text('✍️ Create New Post', 'nav:new')
        .row()
        .text('← Back to Main Menu', 'nav:main');
      return { text, keyboard };
    }

    const text =
      `<blockquote><b>SAVED DRAFTS</b>\n` +
      `<i>${drafts.length} saved post draft${drafts.length === 1 ? '' : 's'} in storage</i></blockquote>\n\n` +
      `<i>Tap <b>👁 View</b> to inspect full text & media, or tap draft title to edit & publish:</i>`;

    const keyboard = new InlineKeyboard();

    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i]!;
      const msgId = d._id.toString();
      const rawText = (d.content.text || '').trim();
      const snippet = rawText
        ? rawText.length > 14
          ? rawText.slice(0, 12) + '..'
          : rawText
        : d.messageType.toUpperCase();

      keyboard
        .text(`${i + 1}. ${snippet || 'Draft'}`, `dr:open:${msgId}`)
        .text('👁 View', `dr:view:${msgId}`)
        .text('🗑', `dr:del:${msgId}`)
        .row();
    }

    keyboard
      .text('✍️ Create New Post', 'nav:new')
      .row()
      .text('← Back to Main Menu', 'nav:main');

    return { text, keyboard };
  }

  public static renderDraftView(draft: any): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const rawText = (draft.content?.text || '').trim();
    const mediaCount = draft.content?.mediaItems?.length || 0;
    const dateStr = new Date(draft.createdAt).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    let text =
      `<blockquote><b>DRAFT PREVIEW</b>\n` +
      `<i>Created on ${dateStr}</i></blockquote>\n\n`;

    if (rawText) {
      text += `<b>Full Post Content:</b>\n<blockquote>${this.escapeHtml(rawText)}</blockquote>\n\n`;
    } else {
      text += `<i>(No text caption attached)</i>\n\n`;
    }

    if (mediaCount > 0) {
      text += `📎 <b>Attached Media:</b> <code>${mediaCount} item(s)</code> (${draft.messageType.toUpperCase()})\n\n`;
    }

    text += `<i>Select an action below:</i>`;

    const keyboard = new InlineKeyboard()
      .text('🚀 Open in Editor & Publish', `dr:open:${draft._id.toString()}`)
      .row()
      .text('🗑 Delete Draft', `dr:del:${draft._id.toString()}`)
      .text('← Back to Drafts', 'nav:drafts');

    return { text, keyboard };
  }

  // ==========================================
  // 13b. INBOUND APPROVAL QUEUE
  // ==========================================

  public static async renderPendingApprovals(page = 1): Promise<{
    text: string;
    keyboard: InlineKeyboard;
  }> {
    if (!this.isDbReady()) return this.renderDbOffline();
    const { Message } = await import('../../models/message.model.js');
    const limit = 8;
    const skip = (page - 1) * limit;

    const [pendingPosts, total] = await Promise.all([
      Message.find({ status: 'pending_approval' }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Message.countDocuments({ status: 'pending_approval' }),
    ]);

    if (pendingPosts.length === 0) {
      const text =
        `📥 <b>Inbound Approval Queue</b>\n\n` +
        `✅ All clear! There are no inbound posts awaiting approval.\n\n` +
        `Messages forwarded from monitored source channels that require manual moderation will appear here.`;
      const keyboard = new InlineKeyboard().text('← Back to Main Menu', 'nav:main');
      return { text, keyboard };
    }

    const totalPages = Math.ceil(total / limit) || 1;
    const text =
      `📥 <b>Inbound Approval Queue (${total})</b>\n\n` +
      `<i>Tap any post to review content, approve release, or discard:</i>\n\n`;

    const keyboard = new InlineKeyboard();

    for (const post of pendingPosts) {
      const msgId = post._id.toString();
      const snippet = (post.content.text || `[${post.messageType.toUpperCase()}]`)
        .trim()
        .substring(0, 20);
      const sourceStr = post.telegramChatId ? `[${post.telegramChatId}]` : '';
      keyboard.text(`⏳ ${snippet || 'Inbound'} ${sourceStr}`, `appr:view:${msgId}`).row();
    }

    if (totalPages > 1) {
      const prevPage = page > 1 ? page - 1 : totalPages;
      const nextPage = page < totalPages ? page + 1 : 1;
      keyboard
        .text('◀️ Prev', `nav:appr:${prevPage}`)
        .text(`[ ${page}/${totalPages} ]`, 'nav:approvals')
        .text('Next ▶️', `nav:appr:${nextPage}`)
        .row();
    }

    keyboard.text('← Back to Main Menu', 'nav:main');

    return { text, keyboard };
  }

  public static async renderPendingApprovalDetails(message: IMessage): Promise<{
    text: string;
    keyboard: InlineKeyboard;
  }> {
    const msgId = message._id.toString();

    let categoryHtml = 'None';
    if (message.categoryId) {
      const cat = await Category.findById(message.categoryId);
      if (cat) categoryHtml = this.formatCategoryHtml(cat);
    }

    const preview = this.formatContentPreview(message);

    const text =
      `📥 <b>INBOUND APPROVAL REVIEW</b>\n\n` +
      `<b>ID:</b> <code>${msgId.slice(-8)}</code>\n` +
      `<b>Source Chat:</b> <code>${message.telegramChatId || 'Unknown'}</code>\n` +
      (message.telegramMessageId
        ? `<b>Source Msg ID:</b> <code>#${message.telegramMessageId}</code>\n`
        : '') +
      `<b>Category:</b> ${categoryHtml}\n` +
      `<b>Type:</b> ${message.messageType.toUpperCase()}\n` +
      `<b>Received:</b> ${message.createdAt.toLocaleString()}\n\n` +
      `<b>Content Preview:</b>\n${preview}\n\n` +
      `<i>Choose an action to moderate this post:</i>`;

    const keyboard = new InlineKeyboard()
      .text('🚀 Approve & Publish Now', `appr:pub:${msgId}`)
      .row()
      .text('✏️ Open in Editor', `dr:open:${msgId}`)
      .text('🗑 Discard / Reject', `appr:rej:${msgId}`)
      .row()
      .text('← Back to Approvals', 'nav:approvals')
      .text('⌂ Main Menu', 'nav:main');

    return { text, keyboard };
  }

  // ==========================================
  // 14. DRAFT DELETE CONFIRMATION
  // ==========================================

  public static renderDraftDeleteConfirm(messageId: string): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const text =
      `🗑 <b>DELETE DRAFT</b>\n\n` +
      `Are you sure you want to permanently delete draft <code>${messageId.slice(-8)}</code>?`;

    const keyboard = new InlineKeyboard()
      .text('🗑 Confirm Delete', `dr:cdel:${messageId}`)
      .row()
      .text('← Back to Drafts', 'nav:drafts');

    return { text, keyboard };
  }

  // ==========================================
  // 15. PUBLISH ACTIVITY / LOGS VIEW
  // ==========================================

  public static async renderActivity(): Promise<{
    text: string;
    keyboard: InlineKeyboard;
  }> {
    if (!this.isDbReady()) return this.renderDbOffline();
    const { PublishLog } = await import('../../models/publish-log.model.js');
    const [logs, totalCount, successCount] = await Promise.all([
      PublishLog.find().sort({ createdAt: -1 }).limit(6),
      PublishLog.countDocuments(),
      PublishLog.countDocuments({ status: 'success' }),
    ]);

    if (logs.length === 0) {
      const text =
        `<blockquote>📊 <b>BROADCAST ACTIVITY & LIVE METRICS</b>\n` +
        `<i>Real-Time Delivery & Dispatch Logs</i></blockquote>\n\n` +
        `No publishing logs recorded yet.\n` +
        `Broadcast posts to see live delivery metrics and latency here.`;
      const keyboard = new InlineKeyboard().text('← Back to Main Menu', 'nav:main');
      return { text, keyboard };
    }

    const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
    const destIds = logs.map((l) => l.destinationId);
    const dests = await Destination.find({ _id: { $in: destIds } });
    const destMap = new Map(dests.map((d) => [d._id.toString(), d.title]));

    let text =
      `<blockquote>📊 <b>BROADCAST ACTIVITY & LIVE METRICS</b>\n` +
      `<i>Real-Time Delivery & Node Latency</i></blockquote>\n\n` +
      `<blockquote>📈 <b>Performance Overview:</b>\n` +
      `• Total Dispatches: <b>${totalCount}</b>\n` +
      `• Delivery Success Rate: <b>${successRate}%</b>\n` +
      `• Active Nodes: <b>${destMap.size}</b> channel(s)</blockquote>\n\n` +
      `<b>Recent Delivery Records:</b>\n`;

    for (const log of logs) {
      const destName = destMap.get(log.destinationId.toString()) || 'Destination';
      const timeStr = new Date(log.createdAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const statusIcon = log.status === 'success' ? '✅' : '❌';
      const errNote = log.error?.message ? `\n   ⚠️ <i>${log.error.message.substring(0, 35)}</i>` : '';

      text += `${statusIcon} <b>${this.escapeHtml(destName)}</b> • <code>${log.publishMode.toUpperCase()}</code> (⚡ ${log.executionTimeMs}ms)\n` +
              `   🕒 ${timeStr}${errNote}\n\n`;
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh Activity', 'nav:activity')
      .row()
      .text('← Back to Main Menu', 'nav:main');
    return { text, keyboard };
  }

  // ==========================================
  // 16. SETTINGS VIEW
  // ==========================================

  public static renderSettings(): { text: string; keyboard: InlineKeyboard } {
    const text =
      `⚙️ <b>SETTINGS & SYSTEM HEALTH</b>\n\n` +
      `<b>Publishing Engine:</b>\n` +
      `• Architecture: Redis + BullMQ Queue Pipeline\n` +
      `• Database: MongoDB (Single Source of Truth)\n` +
      `• Inbound Ingestion: grammY polling / Webhook\n` +
      `• Delivery Semantics: Copy & Forward supported\n\n` +
      `<b>Identity Security:</b>\n` +
      `• Private admin identities are never exposed\n` +
      `• Channel posts broadcast under Channel identity\n` +
      `• Supergroups support Anonymous Admin capability\n\n` +
      `<i>Full configuration options are available in the Web Panel.</i>`;

    const keyboard = new InlineKeyboard().text('← Back to Main Menu', 'nav:main');
    return { text, keyboard };
  }

  // ==========================================
  // 17. HELP VIEW
  // ==========================================

  public static renderHelp(): { text: string; keyboard: InlineKeyboard } {
    const text =
      `❓ <b>HELP & COMMANDS GUIDE</b>\n\n` +
      `<b>Main Commands:</b>\n` +
      `• 🏠 <b>/start</b> — Dashboard & Main Menu\n` +
      `• ✍️ <b>/new</b> — Create New Post\n` +
      `• 📢 <b>/channels</b> — Channels & Groups\n` +
      `• 📁 <b>/categories</b> — Categories\n` +
      `• ⚡ <b>/rules</b> — Forward Rules\n` +
      `• 🕒 <b>/scheduled</b> — Scheduled Posts\n` +
      `• 📜 <b>/history</b> — History & Logs\n` +
      `• 📝 <b>/drafts</b> — Saved Drafts\n` +
      `• ❓ <b>/help</b> — Show this help manual\n` +
      `• ❌ <b>/cancel</b> — Cancel any active action\n\n` +
      `💡 <i>Tip: Forward or send any message/photo/video directly to this bot to quickly send it to your channels and groups!</i>`;

    const keyboard = new InlineKeyboard().text('← Back to Main Menu', 'nav:main');
    return { text, keyboard };
  }

  // ==========================================
  // 18. EXPIRED SESSION NOTICE
  // ==========================================

  public static renderExpiredNotice(): { text: string; keyboard: InlineKeyboard } {
    const text =
      `⚠️ <b>This action has expired.</b>\n\n` +
      `The session is no longer active. Please start again from the Main Menu:`;

    const keyboard = new InlineKeyboard().text('⌂ Main Menu', 'nav:main');
    return { text, keyboard };
  }

  // ==========================================
  // 19. PUBLISH CONFIRMATION
  // ==========================================

  public static async renderPublishConfirmation(
    message: IMessage,
    session: BotPostSession,
    resolvedDestinations: Array<{ title: string; telegramChatId: string }>
  ): Promise<{ text: string; keyboard: InlineKeyboard }> {
    const msgId = message._id.toString();

    let categoryHtml = 'None';
    if (session.categoryId) {
      const cat = await Category.findById(session.categoryId);
      if (cat) categoryHtml = this.formatCategoryHtml(cat);
    }

    const preview = this.formatContentPreview(message);

    const destList = resolvedDestinations
      .map((d) => `  • <b>${this.escapeHtml(d.title)}</b> ✅`)
      .join('\n');

    const modeText =
      session.publishMode === 'forward'
        ? 'Forward (Preserves Source Attribution)'
        : 'Copy (Clean Post)';

    const text =
      `🚀 <b>READY TO PUBLISH</b>\n\n` +
      `${preview}\n\n` +
      `📁 <b>Category:</b> ${categoryHtml}\n` +
      `📤 <b>Mode:</b> ${modeText}\n` +
      `🎯 <b>Destinations (${resolvedDestinations.length}):</b>\n${destList}\n\n` +
      `Are you sure you want to broadcast this post now?`;

    const keyboard = new InlineKeyboard()
      .text('✅ Publish Now', `b:${msgId}:confirm_pub`)
      .row()
      .text('👁 Preview', `b:${msgId}:preview`)
      .text('← Back to Editor', `b:${msgId}:menu`);

    return { text, keyboard };
  }

  // ==========================================
  // 20. SCHEDULE WORKFLOW (PHASE 4 REAL SCHEDULING)
  // ==========================================

  public static getLocalDateString(offsetDays = 0, tz = 'Asia/Kolkata'): string {
    const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
    return d.toLocaleDateString('en-CA', { timeZone: tz }); // Returns YYYY-MM-DD
  }

  public static renderScheduleTimeAdjuster(
    message: IMessage,
    session: BotPostSession
  ): { text: string; keyboard: InlineKeyboard } {
    const msgId = message._id.toString();
    const tz = session.scheduleTimezone || 'Asia/Kolkata';

    // Defaults if not set
    if (!session.scheduleDate) {
      session.scheduleDate = this.getLocalDateString(0, tz);
    }
    if (!session.scheduleTime) {
      const now = new Date();
      const currentHour = now.getHours();
      const nextHour = (currentHour + 1) % 24;
      session.scheduleTime = `${String(nextHour).padStart(2, '0')}:00`;
    }

    const dateStr = session.scheduleDate;
    const timeStr = session.scheduleTime;

    const todayStr = this.getLocalDateString(0, tz);
    const tomorrowStr = this.getLocalDateString(1, tz);
    const dayAfterStr = this.getLocalDateString(2, tz);
    let dayLabel = dateStr;
    if (dateStr === todayStr) dayLabel = 'Today';
    else if (dateStr === tomorrowStr) dayLabel = 'Tomorrow';
    else if (dateStr === dayAfterStr) dayLabel = 'Day After';

    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr || '0', 10);
    const m = parseInt(mStr || '0', 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const formatted12 = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;

    const text =
      `<blockquote>🕒 <b>SCHEDULE POST</b>\n` +
      `<i>Choose when to broadcast this post</i></blockquote>\n\n` +
      `<blockquote>📅 <b>Scheduled Broadcast:</b> <b>${dayLabel}, ${formatted12}</b> <code>(${timeStr} IST)</code></blockquote>\n\n` +
      `<i>Tap buttons below to change date or time directly:</i>`;

    const isToday = dateStr === todayStr;
    const isTomorrow = dateStr === tomorrowStr;
    const isDayAfter = dateStr === dayAfterStr;

    const keyboard = new InlineKeyboard()
      .text(`${isToday ? '🔘 ' : ''}📅 Today`, `b:${msgId}:sd:${todayStr}`)
      .text(`${isTomorrow ? '🔘 ' : ''}📅 Tomorrow`, `b:${msgId}:sd:${tomorrowStr}`)
      .text(`${isDayAfter ? '🔘 ' : ''}🗓 Day After`, `b:${msgId}:sd:${dayAfterStr}`)
      .row()
      .text('➖ 1 Hour', `b:${msgId}:adj_h:-1`)
      .text(`⏰ ${h12} ${ampm}`, `b:${msgId}:adj_h:0`)
      .text('➕ 1 Hour', `b:${msgId}:adj_h:1`)
      .row()
      .text('➖ 15m', `b:${msgId}:adj_m:-15`)
      .text('➖ 1m', `b:${msgId}:adj_m:-1`)
      .text(`⏱ :${String(m).padStart(2, '0')}`, `b:${msgId}:adj_m:0`)
      .text('➕ 1m', `b:${msgId}:adj_m:1`)
      .text('➕ 15m', `b:${msgId}:adj_m:15`)
      .row()
      .text(`🚀 Confirm & Schedule (${dayLabel}, ${formatted12})`, `b:${msgId}:adj_confirm`)
      .row()
      .text('← Back to Editor', `b:${msgId}:menu`);

    return { text, keyboard };
  }

  public static renderScheduleDatePicker(
    message: IMessage,
    session: BotPostSession
  ): { text: string; keyboard: InlineKeyboard } {
    return this.renderScheduleTimeAdjuster(message, session);
  }

  public static renderScheduleTimezonePicker(
    message: IMessage,
    _session: BotPostSession
  ): { text: string; keyboard: InlineKeyboard } {
    const msgId = message._id.toString();

    const text =
      `🌐 <b>Schedule Timezone</b>\n\n` +
      `Choose your preferred timezone for scheduling:\n\n` +
      `<i>All schedules will calculate publication triggers according to this timezone.</i>`;

    const keyboard = new InlineKeyboard()
      .text('🇮🇳 Asia/Kolkata (IST)', `b:${msgId}:stz:Asia/Kolkata`)
      .row()
      .text('🌍 UTC (Coordinated Universal Time)', `b:${msgId}:stz:UTC`)
      .row()
      .text('🇺🇸 America/New_York (EST/EDT)', `b:${msgId}:stz:America/New_York`)
      .row()
      .text('🇬🇧 Europe/London (GMT/BST)', `b:${msgId}:stz:Europe/London`)
      .row()
      .text('🇦🇪 Asia/Dubai (GST)', `b:${msgId}:stz:Asia/Dubai`)
      .row()
      .text('← Back to Date', `b:${msgId}:sch`);

    return { text, keyboard };
  }

  public static renderScheduleTimePicker(
    message: IMessage,
    session: BotPostSession
  ): { text: string; keyboard: InlineKeyboard } {
    return this.renderScheduleTimeAdjuster(message, session);
  }

  public static renderCustomSchedulePrompt(
    message: IMessage,
    tz = 'Asia/Kolkata'
  ): { text: string; keyboard: InlineKeyboard } {
    const msgId = message._id.toString();
    const text =
      `<blockquote>⌨️ <b>CUSTOM DATE & TIME</b>\n` +
      `<i>Desired broadcast delivery schedule</i></blockquote>\n\n` +
      `Enter your desired broadcast timing:\n\n` +
      `<blockquote>📌 <b>Accepted Formats:</b>\n` +
      `• <code>tomorrow 15:30</code> <i>(Tomorrow at 3:30 PM)</i>\n` +
      `• <code>2026-09-29 18:00</code> <i>(Full Date & 24h Time)</i>\n` +
      `• <code>19:45</code> <i>(Today at 7:45 PM)</i>\n` +
      `• <code>in 45 mins</code> or <code>45m</code> <i>(Relative delay)</i>\n` +
      `• <code>in 2 hours</code> or <code>2h</code>\n` +
      `🌐 <b>Active Timezone:</b> <code>${tz}</code></blockquote>\n\n` +
      `<i>Type and send your desired date/time in chat:</i>`;

    const keyboard = new InlineKeyboard()
      .text('← Back to Presets', `b:${msgId}:sch`)
      .text('❌ Cancel', `b:${msgId}:menu`);

    return { text, keyboard };
  }

  public static async renderScheduleConfirmation(
    message: IMessage,
    session: BotPostSession,
    resolvedDestinations: Array<{ title: string; telegramChatId: string }>
  ): Promise<{ text: string; keyboard: InlineKeyboard }> {
    const msgId = message._id.toString();

    let categoryHtml = 'None';
    if (session.categoryId) {
      const cat = await Category.findById(session.categoryId);
      if (cat) categoryHtml = this.formatCategoryHtml(cat);
    }

    const preview = this.formatContentPreview(message);
    const destList = resolvedDestinations
      .map((d) => `  • <b>${this.escapeHtml(d.title)}</b>`)
      .join('\n');

    const modeText = session.publishMode === 'forward' ? '↪️ Forward' : '📤 Copy';
    const tz = session.scheduleTimezone || 'Asia/Kolkata';

    const text =
      `🕒 <b>SCHEDULE CONFIRMATION</b>\n\n` +
      `📦 ${preview}\n\n` +
      `📁 <b>Category:</b> ${categoryHtml}\n` +
      `🎯 <b>Destinations (${resolvedDestinations.length}):</b>\n${destList}\n` +
      `📤 <b>Mode:</b> ${modeText}\n\n` +
      `📅 <b>Date:</b> <code>${session.scheduleDate}</code>\n` +
      `🕒 <b>Time:</b> <code>${session.scheduleTime}</code>\n` +
      `🌐 <b>Timezone:</b> <code>${tz}</code>\n\n` +
      `<i>Tap Confirm to schedule this publication:</i>`;

    const keyboard = new InlineKeyboard()
      .text('✅ Confirm Schedule', `b:${msgId}:s_confirm`)
      .row()
      .text('✏️ Change Time', `b:${msgId}:sd:${session.scheduleDate || 'today'}`)
      .text('🎯 Change Targets', `b:${msgId}:view_dests`)
      .row()
      .text('❌ Cancel', `b:${msgId}:cnc`);

    return { text, keyboard };
  }

  public static renderScheduleSuccess(
    scheduledPost: IScheduledPost,
    message: IMessage
  ): { text: string; keyboard: InlineKeyboard } {
    const text =
      `✅ <b>POST SCHEDULED</b>\n\n` +
      `Your post has been queued for automated broadcast:\n\n` +
      `📦 ${this.formatContentPreview(message)}\n\n` +
      `📅 <b>Scheduled For:</b> ${scheduledPost.scheduledFor.toUTCString()}\n` +
      `🌐 <b>Timezone:</b> ${scheduledPost.timezone}\n` +
      `🎯 <b>Destinations:</b> ${scheduledPost.destinationIds.length}\n` +
      `📊 <b>Status:</b> 🟡 Scheduled\n\n` +
      `<i>The queue worker will execute publication automatically when due.</i>`;

    const keyboard = new InlineKeyboard()
      .text('🕒 View Scheduled', 'nav:scheduled')
      .text('⌂ Main Menu', 'nav:main');

    return { text, keyboard };
  }

  // ==========================================
  // 20b. SCHEDULED POSTS LIST (/scheduled)
  // ==========================================

  public static async renderScheduledList(page = 1): Promise<{
    text: string;
    keyboard: InlineKeyboard;
  }> {
    if (!this.isDbReady()) return this.renderDbOffline();
    const schedules = await ScheduledPost.find({
      status: { $in: ['scheduled', 'processing'] },
    }).sort({ scheduledFor: 1 });

    if (schedules.length === 0) {
      const text =
        `<blockquote>🕒 <b>Scheduled Posts</b>\n` +
        `<i>No scheduled posts currently queued</i></blockquote>\n\n` +
        `Create a post and schedule it with custom date & time anytime!`;
      const keyboard = new InlineKeyboard()
        .text('✍️ New Post', 'nav:new')
        .row()
        .text('🔄 Refresh Schedule', 'nav:scheduled')
        .text('← Back to Main Menu', 'nav:main');
      return { text, keyboard };
    }

    const totalPages = Math.max(1, Math.ceil(schedules.length / LIST_PAGE_SIZE));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * LIST_PAGE_SIZE;
    const pageItems = schedules.slice(startIndex, startIndex + LIST_PAGE_SIZE);

    const nowMs = Date.now();
    const text =
      `<blockquote>🕒 <b>Scheduled Posts</b>\n` +
      `<i>Queued Deliveries: ${schedules.length}</i></blockquote>\n\n` +
      `🟡 Scheduled  •  🔵 Processing\n\n` +
      `<i>Tap a scheduled post to inspect or cancel:</i>`;

    const keyboard = new InlineKeyboard();

    for (const item of pageItems) {
      const diffMs = item.scheduledFor.getTime() - nowMs;
      let relativeStr = '';
      if (diffMs > 0) {
        const diffMins = Math.round(diffMs / 60000);
        if (diffMins < 60) relativeStr = `in ${diffMins}m`;
        else if (diffMins < 1440) relativeStr = `in ${Math.round(diffMins / 60)}h`;
        else relativeStr = `in ${Math.round(diffMins / 1440)}d`;
      } else {
        relativeStr = 'Due now';
      }

      const timeStr = item.scheduledFor.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: item.timezone || 'Asia/Kolkata',
      });
      const dateStr = item.scheduledFor.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        timeZone: item.timezone || 'Asia/Kolkata',
      });

      const label = `🟡 ${dateStr} ${timeStr} (${relativeStr}) • ${item.destinationIds.length}🎯`;
      keyboard.text(label, `v:sch:${item._id.toString()}`).row();
    }

    if (totalPages > 1) {
      const prevPage = currentPage > 1 ? currentPage - 1 : totalPages;
      const nextPage = currentPage < totalPages ? currentPage + 1 : 1;
      keyboard
        .text('◀️ Prev', `nav:schp:${prevPage}`)
        .text(`[ ${currentPage}/${totalPages} ]`, 'nav:scheduled')
        .text('Next ▶️', `nav:schp:${nextPage}`)
        .row();
    }

    keyboard
      .text('🔄 Refresh Schedule', 'nav:scheduled')
      .text('🚀 New Broadcast', 'nav:new')
      .row()
      .text('← Back to Main Menu', 'nav:main');
    return { text, keyboard };
  }

  // ==========================================
  // 20c. SCHEDULE DETAILS VIEW
  // ==========================================

  public static async renderScheduleDetails(
    schedule: IScheduledPost,
    message: IMessage,
    resolvedDests?: IDestination[]
  ): Promise<{ text: string; keyboard: InlineKeyboard }> {
    const schId = schedule._id.toString();
    const preview = this.formatContentPreview(message);

    let categoryHtml = 'None';
    if (schedule.categoryId) {
      const cat = await Category.findById(schedule.categoryId);
      if (cat) categoryHtml = this.formatCategoryHtml(cat);
    }

    const dests =
      resolvedDests || (await Destination.find({ _id: { $in: schedule.destinationIds } }));
    const destLines = dests.length
      ? dests.map((d) => `  • <b>${this.escapeHtml(d.title)}</b>`).join('\n')
      : '  • None';

    let statusBadge = '🟡 Scheduled';
    if (schedule.status === 'processing') statusBadge = '🔵 Processing';
    else if (schedule.status === 'published') statusBadge = '🟢 Published';
    else if (schedule.status === 'partially_published') statusBadge = '🟠 Partial';
    else if (schedule.status === 'failed') statusBadge = '🔴 Failed';
    else if (schedule.status === 'cancelled') statusBadge = '⚫ Cancelled';

    const text =
      `🕒 <b>SCHEDULE DETAILS</b>\n\n` +
      `📦 ${preview}\n\n` +
      `📁 <b>Category:</b> ${categoryHtml}\n` +
      `📤 <b>Mode:</b> ${schedule.publishMode === 'forward' ? 'Forward' : 'Copy'}\n` +
      `🎯 <b>Destinations (${dests.length}):</b>\n${destLines || '  <i>None</i>'}\n\n` +
      `📅 <b>Scheduled For:</b> ${schedule.scheduledFor.toLocaleString([], { timeZone: schedule.timezone })}\n` +
      `🌐 <b>Timezone:</b> ${schedule.timezone}\n` +
      `📊 <b>Status:</b> ${statusBadge}\n` +
      (schedule.failureReason
        ? `⚠️ <b>Failure Reason:</b> ${this.escapeHtml(schedule.failureReason)}\n`
        : '');

    const keyboard = new InlineKeyboard();

    if (schedule.status === 'scheduled') {
      keyboard
        .text('🚀 Publish Now', `sch_act:${schId}:pub_now`)
        .row()
        .text('✏️ Change Time', `sch_act:${schId}:resched`)
        .text('🗑 Cancel Schedule', `sch_act:${schId}:cancel_confirm`)
        .row();
    }

    keyboard.text('← Back to Scheduled', 'nav:scheduled').text('⌂ Main Menu', 'nav:main');

    return { text, keyboard };
  }

  public static renderCancelScheduleConfirm(
    schedule: IScheduledPost,
    _message: IMessage
  ): { text: string; keyboard: InlineKeyboard } {
    const schId = schedule._id.toString();

    const text =
      `🗑 <b>Cancel Scheduled Post?</b>\n\n` +
      `Are you sure you want to cancel this scheduled publication?\n\n` +
      `📅 <b>Scheduled Time:</b> ${schedule.scheduledFor.toLocaleString([], { timeZone: schedule.timezone })}\n` +
      `🎯 <b>Targets:</b> ${schedule.destinationIds.length} destination(s)\n\n` +
      `<i>This will safely remove the automated trigger from the queue.</i>`;

    const keyboard = new InlineKeyboard()
      .text('❌ Yes, Cancel', `sch_act:${schId}:cancel_do`)
      .row()
      .text('← Keep Scheduled', `v:sch:${schId}`);

    return { text, keyboard };
  }

  public static renderSchedulePlaceholder(message: IMessage): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const msgId = message._id.toString();
    const text =
      `⏰ <b>Scheduling</b>\n\n` +
      `🕘 Scheduling will be available in Phase 4.\n\n` +
      `Use <b>🚀 Publish Now</b> to broadcast this post immediately.`;

    const keyboard = new InlineKeyboard().text('← Back to Editor', `b:${msgId}:menu`);
    return { text, keyboard };
  }

  // ==========================================
  // 21. PUBLISH RESULT SUMMARY
  // ==========================================

  public static renderPublishResult(
    message: IMessage,
    result: PublishResultData,
    destinationMap: Map<string, { title: string; telegramChatId: string }>
  ): { text: string; keyboard: InlineKeyboard } {
    const msgId = message._id.toString();

    const isSuccess = result.aggregateStatus === 'published';
    const isPartial = result.aggregateStatus === 'partially_published';

    let header = '✅ <b>Published Successfully</b>';
    if (isPartial) header = '⚠️ <b>Partially Published</b>';
    else if (!isSuccess) header = '❌ <b>Publish Failed</b>';

    const lines: string[] = [];
    for (const log of result.logs) {
      const destInfo = destinationMap.get(log.destinationId);
      const destTitle = destInfo ? this.escapeHtml(destInfo.title) : 'Destination';

      if (log.status === 'success') {
        lines.push(`  • ${destTitle} ✅`);
      } else {
        const errMsg = log.error?.message ? ` (${log.error.message})` : '';
        lines.push(`  • ${destTitle} ❌${errMsg}`);
      }
    }

    const text =
      `${header}\n\n` +
      `<b>Status:</b> ${result.aggregateStatus.toUpperCase()}\n` +
      `<b>Successful:</b> ${result.successfulCount}/${result.targetCount}\n` +
      `<b>Failed:</b> ${result.failedCount}/${result.targetCount}\n\n` +
      `<b>Destinations:</b>\n${lines.join('\n')}\n\n` +
      `<i>Post and publish logs are synchronized with the Web Panel.</i>`;

    const keyboard = new InlineKeyboard();

    if (result.failedCount > 0) {
      keyboard.text(`🔁 Retry Failed (${result.failedCount})`, `b:${msgId}:retry`).row();
    }

    keyboard.text('📋 Post Details', `v:post:${msgId}`).text('⌂ Main Menu', 'nav:main');

    return { text, keyboard };
  }

  // ==========================================
  // 22. AUTOMATION & FORWARDING RULES (/rules)
  // ==========================================

  public static async renderRulesList(page = 1): Promise<{
    text: string;
    keyboard: InlineKeyboard;
  }> {
    if (!this.isDbReady()) return this.renderDbOffline();
    const rules = await ForwardingRule.find().sort({ createdAt: -1 });

    if (rules.length === 0) {
      const text =
        `<blockquote>⚡ <b>Forwarding Rules</b>\n` +
        `<i>No auto-forwarding rules created yet</i></blockquote>\n\n` +
        `Create forwarding rules to automatically copy or forward new posts from source channels to your target channels:`;
      const keyboard = new InlineKeyboard()
        .text('➕ Create Forwarding Rule', 'nav:add_rule')
        .row()
        .text('← Back to Main Menu', 'nav:main');
      return { text, keyboard };
    }

    const totalPages = Math.max(1, Math.ceil(rules.length / LIST_PAGE_SIZE));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * LIST_PAGE_SIZE;
    const pageItems = rules.slice(startIndex, startIndex + LIST_PAGE_SIZE);

    let text =
      `<blockquote>⚡ <b>Forwarding Rules (${rules.length})</b>\n` +
      `<i>Automated routing from source channels to targets</i></blockquote>\n\n` +
      `🟢 Active  •  ⚪ Paused\n\n`;

    const keyboard = new InlineKeyboard();

    for (const rule of pageItems) {
      const statusIcon = rule.isActive ? '🟢' : '⚪';
      const label = `${statusIcon} ${rule.name} (${rule.destinationIds?.length || 0} dests)`;
      text += `• <b>${this.escapeHtml(rule.name)}</b> <i>(${rule.publishMode.toUpperCase()})</i>\n`;
      keyboard.text(label, `rule:v:${rule._id.toString()}`).row();
    }

    if (totalPages > 1) {
      const prevPage = currentPage > 1 ? currentPage - 1 : totalPages;
      const nextPage = currentPage < totalPages ? currentPage + 1 : 1;
      keyboard
        .text('◀️ Prev', `nav:rlp:${prevPage}`)
        .text(`[ ${currentPage}/${totalPages} ]`, 'nav:rules')
        .text('Next ▶️', `nav:rlp:${nextPage}`)
        .row();
    }

    keyboard
      .text('➕ Create Forwarding Rule', 'nav:add_rule')
      .row()
      .text('← Back to Main Menu', 'nav:main');

    return { text, keyboard };
  }

  public static async renderRuleDetails(rule: IForwardingRule): Promise<{
    text: string;
    keyboard: InlineKeyboard;
  }> {
    const ruleId = rule._id.toString();
    const source = rule.sourceId ? await Source.findById(rule.sourceId) : null;
    const category = rule.categoryId ? await Category.findById(rule.categoryId) : null;
    const destCount = rule.destinationIds?.length || 0;
    const groupCount = rule.destinationGroupIds?.length || 0;

    const statusBadge = rule.isActive ? '🟢 Active & Forwarding' : '⚪ Paused';
    const sourceName = source ? source.title : 'All Monitored Sources';
    const categoryName = category ? category.name : 'None';
    const requireApprovalStr =
      rule.workflowType === 'manual_approval'
        ? 'Yes ⚠️ (Held in Inbound Queue)'
        : 'No (Instant Auto-publish)';

    let destSummary = `${destCount} channel(s)`;
    if (groupCount > 0) {
      destSummary += ` (+${groupCount} group(s))`;
    }

    const text =
      `⚡ <b>RULE DETAILS • ${this.escapeHtml(rule.name)}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Status:</b> ${statusBadge}\n` +
      `<b>Mode:</b> <code>${rule.publishMode.toUpperCase()}</code>\n` +
      `<b>Workflow:</b> <code>${rule.workflowType}</code>\n` +
      `<b>Source:</b> <code>${this.escapeHtml(sourceName)}</code>\n` +
      `<b>Category:</b> <code>${this.escapeHtml(categoryName)}</code>\n` +
      `<b>Destinations:</b> <code>${destSummary}</code>\n` +
      `<b>Priority:</b> <code>${rule.priority}</code>\n\n` +
      `🔍 <b>Forward Settings:</b>\n` +
      `• Require Approval: <b>${requireApprovalStr}</b>\n` +
      `• Auto-Execution: <code>${rule.isActive ? 'Enabled ✅' : 'Suspended ⏸️'}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Tap below to toggle rule parameters or return:</i>`;

    const keyboard = new InlineKeyboard();

    if (rule.isActive) {
      keyboard.text('⏸️ Pause Rule', `rule:t:${ruleId}`);
    } else {
      keyboard.text('▶️ Resume Rule', `rule:t:${ruleId}`);
    }

    keyboard
      .text(
        rule.publishMode === 'forward' ? '↪️ Mode: Forward' : '📤 Mode: Copy',
        `rule:m:${ruleId}`
      )
      .row()
      .text(
        rule.workflowType === 'automatic' ? '⚡ Workflow: Auto' : '🛡️ Workflow: Approval',
        `rule:w:${ruleId}`
      )
      .row()
      .text('✏️ Rename Rule', `rule:rename:${ruleId}`)
      .text('🎯 Edit Targets', `rule:edest:${ruleId}`)
      .row()
      .text('🗑 Delete Rule', `rule:d_ask:${ruleId}`)
      .row()
      .text('← Back to Rules', 'nav:rules')
      .text('⌂ Main Menu', 'nav:main');

    return { text, keyboard };
  }

  public static renderRenameRulePrompt(rule: IForwardingRule): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const ruleId = rule._id.toString();
    const text =
      `<blockquote>✏️ <b>RENAME FORWARDING RULE</b>\n` +
      `<i>Update rule title and description</i></blockquote>\n\n` +
      `Current Name: <b>${this.escapeHtml(rule.name)}</b>\n\n` +
      `<i>Send the new name for this forwarding rule now:</i>`;

    const keyboard = new InlineKeyboard().text('❌ Cancel', `rule:v:${ruleId}`);
    return { text, keyboard };
  }

  public static renderRuleEditDests(
    rule: IForwardingRule,
    destinations: IDestination[]
  ): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const ruleId = rule._id.toString();
    const currentDestIds = new Set((rule.destinationIds || []).map((d) => d.toString()));

    const text =
      `<blockquote>🎯 <b>EDIT RULE TARGETS</b>\n` +
      `<i>Select destinations for this forwarding rule</i></blockquote>\n\n` +
      `Rule: <b>${this.escapeHtml(rule.name)}</b>\n` +
      `Active Targets: <b>${currentDestIds.size}</b> channel(s)\n\n` +
      `<i>Tap any destination to toggle routing for this rule:</i>`;

    const keyboard = new InlineKeyboard();

    for (const d of destinations) {
      const isChecked = currentDestIds.has(d._id.toString());
      const label = `${isChecked ? '✅ ' : '◻️ '}📢 ${d.title}`;
      keyboard.text(label, `rule:td:${ruleId}:${d._id.toString()}`).row();
    }

    keyboard.text('✅ Done Editing Targets', `rule:v:${ruleId}`).row();
    return { text, keyboard };
  }

  public static renderConfirmDeleteRule(rule: IForwardingRule): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const ruleId = rule._id.toString();
    const text =
      `🗑 <b>DELETE FORWARDING RULE</b>\n\n` +
      `Are you sure you want to permanently delete automation rule <b>${this.escapeHtml(rule.name)}</b>?\n\n` +
      `<i>Inbound messages will no longer be forwarded by this rule.</i>`;

    const keyboard = new InlineKeyboard()
      .text('❌ Confirm Delete', `rule:d_do:${ruleId}`)
      .row()
      .text('← Keep Rule', `rule:v:${ruleId}`);

    return { text, keyboard };
  }

  // ==========================================
  // 23. IN-BOT RULE CREATION WIZARD
  // ==========================================

  public static renderRuleCreatorStep1(sources: ISource[]): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const text =
      `<blockquote>⚡ <b>RULE BUILDER • STEP 1</b>\n` +
      `<i>Select Source Origin Channel</i></blockquote>\n\n` +
      `Choose which incoming channel or group should trigger this forwarding rule:\n\n` +
      `• <b>All Monitored Sources:</b> Forwards posts from ANY connected channel\n` +
      `• Or choose a specific channel below:\n\n` +
      `<i>Select an origin channel below:</i>`;

    const keyboard = new InlineKeyboard();
    keyboard.text('🌐 All Monitored Sources (Any Channel)', 'rc:src:all').row();

    for (const src of sources) {
      const icon = src.type === 'group' || src.type === 'supergroup' ? '👥' : '📢';
      keyboard.text(`${icon} ${src.title}`, `rc:src:${src._id.toString()}`).row();
    }

    keyboard.text('❌ Cancel', 'nav:rules');
    return { text, keyboard };
  }

  public static renderRuleCreatorStep2(
    destinations: IDestination[],
    selectedIds: Set<string>
  ): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const text =
      `<blockquote>⚡ <b>RULE BUILDER • STEP 2</b>\n` +
      `<i>Select Target Channels & Groups (Forward To)</i></blockquote>\n\n` +
      `Selected: <b>${selectedIds.size}</b> target channel(s)/group(s)\n\n` +
      `<i>Tap below to select which channels or group chats incoming messages should be forwarded to:</i>`;

    const keyboard = new InlineKeyboard();

    for (const d of destinations) {
      const isChecked = selectedIds.has(d._id.toString());
      const icon = d.type === 'group' ? '👥' : '📢';
      const label = `${isChecked ? '✅ ' : '◻️ '}${icon} ${d.title}`;
      keyboard.text(label, `rc:td:${d._id.toString()}`).row();
    }

    if (destinations.length === 0) {
      keyboard.text('➕ Connect Channel or Group First', 'nav:add_dest').row();
    }

    if (selectedIds.size > 0) {
      keyboard.text(`➡️ Next Step (${selectedIds.size} selected)`, 'rc:to_step3').row();
    } else {
      keyboard.text(`⚠️ Select at least 1 target to proceed`, 'rc:to_step3').row();
    }

    keyboard.text('⬅️ Back to Step 1', 'rc:to_step1').text('❌ Cancel', 'nav:rules');
    return { text, keyboard };
  }

  public static renderRuleCreatorStep3(draft: RuleDraft): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const modeLabel = draft.publishMode === 'forward' ? '↪️ Mode: Forward' : '📤 Mode: Copy';
    const wfLabel =
      draft.workflowType === 'automatic'
        ? '⚡ Workflow: Instant Auto'
        : '🛡️ Workflow: Hold for Approval';

    const targetWarning =
      draft.destinationIds.size === 0
        ? `\n⚠️ <b>Warning:</b> No target channels selected yet! Tap 'Select Target Channels' below before saving.\n`
        : '';

    const text =
      `<blockquote>⚡ <b>RULE BUILDER • STEP 3</b>\n` +
      `<i>Review & Delivery Settings</i></blockquote>\n\n` +
      `<blockquote>📋 <b>Rule Summary:</b>\n` +
      `• 📢 <b>Source:</b> ${this.escapeHtml(draft.sourceTitle || 'All Monitored Sources')}\n` +
      `• 🎯 <b>Targets:</b> ${draft.destinationIds.size} target channel(s)/group(s)\n` +
      `• 📤 <b>Mode:</b> <code>${draft.publishMode.toUpperCase()}</code>\n` +
      `• ⚡ <b>Type:</b> <code>${draft.workflowType}</code></blockquote>` +
      targetWarning +
      `\n<i>Tap options below to configure, then Save:</i>`;

    const targetBtnLabel =
      draft.destinationIds.size === 0
        ? '⚠️ 🎯 Select Target Channels/Groups (0)'
        : `🎯 Target Channels & Groups (${draft.destinationIds.size} selected)`;

    const keyboard = new InlineKeyboard()
      .text(targetBtnLabel, 'rc:to_step2')
      .row()
      .text('📢 Change Source Channel', 'rc:to_step1')
      .row()
      .text(modeLabel, 'rc:t_mode')
      .row()
      .text(wfLabel, 'rc:t_wf')
      .row()
      .text('💾 Save & Activate Rule', 'rc:save')
      .row()
      .text('❌ Cancel', 'nav:rules');

    return { text, keyboard };
  }

  // ==========================================
  // 24. NATIVE CHAT PICKER & PERSISTENT DOCK
  // ==========================================

  /**
   * Native Telegram in-app channel & group picker using KeyboardButtonRequestChat
   */
  public static getAddDestinationKeyboard(): Keyboard {
    return new Keyboard()
      .requestChat('📢 Choose Channel from My List', 1, {
        chat_is_channel: true,
      })
      .row()
      .requestChat('👥 Choose Group from My List', 2, {
        chat_is_channel: false,
      })
      .row()
      .text('❌ Cancel Setup')
      .resized()
      .oneTime();
  }

  public static getAdminBottomDock(): Keyboard {
    return new Keyboard()
      .text('✍️ New Post')
      .text('📢 Add Channel')
      .row()
      .text('🎯 Channels')
      .text('⚡ Forward Rules')
      .row()
      .text('🕒 Scheduled')
      .text('📜 Post History')
      .row()
      .text('📁 Categories')
      .text('❌ Hide Dock')
      .resized()
      .persistent();
  }
}
