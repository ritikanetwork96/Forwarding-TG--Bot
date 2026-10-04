import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './test-db.js';

describe('Media Upload Endpoints (Phase 5C)', () => {
  let authToken: string;
  const testFilesDir = path.resolve(process.cwd(), 'temp', 'test-fixtures');

  beforeAll(async () => {
    await connectTestDb();
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
  });

  afterAll(async () => {
    await disconnectTestDb();
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    await clearTestDb();

    // Create owner user to obtain auth token
    const setupRes = await request(app).post('/api/auth/setup').send({
      email: 'owner@forwarder.pro',
      name: 'Owner Admin',
      username: 'owner',
      password: 'Password123!',
    });
    authToken = setupRes.body.data.token;
  });

  it('rejects unauthenticated media upload with 401', async () => {
    const res = await request(app).post('/api/media/upload');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects upload without file with 400', async () => {
    const res = await request(app)
      .post('/api/media/upload')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('uploads a photo image successfully and cleans scratch file', async () => {
    const dummyImagePath = path.join(testFilesDir, 'sample-photo.png');
    fs.writeFileSync(dummyImagePath, Buffer.from('fake-png-binary-data'));

    const res = await request(app)
      .post('/api/media/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', dummyImagePath);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data).toBeDefined();
    expect(data.mediaType).toBe('photo');
    expect(data.fileId).toBeDefined();
    expect(data.fileUniqueId).toBeDefined();
    expect(data.fileName).toBe('sample-photo.png');
    expect(data.mimeType).toBe('image/png');
    expect(data.fileSize).toBeGreaterThan(0);
  });

  it('uploads a document PDF successfully and cleans scratch file', async () => {
    const dummyPdfPath = path.join(testFilesDir, 'whitepaper.pdf');
    fs.writeFileSync(dummyPdfPath, Buffer.from('%PDF-1.4 fake pdf data'));

    const res = await request(app)
      .post('/api/media/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', dummyPdfPath);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data).toBeDefined();
    expect(data.mediaType).toBe('document');
    expect(data.fileId).toBeDefined();
    expect(data.fileUniqueId).toBeDefined();
    expect(data.fileName).toBe('whitepaper.pdf');
  });
});
