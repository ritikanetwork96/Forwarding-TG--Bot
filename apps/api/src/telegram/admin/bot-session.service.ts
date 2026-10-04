import type { PublishMode } from '@telegram-forwarder/shared';

export type AdminNavigationState =
  | 'MAIN'
  | 'NEW_POST_WAITING'
  | 'POST_EDITOR'
  | 'PREVIEW'
  | 'SCHEDULE_DATE'
  | 'SCHEDULE_TIME'
  | 'SCHEDULE_CONFIRM'
  | 'SCHEDULED_POSTS'
  | 'SCHEDULE_DETAILS'
  | 'CATEGORY_LIST'
  | 'CATEGORY_DETAILS'
  | 'DESTINATION_LIST'
  | 'DESTINATION_DETAILS'
  | 'RECENT_POSTS'
  | 'POST_DETAILS'
  | 'DRAFTS'
  | 'APPROVALS'
  | 'RULES_LIST'
  | 'RULE_DETAILS'
  | 'ACTIVITY'
  | 'SETTINGS'
  | 'HELP'
  | 'ADD_DEST_WAITING'
  | 'ADD_CAT_WAITING'
  | 'RULE_CREATOR_SOURCE'
  | 'RULE_CREATOR_DESTS'
  | 'RULE_CREATOR_MODE'
  | 'RULE_CREATOR_CONFIRM'
  | 'EDIT_POST_TEXT'
  | 'EDIT_POST_BUTTONS'
  | 'SCHEDULE_CUSTOM_WAITING'
  | 'SCHEDULE_TIME_ADJUSTER'
  | 'RENAME_DEST'
  | 'RENAME_CAT'
  | 'RENAME_RULE';

export interface PostUrlButton {
  text: string;
  url: string;
}

export interface RuleDraft {
  name?: string;
  sourceId?: string | null;
  sourceChatId?: string;
  sourceTitle?: string;
  destinationIds: Set<string>;
  publishMode: PublishMode;
  workflowType: 'automatic' | 'manual_approval';
}

export interface BotPostSession {
  messageId: string;
  selectedDestinationIds: Set<string>;
  selectedGroupIds: Set<string>;
  categoryId: string | null;
  selectedCategoryIds: Set<string>;
  publishMode: PublishMode;
  destPage: number;
  isPublishing: boolean;
  scheduleDate?: string;
  scheduleTime?: string;
  scheduleTimezone?: string;
  urlButtons?: PostUrlButton[];
  silentPublish?: boolean;
  pinOnPublish?: boolean;
  disableWebPreview?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AdminUserState {
  state: AdminNavigationState;
  activeMessageId?: string | null;
  targetEntityId?: string | null;
  ruleDraft?: RuleDraft;
  updatedAt: number;
}

export const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes TTL

class BotSessionManager {
  private postSessions = new Map<string, BotPostSession>();
  private userStates = new Map<string, AdminUserState>();

  // ==========================================
  // Post Wizard Sessions
  // ==========================================

  public getOrCreate(messageId: string, initialCategory?: string | null): BotPostSession {
    let session = this.postSessions.get(messageId);
    const now = Date.now();

    if (session) {
      if (this.isExpired(session)) {
        this.clear(messageId);
        session = undefined;
      } else {
        session.updatedAt = now;
        if (!session.selectedCategoryIds) {
          session.selectedCategoryIds = new Set<string>();
          if (session.categoryId) session.selectedCategoryIds.add(session.categoryId);
        }
      }
    }

    if (!session) {
      const initialCatSet = new Set<string>();
      if (initialCategory) initialCatSet.add(initialCategory);

      session = {
        messageId,
        selectedDestinationIds: new Set<string>(),
        selectedGroupIds: new Set<string>(),
        categoryId: initialCategory || null,
        selectedCategoryIds: initialCatSet,
        publishMode: 'copy',
        destPage: 1,
        isPublishing: false,
        createdAt: now,
        updatedAt: now,
      };
      this.postSessions.set(messageId, session);
    }
    return session;
  }

  public get(messageId: string): BotPostSession | null {
    const session = this.postSessions.get(messageId);
    if (!session) return null;

    if (this.isExpired(session)) {
      this.clear(messageId);
      return null;
    }

    session.updatedAt = Date.now();
    return session;
  }

  public touch(messageId: string): void {
    const session = this.postSessions.get(messageId);
    if (session) {
      session.updatedAt = Date.now();
    }
  }

  public isExpired(session: BotPostSession): boolean {
    return Date.now() - session.updatedAt > SESSION_TTL_MS;
  }

  public clear(messageId: string): void {
    this.postSessions.delete(messageId);
  }

  // ==========================================
  // Admin Navigation States
  // ==========================================

  public setAdminState(
    userId: string | number,
    state: AdminNavigationState,
    activeMessageId?: string | null,
    targetEntityId?: string | null
  ): void {
    // Preserve existing ruleDraft so multi-step wizards don't lose their data
    const existing = this.userStates.get(String(userId));
    this.userStates.set(String(userId), {
      state,
      activeMessageId: activeMessageId || null,
      targetEntityId: targetEntityId || activeMessageId || null,
      ruleDraft: existing?.ruleDraft,
      updatedAt: Date.now(),
    });
  }

  public getAdminState(userId: string | number): AdminUserState | null {
    const state = this.userStates.get(String(userId));
    if (!state) return null;

    if (Date.now() - state.updatedAt > SESSION_TTL_MS) {
      this.clearAdminState(userId);
      return null;
    }

    return state;
  }

  public clearAdminState(userId: string | number): void {
    this.userStates.delete(String(userId));
  }

  public getOrCreateRuleDraft(userId: string | number): RuleDraft {
    let state = this.getAdminState(userId);
    if (!state) {
      this.setAdminState(userId, 'RULE_CREATOR_SOURCE');
      state = this.getAdminState(userId)!;
    }
    if (!state.ruleDraft) {
      state.ruleDraft = {
        sourceId: null,
        destinationIds: new Set<string>(),
        publishMode: 'copy',
        workflowType: 'automatic',
      };
    }
    return state.ruleDraft;
  }

  public clearRuleDraft(userId: string | number): void {
    const state = this.getAdminState(userId);
    if (state) {
      delete state.ruleDraft;
    }
  }

  // ==========================================
  // Maintenance & Cleanup
  // ==========================================

  public cleanupExpired(): void {
    const now = Date.now();

    for (const [key, session] of this.postSessions.entries()) {
      if (now - session.updatedAt > SESSION_TTL_MS) {
        this.postSessions.delete(key);
      }
    }

    for (const [key, userState] of this.userStates.entries()) {
      if (now - userState.updatedAt > SESSION_TTL_MS) {
        this.userStates.delete(key);
      }
    }
  }

  public clearAll(): void {
    this.postSessions.clear();
    this.userStates.clear();
  }
}

export const botSessionManager = new BotSessionManager();
