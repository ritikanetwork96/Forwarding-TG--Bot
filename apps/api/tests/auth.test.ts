import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './test-db.js';
import { User } from '../src/models/user.model.js';
import { ErrorCodes } from '@telegram-forwarder/shared';

describe('Auth Endpoints', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  describe('POST /api/auth/setup', () => {
    it('first setup succeeds and creates owner', async () => {
      const res = await request(app).post('/api/auth/setup').send({
        email: 'owner@example.com',
        username: 'owner',
        password: 'Password123!',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('owner@example.com');
      expect(res.body.data.user.role).toBe('owner');
      expect(res.body.data.token).toBeDefined();
    });

    it('second setup rejected with SETUP_ALREADY_COMPLETED', async () => {
      // First setup
      await request(app).post('/api/auth/setup').send({
        email: 'owner@example.com',
        username: 'owner',
        password: 'Password123!',
      });

      // Second setup attempt
      const res = await request(app).post('/api/auth/setup').send({
        email: 'second@example.com',
        username: 'second',
        password: 'Password123!',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe(ErrorCodes.SETUP_ALREADY_COMPLETED);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/setup').send({
        email: 'owner@example.com',
        username: 'owner',
        password: 'Password123!',
      });
    });

    it('valid login returns token and user', async () => {
      const res = await request(app).post('/api/auth/login').send({
        login: 'owner@example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('owner@example.com');
    });

    it('invalid credentials returns 401 INVALID_CREDENTIALS', async () => {
      const res = await request(app).post('/api/auth/login').send({
        login: 'owner@example.com',
        password: 'WrongPassword!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe(ErrorCodes.INVALID_CREDENTIALS);
    });

    it('disabled account rejected with ACCOUNT_DISABLED', async () => {
      await User.updateOne({ email: 'owner@example.com' }, { status: 'disabled' });

      const res = await request(app).post('/api/auth/login').send({
        login: 'owner@example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe(ErrorCodes.ACCOUNT_DISABLED);
    });
  });

  describe('Session Invalidation & Logout', () => {
    it('logout invalidates old token via tokenVersion increment', async () => {
      // 1. Setup
      const setupRes = await request(app).post('/api/auth/setup').send({
        email: 'owner@example.com',
        username: 'owner',
        password: 'Password123!',
      });
      const token = setupRes.body.data.token;

      // 2. /me works with valid token
      const meResBefore = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(meResBefore.status).toBe(200);
      expect(meResBefore.body.data.email).toBe('owner@example.com');

      // 3. Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // 4. Using old token is now rejected with TOKEN_INVALIDATED
      const meResAfter = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(meResAfter.status).toBe(401);
      expect(meResAfter.body.error).toBe(ErrorCodes.TOKEN_INVALIDATED);
    });

    it('manual tokenVersion invalidation in database invalidates session', async () => {
      const setupRes = await request(app).post('/api/auth/setup').send({
        email: 'owner@example.com',
        username: 'owner',
        password: 'Password123!',
      });
      const token = setupRes.body.data.token;

      // Invalidate tokenVersion directly
      await User.updateOne({ email: 'owner@example.com' }, { $inc: { tokenVersion: 1 } });

      const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(meRes.status).toBe(401);
      expect(meRes.body.error).toBe(ErrorCodes.TOKEN_INVALIDATED);
    });
  });
});
