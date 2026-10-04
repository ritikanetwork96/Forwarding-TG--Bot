import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './test-db.js';
import { ErrorCodes } from '@telegram-forwarder/shared';

describe('Category Endpoints', () => {
  let authToken: string;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Create owner user to obtain auth token
    const setupRes = await request(app).post('/api/auth/setup').send({
      email: 'admin@example.com',
      username: 'admin',
      password: 'Password123!',
    });
    authToken = setupRes.body.data.token;
  });

  it('creates category with valid data', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Crypto Signals',
        description: 'VIP Crypto Signals',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Crypto Signals');
    expect(res.body.data.slug).toBe('crypto-signals');
    expect(res.body.data.status).toBe('active');
  });

  it('rejects duplicate slug with CONFLICT', async () => {
    // First creation
    await request(app).post('/api/categories').set('Authorization', `Bearer ${authToken}`).send({
      name: 'Tech News',
      slug: 'tech-news',
    });

    // Duplicate creation
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Tech News Duplicate',
        slug: 'tech-news',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(ErrorCodes.SLUG_ALREADY_EXISTS);
  });

  it('rejects category creation without name', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: '',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  it('supports listing, updating and archiving categories', async () => {
    // 1. Create
    const createRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Finance',
      });
    const categoryId = createRes.body.data._id;

    // 2. List
    const listRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${authToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);

    // 3. Update
    const updateRes = await request(app)
      .patch(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        description: 'Updated finance description',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.description).toBe('Updated finance description');

    // 4. Archive (delete)
    const deleteRes = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(deleteRes.status).toBe(200);

    // Verify status is archived
    const getRes = await request(app)
      .get(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(getRes.body.data.status).toBe('archived');
  });
});
