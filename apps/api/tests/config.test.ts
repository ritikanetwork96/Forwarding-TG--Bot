import { describe, it, expect } from 'vitest';
import { validateEnv } from '../src/config/env.js';

describe('Environment Validation', () => {
  it('should validate development environment with defaults', () => {
    const validConfig = validateEnv({
      NODE_ENV: 'development',
      PORT: '5000',
    });

    expect(validConfig.NODE_ENV).toBe('development');
    expect(validConfig.PORT).toBe(5000);
    expect(validConfig.LOG_LEVEL).toBe('info');
    expect(validConfig.MONGODB_URI).toBeDefined();
  });

  it('should fail validation in production if JWT_SECRET is missing or too short', () => {
    expect(() => {
      validateEnv({
        NODE_ENV: 'production',
        PORT: '5000',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
        JWT_SECRET: 'short',
      });
    }).toThrow(/JWT_SECRET must be provided and must be at least 16 characters/);
  });

  it('should fail validation in production if MONGODB_URI points to localhost', () => {
    expect(() => {
      validateEnv({
        NODE_ENV: 'production',
        PORT: '5000',
        MONGODB_URI: 'mongodb://localhost:27017/prod',
        JWT_SECRET: 'a-very-long-production-secret-key-12345',
      });
    }).toThrow(/In production, a production MONGODB_URI/);
  });

  it('should pass validation in production when properly configured', () => {
    const prodConfig = validateEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
      JWT_SECRET: 'a-very-long-production-secret-key-12345',
      FRONTEND_URL: 'https://forwarder.example.com',
    });

    expect(prodConfig.NODE_ENV).toBe('production');
    expect(prodConfig.PORT).toBe(8080);
    expect(prodConfig.JWT_SECRET).toBe('a-very-long-production-secret-key-12345');
  });
});
