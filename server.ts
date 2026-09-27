import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes.js';
import { authMiddleware } from './server/middleware/auth.js';
import { errorHandler } from './server/middleware/errorHandler.js';
import { config } from './server/config.js';
import { workflowEngine } from './server/services/workflowEngine.service.js';
import { repository } from './server/db/repository.js';
import { telegramNotificationService } from './server/services/telegram.service.js';
import { logger } from './server/utils/logger.js';

let queueWorkerInterval: NodeJS.Timeout | null = null;
let humanTaskWorkerInterval: NodeJS.Timeout | null = null;
let reviewWorkerInterval: NodeJS.Timeout | null = null;

function startBackgroundWorkers() {
  logger.info('Scheduler', 'Initializing autonomous background worker loops...');

  // 1. Queue Worker: checks dynamic capacity and launches queued jobs every 15s
  queueWorkerInterval = setInterval(async () => {
    try {
      const res = await workflowEngine.processQueue();
      if (res.startedJobs > 0) {
        logger.info('QueueWorker', `Started ${res.startedJobs} jobs. Remaining capacity: ${res.capacityRemaining}`);
      }
    } catch (err: any) {
      logger.error('QueueWorker', `Worker loop error: ${err.message}`);
    }
  }, 15000);

  // 2. Human Task Reminder Worker: checks overdue checkpoints every 60s
  humanTaskWorkerInterval = setInterval(async () => {
    try {
      const openTasks = await repository.getHumanTasks({ status: 'OPEN' });
      for (const task of openTasks) {
        const now = Date.now();
        const created = new Date(task.createdAt).getTime();
        const elapsedMinutes = (now - created) / (1000 * 60);

        // Send reminder every 15 minutes if unacknowledged
        if (elapsedMinutes >= (task.reminderCount + 1) * 15) {
          task.reminderCount += 1;
          task.lastReminderSentAt = new Date().toISOString();
          await repository.saveHumanTask(task);
          await telegramNotificationService.sendTaskReminder(task, `T+${task.reminderCount * 15}`);
          logger.info('ReminderWorker', `Dispatched T+${task.reminderCount * 15} reminder for task ${task.humanTaskId}`);
        }
      }
    } catch (err: any) {
      logger.error('ReminderWorker', `Reminder loop error: ${err.message}`);
    }
  }, 60000);

  // 3. Review Worker: polls review outcomes every 120s
  reviewWorkerInterval = setInterval(async () => {
    try {
      const reviewJobs = (await repository.getJobs({ status: 'WAITING_FOR_REVIEW' })).items;
      if (reviewJobs.length > 0) {
        logger.info('ReviewWorker', `Checked status for ${reviewJobs.length} submitted review jobs.`);
      }
    } catch (err: any) {
      logger.error('ReviewWorker', `Review check loop error: ${err.message}`);
    }
  }, 120000);
}

function stopBackgroundWorkers() {
  if (queueWorkerInterval) clearInterval(queueWorkerInterval);
  if (humanTaskWorkerInterval) clearInterval(humanTaskWorkerInterval);
  if (reviewWorkerInterval) clearInterval(reviewWorkerInterval);
  logger.info('Scheduler', 'Background worker loops stopped.');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable trust proxy for Cloud Run and reverse proxy environments (proper proto/secure detection)
  app.set('trust proxy', 1);

  // Initialize repository and idempotent Firestore seed
  await repository.initialize();

  // Basic security and parsing middlewares
  app.use(
    cors({
      origin: (origin, callback) => {
        // In local/container preview, allow the requesting origin or same-origin requests
        callback(null, true);
      },
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Root Liveness Probe (for Cloud Run, Kubernetes, and uptime checkers)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  });

  // Root Readiness Probe (verifies database repository and configuration)
  app.get('/ready', async (req, res) => {
    try {
      const pInfo = repository.getPersistenceInfo();

      // In production, require canonical Cloud Firestore
      if (process.env.NODE_ENV === 'production' && !pInfo.canonicalProduction) {
        return res.status(503).json({
          status: 'NOT_READY',
          error: 'Production requires canonical Cloud Firestore persistence.',
          persistence: pInfo,
          timestamp: new Date().toISOString(),
        });
      }

      if (!pInfo.isReady) {
        return res.status(503).json({
          status: 'NOT_READY',
          error: 'Repository initialization incomplete.',
          persistence: pInfo,
          timestamp: new Date().toISOString(),
        });
      }

      const settings = await repository.getSettings();
      res.status(200).json({
        status: 'READY',
        uptime: Math.floor(process.uptime()),
        persistence: pInfo,
        mockMode: settings.mockMode,
        maintenanceMode: settings.maintenanceMode,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(503).json({
        status: 'NOT_READY',
        error: err.message,
      });
    }
  });

  // Structured request logging
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      logger.info('HTTP', `${req.method} ${req.path}`);
    }
    next();
  });

  // Mount API routes with Auth Context
  app.use('/api', authMiddleware, apiRouter);

  // Global API Error Handler
  app.use(errorHandler);

  // Vite middleware in development mode, static assets in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info('Server', `🚀 Workflow Operations Platform running on port ${PORT} (0.0.0.0)`);
    logger.info('Server', `⚙️  Mode: ${config.nodeEnv} | Mock Mode: ${config.mockMode}`);
    startBackgroundWorkers();
  });

  const shutdown = () => {
    logger.info('Server', 'Shutting down gracefully...');
    stopBackgroundWorkers();
    server.close(() => {
      logger.info('Server', 'HTTP server terminated cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  logger.error('Server', 'Fatal server startup error', err);
  process.exit(1);
});
