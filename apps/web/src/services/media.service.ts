import type { MediaUploadResultDTO } from '@telegram-forwarder/shared';
import { API_BASE_URL } from './api';

export class MediaService {
  /**
   * Uploads a file (photo, video, document) to the backend which proxies it to Telegram
   * to obtain a canonical, reusable file_id and file_unique_id.
   */
  public static async upload(file: File): Promise<MediaUploadResultDTO> {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/media/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Media upload failed');
    }

    return data.data as MediaUploadResultDTO;
  }
}
