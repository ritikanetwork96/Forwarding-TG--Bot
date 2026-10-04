import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { MediaItem } from '@telegram-forwarder/shared';

export interface PendingAlbumBatch {
  mediaGroupId: string;
  telegramChatId: string;
  items: Array<{
    telegramMessageId: number;
    mediaItem: MediaItem;
    text?: string;
    entities?: unknown[];
  }>;
  timer: NodeJS.Timeout;
}

export type AlbumFlushCallback = (mediaGroupId: string, batch: PendingAlbumBatch) => Promise<void>;

class AlbumDebouncerService {
  private batches = new Map<string, PendingAlbumBatch>();
  private onFlushCallbacks: AlbumFlushCallback[] = [];

  public setFlushCallback(callback: AlbumFlushCallback): void {
    this.onFlushCallbacks.push(callback);
  }

  public addAlbumItem(
    mediaGroupId: string,
    telegramChatId: string,
    telegramMessageId: number,
    mediaItem: MediaItem,
    text?: string,
    entities?: unknown[]
  ): void {
    const existing = this.batches.get(mediaGroupId);

    if (existing) {
      clearTimeout(existing.timer);
      existing.items.push({ telegramMessageId, mediaItem, text, entities });

      // Automatically flush if album has reached max Telegram limit of 10 items
      if (existing.items.length >= 10) {
        this.flushAlbum(mediaGroupId);
        return;
      }

      existing.timer = setTimeout(() => {
        this.flushAlbum(mediaGroupId);
      }, env.ALBUM_DEBOUNCE_MS);
    } else {
      const timer = setTimeout(() => {
        this.flushAlbum(mediaGroupId);
      }, env.ALBUM_DEBOUNCE_MS);

      this.batches.set(mediaGroupId, {
        mediaGroupId,
        telegramChatId,
        items: [{ telegramMessageId, mediaItem, text, entities }],
        timer,
      });
      logger.debug(
        `Started album debounce window (${env.ALBUM_DEBOUNCE_MS}ms) for group: ${mediaGroupId}`
      );
    }
  }

  private flushAlbum(mediaGroupId: string): void {
    const batch = this.batches.get(mediaGroupId);
    if (!batch) return;

    this.batches.delete(mediaGroupId);
    logger.debug(`Flushing album ${mediaGroupId} with ${batch.items.length} items`);

    for (const callback of this.onFlushCallbacks) {
      callback(mediaGroupId, batch).catch((err) => {
        logger.error(`Error processing flushed album ${mediaGroupId}:`, err);
      });
    }
  }

  public clear(): void {
    for (const batch of this.batches.values()) {
      clearTimeout(batch.timer);
    }
    this.batches.clear();
  }
}

export const albumDebouncer = new AlbumDebouncerService();
