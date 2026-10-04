import type { HealthResponse } from '@telegram-forwarder/shared';
import { env } from '../config/index.js';
import { getDatabaseState } from '../db/index.js';

export interface ExtendedHealthResponse extends HealthResponse {
  database: {
    status: string;
    name?: string;
  };
}

export class HealthService {
  public static getHealth(): ExtendedHealthResponse {
    const dbState = getDatabaseState();
    return {
      status: 'ok',
      service: 'telegram-forwarder-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV,
      database: {
        status: dbState.status,
        ...(env.NODE_ENV === 'development' && dbState.databaseName ? { name: dbState.databaseName } : {}),
      },
    };
  }
}
