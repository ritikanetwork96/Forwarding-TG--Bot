import mongoose, { ConnectOptions } from 'mongoose';
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface DatabaseConfig {
  uri: string;
  options?: ConnectOptions;
}

const defaultOptions: ConnectOptions = {
  serverSelectionTimeoutMS: 5000,
  autoIndex: env.NODE_ENV !== 'production',
  dbName: 'telegram_forwarder',
};

let isConnected = false;

/**
 * Configure Mongoose event listeners
 */
function registerConnectionEvents(): void {
  mongoose.connection.on('connected', () => {
    isConnected = true;
    mongoose.set('bufferCommands', true);
    logger.info(`MongoDB connected successfully to database: "${mongoose.connection.name}"`);
  });

  mongoose.connection.on('error', (err) => {
    isConnected = false;
    logger.error('MongoDB connection error:', err instanceof Error ? err.message : err);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('MongoDB disconnected');
  });
}

// Register listeners once
registerConnectionEvents();

/**
 * Connect to MongoDB with graceful error handling
 */
export async function connectDatabase(config?: DatabaseConfig): Promise<boolean> {
  const uri = config?.uri || env.MONGODB_URI;
  const options: ConnectOptions = { ...defaultOptions, ...config?.options };

  if (!uri) {
    logger.warn('No MONGODB_URI provided. Skipping database connection.');
    return false;
  }

  const isLocal = uri.includes('localhost') || uri.includes('127.0.0.1');
  if (isLocal && env.NODE_ENV !== 'test') {
    logger.warn(
      'Attempting connection to local MongoDB instance. If Atlas is expected, verify your root .env configuration.'
    );
  }

  try {
    logger.info('Attempting MongoDB connection...');
    await mongoose.connect(uri, options);
    isConnected = true;
    mongoose.set('bufferCommands', true);
    return true;
  } catch (error) {
    isConnected = false;
    const msg = error instanceof Error ? error.message : String(error);
    if (isLocal) {
      logger.error(
        `Failed to connect to local MongoDB (${msg}). Ensure local MongoDB is running or configure Atlas MONGODB_URI in root .env.`
      );
    } else {
      logger.error(`Failed to connect to MongoDB: ${msg}`);
    }
    // In production, database is required for full service operation
    if (env.NODE_ENV === 'production') {
      throw error;
    }
    // Disable command buffering so queries don't hang for 10s in degraded/offline mode
    mongoose.set('bufferCommands', false);
    logger.warn('Continuing startup in degraded mode (database unavailable in development/test)');
    return false;
  }
}

/**
 * Disconnect from MongoDB gracefully
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    logger.info('Closing MongoDB connection...');
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB connection closed');
  }
}

/**
 * Get current database connection state
 */
export function getDatabaseState(): {
  isConnected: boolean;
  readyState: number;
  status: 'disconnected' | 'connected' | 'connecting' | 'disconnecting';
  databaseName?: string;
} {
  const states: Record<number, 'disconnected' | 'connected' | 'connecting' | 'disconnecting'> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const readyState = mongoose.connection.readyState;
  return {
    isConnected: readyState === 1 || isConnected,
    readyState,
    status: states[readyState] ?? 'disconnected',
    databaseName: readyState === 1 ? mongoose.connection.name : undefined,
  };
}
