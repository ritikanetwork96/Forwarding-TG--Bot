import { createServer } from 'http';
import { app } from './app.js';
import { env } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './db/index.js';
import { logger } from './utils/logger.js';
import { startBotListener, stopBotListener } from './telegram/index.js';
import {
  initRedisConnection,
  closeRedisConnection,
  initPublishQueue,
  closePublishQueue,
  startPublishWorker,
  stopPublishWorker,
  initScheduleQueue,
  closeScheduleQueue,
  startScheduleWorker,
  stopScheduleWorker,
} from './queue/index.js';
import { ScheduleService } from './services/schedule.service.js';
import { AuthService } from './services/auth.service.js';
import { KeepAliveService } from './services/keep-alive.service.js';

async function bootstrap(): Promise<void> {
  logger.info(`Starting telegram-forwarder API in [${env.NODE_ENV}] mode...`);

  // 1. Attempt database connection
  try {
    await connectDatabase();
    // 1b. Seed and verify system owner from environment variables (.env)
    await AuthService.seedInitialAdmin();
  } catch (error) {
    logger.error('Database connection or owner provisioning failed during bootstrap:', error);
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // 2. Initialize Redis connection
  try {
    await initRedisConnection();
  } catch (redisErr) {
    logger.warn('Redis initialization failed during bootstrap:', redisErr);
  }

  // 3. Initialize BullMQ queues
  try {
    initPublishQueue();
    initScheduleQueue();
  } catch (queueErr) {
    logger.warn('BullMQ queue initialization failed during bootstrap:', queueErr);
  }

  // 4. Start BullMQ workers
  try {
    startPublishWorker();
    startScheduleWorker();
  } catch (workerErr) {
    logger.warn('BullMQ worker initialization failed during bootstrap:', workerErr);
  }

  // 4b. Reconcile pending/overdue schedules from MongoDB (Requirement 5)
  try {
    await ScheduleService.reconcileSchedulesOnStartup();
  } catch (recErr) {
    logger.warn('Schedule startup reconciliation failed:', recErr);
  }

  // 5. Start API HTTP server
  const server = createServer(app);

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(
        `Port ${env.PORT} is already in use. Terminate the conflicting process or choose another PORT.`
      );
    } else {
      logger.error('HTTP Server encountered an error:', err);
    }
  });

  server.listen(env.PORT, async () => {
    logger.info(`API Server successfully running at http://localhost:${env.PORT}`);
    logger.info(`Health check available at http://localhost:${env.PORT}/api/health`);
    logger.info(`Queue status available at http://localhost:${env.PORT}/api/queue/status`);

    // 6. Start inbound Telegram bot listener
    await startBotListener();

    // 7. Start Render keep-alive heartbeat if configured
    KeepAliveService.start();
  });

  // Graceful shutdown handling (Requirement 26)
  let isShuttingDown = false;

  const handleShutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    // Stop Telegram bot listener
    try {
      await stopBotListener();
    } catch (botErr) {
      logger.error('Error during Telegram bot listener stop:', botErr);
    }

    // Force exit if not cleanly shut down within 10 seconds
    const forceExitTimeout = setTimeout(() => {
      logger.error('Shutdown timed out. Forcing process termination.');
      process.exit(1);
    }, 10000);
    forceExitTimeout.unref();

    server.close(async (err) => {
      if (err) {
        logger.error('Error during HTTP server close:', err);
      } else {
        logger.info('HTTP server closed successfully');
      }

      // Gracefully stop workers
      try {
        await stopPublishWorker();
      } catch (wErr) {
        logger.error('Error during BullMQ publish worker shutdown:', wErr);
      }
      try {
        await stopScheduleWorker();
      } catch (swErr) {
        logger.error('Error during BullMQ schedule worker shutdown:', swErr);
      }

      // Close BullMQ queues
      try {
        await closePublishQueue();
      } catch (qErr) {
        logger.error('Error during BullMQ publish queue close:', qErr);
      }
      try {
        await closeScheduleQueue();
      } catch (sqErr) {
        logger.error('Error during BullMQ schedule queue close:', sqErr);
      }

      // Close Redis connection
      try {
        await closeRedisConnection();
      } catch (rErr) {
        logger.error('Error during Redis close:', rErr);
      }

      // Disconnect MongoDB
      try {
        await disconnectDatabase();
      } catch (dbErr) {
        logger.error('Error during database disconnect:', dbErr);
      }

      logger.info('Graceful shutdown completed. Exiting process.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void handleShutdown('SIGTERM'));
  process.on('SIGINT', () => void handleShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
