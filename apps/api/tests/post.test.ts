import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './test-db.js';
import { Message } from '../src/models/message.model.js';
import { ErrorCodes } from '@telegram-forwarder/shared';

describe('Post / Message Endpoints & Constraints', () => {
  let authToken: string;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    const setupRes = await request(app).post('/api/auth/setup').send({
      email: 'admin@example.com',
      username: 'admin',
      password: 'Password123!',
    });
    authToken = setupRes.body.data.token;
  });

  it('creates pure text post', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: {
          text: 'Hello Telegram community!',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.messageType).toBe('text');
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.content.text).toBe('Hello Telegram community!');
  });

  it('creates single media post using fileId and fileUniqueId', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: {
          text: 'Check this photo',
          mediaItems: [
            {
              mediaType: 'photo',
              fileId: 'AgACAgIAAxkBAAIEXAMPLE_FILE_ID',
              fileUniqueId: 'AQADUNIQUE123',
              caption: 'Check this photo',
            },
          ],
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.messageType).toBe('photo');
    expect(res.body.data.content.mediaItems.length).toBe(1);
    expect(res.body.data.content.mediaItems[0].fileId).toBe('AgACAgIAAxkBAAIEXAMPLE_FILE_ID');
    expect(res.body.data.content.mediaItems[0].fileUniqueId).toBe('AQADUNIQUE123');
  });

  it('creates album post with multiple media items', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: {
          text: 'My Photo Album',
          mediaItems: [
            {
              mediaType: 'photo',
              fileId: 'FILE_ID_1',
              fileUniqueId: 'UNIQUE_ID_1',
            },
            {
              mediaType: 'photo',
              fileId: 'FILE_ID_2',
              fileUniqueId: 'UNIQUE_ID_2',
            },
          ],
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.messageType).toBe('album');
    expect(res.body.data.content.mediaItems.length).toBe(2);
  });

  it('deduplicates incoming Telegram messages via compound unique index', async () => {
    // 1. Create first sourced message
    await Message.create({
      telegramChatId: '-1009999999999',
      telegramMessageId: 42,
      messageType: 'text',
      content: { text: 'First post' },
      status: 'pending_approval',
    });

    // 2. Attempt duplicate creation with same (telegramChatId, telegramMessageId)
    await expect(
      Message.create({
        telegramChatId: '-1009999999999',
        telegramMessageId: 42,
        messageType: 'text',
        content: { text: 'Duplicate post' },
        status: 'pending_approval',
      })
    ).rejects.toThrow();
  });

  it('allows creating multiple manual drafts without telegram identifiers', async () => {
    const res1 = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: {
          text: 'Manual text draft 1',
        },
      });
    expect(res1.status).toBe(201);
    expect(res1.body.data.telegramChatId).toBeNull();
    expect(res1.body.data.telegramMessageId).toBeNull();

    const res2 = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: {
          text: 'Manual text draft 2',
        },
      });
    expect(res2.status).toBe(201);
    expect(res2.body.data.telegramChatId).toBeNull();
    expect(res2.body.data.telegramMessageId).toBeNull();
  });

  it('deletes post successfully via DELETE /api/posts/:id', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: {
          text: 'Draft to be deleted',
        },
      });
    const postId = createRes.body.data._id;

    const delRes = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(delRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(getRes.status).toBe(404);
  });

  it('rejects editing content of an already published post (invalid transition)', async () => {
    // Create published post
    const post = await Message.create({
      messageType: 'text',
      content: { text: 'Already published content' },
      status: 'published',
    });

    const res = await request(app)
      .patch(`/api/posts/${post._id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: {
          text: 'Attempt to mutate published post',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(ErrorCodes.CANNOT_EDIT_PUBLISHED);
  });
});
