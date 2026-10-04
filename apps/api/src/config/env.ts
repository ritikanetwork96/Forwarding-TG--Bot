import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { configureDns } from './dns.js';

/**
 * Locates the root .env file by traversing upward from the current file location or working directory.
 * Ensures the monorepo root .env is reliably loaded whether starting from the root or apps/api.
 */
function findRootEnv(): string | null {
  if (process.env.DOTENV_CONFIG_PATH && fs.existsSync(process.env.DOTENV_CONFIG_PATH)) {
    return process.env.DOTENV_CONFIG_PATH;
  }

  // 1. Search upward from the current file URL
  try {
    const currentFileDir = path.dirname(fileURLToPath(import.meta.url));
    let dir = currentFileDir;
    while (dir && dir !== path.dirname(dir)) {
      const candidate = path.join(dir, '.env');
      if (fs.existsSync(candidate)) {
        const pkgJson = path.join(dir, 'package.json');
        if (fs.existsSync(pkgJson)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(pkgJson, 'utf-8'));
            if (parsed.workspaces) {
              return candidate;
            }
          } catch {
            // continue checking
          }
        }
      }
      dir = path.dirname(dir);
    }
  } catch {
    // import.meta.url might fail in some test runners
  }

  // 2. Search upward from process.cwd()
  let cwd = process.cwd();
  while (cwd && cwd !== path.dirname(cwd)) {
    const candidate = path.join(cwd, '.env');
    if (fs.existsSync(candidate)) {
      const pkgJson = path.join(cwd, 'package.json');
      if (fs.existsSync(pkgJson)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(pkgJson, 'utf-8'));
          if (parsed.workspaces) {
            return candidate;
          }
        } catch {
          // continue checking
        }
      }
      return candidate;
    }
    cwd = path.dirname(cwd);
  }

  return null;
}

// Load root .env file if it exists, without crashing if it does not
const rootEnvPath = findRootEnv();
if (rootEnvPath) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    MONGODB_URI: z
      .string()
      .min(1, 'MONGODB_URI must not be empty')
      .default('mongodb://localhost:27017/telegram_forwarder'),
    FRONTEND_URL: z.string().default('http://localhost:5173'),
    TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
    TELEGRAM_ADMIN_IDS: z.string().optional().default(''),
    ADMIN_EMAIL: z.string().email().default('admin@example.com'),
    ADMIN_USERNAME: z.string().default('admin'),
    ADMIN_PASSWORD: z.string().min(8).default('AdminSecurePassword123'),
    ADMIN_NAME: z.string().default('System Owner'),
    ALBUM_DEBOUNCE_MS: z.coerce.number().int().positive().default(600),
    JWT_SECRET: z.string().default('development-jwt-secret-minimum-16-chars-long'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    RENDER_EXTERNAL_URL: z.string().optional().default(''),
    KEEP_ALIVE_INTERVAL_MS: z.coerce.number().int().positive().default(600000), // 10 minutes
    DNS_SERVERS: z.string().optional(),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(5),
    QUEUE_MAX_JOBS_PER_SECOND: z.coerce.number().int().positive().default(20),
    QUEUE_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(3),
    QUEUE_BACKOFF_DELAY_MS: z.coerce.number().int().positive().default(1000),
    QUEUE_COMPLETED_RETENTION: z.coerce.number().int().positive().default(500),
    QUEUE_FAILED_RETENTION: z.coerce.number().int().positive().default(1000),
  })
  .superRefine((data, ctx) => {
    // In production, enforce non-default security parameters
    if (data.NODE_ENV === 'production') {
      if (!data.JWT_SECRET || data.JWT_SECRET.length < 16) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'In production, JWT_SECRET must be provided and must be at least 16 characters long.',
          path: ['JWT_SECRET'],
        });
      }

      if (!data.MONGODB_URI || data.MONGODB_URI.includes('localhost')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'In production, a production MONGODB_URI (e.g. MongoDB Atlas) must be configured.',
          path: ['MONGODB_URI'],
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates the provided environment variables or process.env against the schema.
 * Throws a descriptive error if validation fails.
 */
export function validateEnv(rawEnv: Record<string, unknown> = process.env): EnvConfig {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    const errorMessage = `Environment validation failed:\n${formattedErrors}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Warn loudly if MONGODB_URI is missing and defaulting to localhost outside test mode
  if (!rawEnv.MONGODB_URI && result.data.NODE_ENV !== 'test') {
    logger.warn(
      'MONGODB_URI was not provided in environment or root .env! Defaulting to local MongoDB (mongodb://localhost:27017/telegram_forwarder). ' +
        'If MongoDB Atlas was expected, ensure root .env contains MONGODB_URI.'
    );
  }

  return Object.freeze(result.data);
}

export const env: EnvConfig = validateEnv();
logger.setLevel(env.LOG_LEVEL);

// Configure DNS for SRV resolution (honors DNS_SERVERS or applies Windows loopback fallback)
configureDns(env.DNS_SERVERS, env.MONGODB_URI);
