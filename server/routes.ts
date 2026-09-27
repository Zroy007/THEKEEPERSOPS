import { Router, Request, Response, NextFunction } from 'express';
import { repository } from './db/repository.js';
import { workflowEngine } from './services/workflowEngine.service.js';
import { goLoginService } from './services/gologin.service.js';
import { telegramNotificationService } from './services/telegram.service.js';
import { microsoftGraphService } from './services/microsoftGraph.service.js';
import { googleSheetsService } from './services/googleSheets.service.js';
import { retryEngine } from './services/retryEngine.service.js';
import { requireRole } from './middleware/auth.js';
import { Job, SystemSettings, WorkflowStepDefinition } from './types.js';
import { sanitizeJob, sanitizeHumanTask, sanitizeSession } from './utils/sanitizer.js';
import { logger } from './utils/logger.js';
import { lockManager } from './utils/concurrencyLock.js';
import { globalApiLimiter, mutationRateLimiter } from './middleware/rateLimiter.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';
import {
  validateBody,
  CreateJobSchema,
  CompleteHumanTaskSchema,
  UpdateSettingsSchema,
  CreateOperatorSchema,
  UpdateOperatorSchema,
  UpdateRetryPolicySchema,
} from './validators/schemas.js';
import { authRouter, adminRouter } from './adminRoutes.js';

export const apiRouter = Router();

// Apply global rate limiting and idempotency middleware
apiRouter.use(globalApiLimiter);
apiRouter.use(idempotencyMiddleware);

// Authentication and Admin Routes
apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);

// ==========================================
// 1. DASHBOARD & HEALTH CHECKS
// ==========================================
apiRouter.get('/dashboard/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await repository.getDashboardMetrics();
    res.json(metrics);
  } catch (err) {
    next(err);
  }
});

// Liveness and system health check
apiRouter.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pInfo = repository.getPersistenceInfo();
    const integrations = await repository.getIntegrations();
    const settings = await repository.getSettings();

    const isHealthy = pInfo.isReady && (process.env.NODE_ENV !== 'production' || pInfo.canonicalProduction);

    res.json({
      status: isHealthy ? 'HEALTHY' : 'DEGRADED',
      liveness: 'UP',
      readiness: pInfo.isReady ? 'READY' : 'NOT_READY',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      mockMode: settings.mockMode,
      persistence: pInfo,
      integrations,
    });
  } catch (err) {
    next(err);
  }
});

// Deep readiness check
apiRouter.get('/ready', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pInfo = repository.getPersistenceInfo();
    if (process.env.NODE_ENV === 'production' && !pInfo.canonicalProduction) {
      return res.status(503).json({
        status: 'NOT_READY',
        error: 'Production requires canonical Cloud Firestore persistence.',
        persistence: pInfo,
      });
    }

    if (!pInfo.isReady) {
      return res.status(503).json({
        status: 'NOT_READY',
        error: 'Repository initialization incomplete.',
        persistence: pInfo,
      });
    }

    const mem = process.memoryUsage();
    const uptime = process.uptime();
    const settings = await repository.getSettings();
    const queueStats = (await repository.getJobs({ status: 'QUEUED' })).total;

    res.status(200).json({
      status: 'READY',
      uptimeSeconds: Math.floor(uptime),
      persistence: pInfo,
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      },
      system: {
        mockMode: settings.mockMode,
        maintenanceMode: settings.maintenanceMode,
        queueSize: queueStats,
        concurrencyLimit: settings.concurrencyLimit,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/integrations/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await repository.getIntegrations());
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. JOBS (SANITIZED & PROTECTED)
// ==========================================
apiRouter.get('/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, operatorId, search, priority, limit, offset } = req.query;
    const parsedLimit = limit ? parseInt(limit as string, 10) : 50;
    const parsedOffset = offset ? parseInt(offset as string, 10) : 0;

    const result = await repository.getJobs({
      status: status as string,
      operatorId: operatorId as string,
      search: search as string,
      priority: priority as string,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    // Strip sensitive passwords & proxy credentials from frontend payload
    res.json({
      items: result.items.map(sanitizeJob),
      total: result.total,
      limit: parsedLimit,
      offset: parsedOffset,
      page: Math.floor(parsedOffset / parsedLimit) + 1,
      totalPages: Math.ceil(result.total / parsedLimit),
    });
  } catch (err) {
    next(err);
  }
});

apiRouter.post(
  '/jobs',
  mutationRateLimiter,
  requireRole('ADMIN', 'SUPERVISOR', 'OPERATOR'),
  validateBody(CreateJobSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopName, email, passwordReference, proxyReference, priority, runMode, autoStart, tags, notes } = req.body;

      // 1. Protection against duplicate jobs
      const dupCheck = await workflowEngine.checkDuplicateJob(shopName, email);
      if (dupCheck.isDuplicate) {
        logger.warn('JobCreation', `Duplicate job rejected for shop ${shopName} or email ${email}`);
        return res.status(409).json({
          error: `An active job (${dupCheck.existingJob?.jobId}) already exists for shop '${shopName}' or email '${email}'. Duplicate jobs are rejected.`,
          code: 'DUPLICATE_JOB_CONFLICT',
          existingJobId: dupCheck.existingJob?.jobId,
        });
      }

      const settings = await repository.getSettings();
      if (settings.queueLimit !== null) {
        const currentQueue = (await repository.getJobs({ status: 'QUEUED' })).total;
        if (currentQueue >= settings.queueLimit) {
          return res.status(429).json({
            error: `Queue capacity limit of ${settings.queueLimit} reached.`,
            code: 'QUEUE_LIMIT_REACHED',
          });
        }
      }

      const allJobs = (await repository.getJobs()).items;
      const jobId = `JOB-00000${allJobs.length + 1}`;

      const newJob: Job = {
        jobId,
        shopName,
        email,
        passwordReference: passwordReference || `sec://vault/passwords/${shopName.toLowerCase().replace(/\s+/g, '-')}`,
        proxyReference: proxyReference || 'proxy://us-residential.lum-pool.net:22225:node-auto',
        status: 'QUEUED',
        subStatus: 'WAITING_FOR_WORKER',
        priority: priority || settings.defaultPriority,
        runMode: runMode || 'AUTO',
        autoStart: autoStart !== undefined ? autoStart : settings.autoStartJobs,
        operatorId: req.user?.operatorId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        retryCount: 0,
        maxRetries: settings.defaultMaxRetries,
        currentAttemptNo: 1,
        tags: Array.isArray(tags) ? tags : ['manual-entry'],
        notes: notes || 'Created via Operations Dashboard',
      };

      await repository.saveJob(newJob);

      await repository.addAuditLog({
        actor: req.user?.name || 'OPERATOR',
        actorRole: req.user?.role || 'OPERATOR',
        action: 'JOB_CREATED',
        jobId: newJob.jobId,
        newState: 'QUEUED',
        result: 'SUCCESS',
        metadata: { shopName, priority: newJob.priority },
      });

      logger.info('JobCreation', `Job ${newJob.jobId} created for shop ${newJob.shopName}`);
      res.status(201).json(sanitizeJob(newJob));
    } catch (err) {
      next(err);
    }
  }
);

apiRouter.get('/jobs/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await repository.getJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found', code: 'JOB_NOT_FOUND' });
    }
    const session = job.currentSessionId ? await repository.getSessionById(job.currentSessionId) : undefined;
    const humanTasks = await repository.getHumanTasksByJobId(job.jobId);
    const attempts = await repository.getApplicationAttempts(job.jobId);
    const auditLogs = await repository.getAuditLogs({ jobId: job.jobId });
    const workflowRuns = await repository.getWorkflowRuns(job.jobId);
    const stepRuns = await repository.getStepRuns({ jobId: job.jobId });

    res.json({
      job: sanitizeJob(job),
      session: session ? sanitizeSession(session) : undefined,
      humanTasks: humanTasks.map(sanitizeHumanTask),
      attempts,
      auditLogs,
      workflowRuns,
      stepRuns,
    });
  } catch (err) {
    next(err);
  }
});

apiRouter.patch('/jobs/:jobId', requireRole('ADMIN', 'SUPERVISOR', 'OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await repository.getJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found', code: 'JOB_NOT_FOUND' });
    }

    const { priority, operatorId, notes, tags } = req.body;
    if (priority) job.priority = priority;
    if (operatorId !== undefined) job.operatorId = operatorId;
    if (notes !== undefined) job.notes = notes;
    if (tags !== undefined) job.tags = tags;

    await repository.saveJob(job);
    res.json(sanitizeJob(job));
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/jobs/:jobId/pause', requireRole('ADMIN', 'SUPERVISOR', 'OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await lockManager.withLock(`job:${req.params.jobId}`, req.user?.name || 'OPERATOR', async () => {
      return workflowEngine.transitionJob({
        jobId: req.params.jobId,
        newStatus: 'PAUSED',
        actor: req.user?.name || 'OPERATOR',
        actorRole: req.user?.role,
        reason: req.body.reason || 'Paused by operator via dashboard',
      });
    });
    res.json(sanitizeJob(result));
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/jobs/:jobId/resume', requireRole('ADMIN', 'SUPERVISOR', 'OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await lockManager.withLock(`job:${req.params.jobId}`, req.user?.name || 'OPERATOR', async () => {
      const job = await repository.getJobById(req.params.jobId);
      if (!job) {
        throw new Error('Job not found');
      }
      const targetStatus = job.currentSessionId ? 'BROWSER_READY' : 'QUEUED';
      return workflowEngine.transitionJob({
        jobId: job.jobId,
        newStatus: targetStatus,
        actor: req.user?.name || 'OPERATOR',
        actorRole: req.user?.role,
        reason: 'Resumed by operator',
      });
    });
    res.json(sanitizeJob(result));
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/jobs/:jobId/retry', requireRole('ADMIN', 'SUPERVISOR', 'OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await lockManager.withLock(`job:${req.params.jobId}`, req.user?.name || 'OPERATOR', async () => {
      const job = await repository.getJobById(req.params.jobId);
      if (!job) {
        throw new Error('Job not found');
      }
      return retryEngine.scheduleTechnicalRetry({
        jobId: job.jobId,
        errorCode: job.lastErrorCode || 'ERR_PROXY_TIMEOUT',
        errorMessage: job.lastErrorMessage || 'Manual retry triggered by operator',
      });
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/jobs/:jobId/manual-review', requireRole('ADMIN', 'SUPERVISOR', 'OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await lockManager.withLock(`job:${req.params.jobId}`, req.user?.name || 'OPERATOR', async () => {
      return workflowEngine.transitionJob({
        jobId: req.params.jobId,
        newStatus: 'MANUAL_REVIEW',
        actor: req.user?.name || 'OPERATOR',
        actorRole: req.user?.role,
        reason: req.body.reason || 'Escalated to supervisor manual review',
      });
    });
    res.json(sanitizeJob(result));
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/jobs/:jobId/submit', requireRole('ADMIN', 'SUPERVISOR', 'OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await lockManager.withLock(`job:${req.params.jobId}`, req.user?.name || 'OPERATOR', async () => {
      return workflowEngine.submitApplication(req.params.jobId, req.user?.name || 'OPERATOR');
    });
    res.json(sanitizeJob(result));
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/jobs/:jobId/reapply', requireRole('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await lockManager.withLock(`job:${req.params.jobId}`, req.user?.name || 'SUPERVISOR', async () => {
      return workflowEngine.createReapplicationAttempt(req.params.jobId, req.user?.name || 'SUPERVISOR');
    });
    res.json(sanitizeJob(result));
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/jobs/:jobId/reject', requireRole('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await lockManager.withLock(`job:${req.params.jobId}`, req.user?.name || 'SUPERVISOR', async () => {
      return workflowEngine.recordRejection({
        jobId: req.params.jobId,
        rejectionReason: req.body.reason || 'Application rejected by platform review',
        actor: req.user?.name || 'SUPERVISOR',
      });
    });
    res.json(sanitizeJob(result));
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. SESSIONS (SANITIZED & CONTROLLED)
// ==========================================
apiRouter.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, operatorId } = req.query;
    const list = await repository.getSessions({
      status: status as string,
      operatorId: operatorId as string,
    });
    res.json(list.map(sanitizeSession));
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/sessions/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await repository.getSessionById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }
    res.json(sanitizeSession(session));
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/sessions/:sessionId/stop', requireRole('ADMIN', 'SUPERVISOR', 'OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const success = await goLoginService.stopCloudBrowser(req.params.sessionId);
    res.json({ success });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/sessions/:sessionId/heartbeat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await repository.getSessionById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }
    session.lastHeartbeat = new Date().toISOString();
    await repository.saveSession(session);
    res.json({ success: true, lastHeartbeat: session.lastHeartbeat });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. HUMAN TASKS (ZERO-BYPASS & SANITIZED)
// ==========================================
apiRouter.get('/human-tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, operatorId, priority } = req.query;
    const list = await repository.getHumanTasks({
      status: status as string,
      operatorId: operatorId as string,
      priority: priority as string,
    });
    res.json(list.map(sanitizeHumanTask));
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/human-tasks/:taskId/assign', requireRole('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await repository.getHumanTaskById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found', code: 'TASK_NOT_FOUND' });
    }
    task.assignedOperatorId = req.body.operatorId;
    task.status = 'ASSIGNED';
    await repository.saveHumanTask(task);
    res.json(sanitizeHumanTask(task));
  } catch (err) {
    next(err);
  }
});

apiRouter.post(
  '/human-tasks/:taskId/complete',
  requireRole('ADMIN', 'SUPERVISOR', 'OPERATOR'),
  validateBody(CompleteHumanTaskSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await lockManager.withLock(`task:${req.params.taskId}`, req.user?.name || 'OPERATOR', async () => {
        return workflowEngine.completeHumanTask({
          taskId: req.params.taskId,
          completedBy: req.user?.name || 'OPERATOR',
          role: req.user?.role,
          notes: req.body.notes,
          payload: req.body.resolutionPayload,
        });
      });
      res.json({
        task: sanitizeHumanTask(result.task),
        job: sanitizeJob(result.job),
      });
    } catch (err) {
      next(err);
    }
  }
);

apiRouter.post('/human-tasks/:taskId/remind', requireRole('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await repository.getHumanTaskById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found', code: 'TASK_NOT_FOUND' });
    }
    task.reminderCount += 1;
    task.lastReminderSentAt = new Date().toISOString();
    await repository.saveHumanTask(task);

    const notif = await telegramNotificationService.sendTaskReminder(task, `T+${task.reminderCount * 15}`);
    res.json({ success: true, notification: notif });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 5. APPLICATION ATTEMPTS HISTORY
// ==========================================
apiRouter.get('/applications/:jobId/attempts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempts = await repository.getApplicationAttempts(req.params.jobId);
    res.json(attempts);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/applications/attempts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempts = await repository.getApplicationAttempts();
    res.json(attempts);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 6. SYSTEM SETTINGS
// ==========================================
apiRouter.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await repository.getSettings());
  } catch (err) {
    next(err);
  }
});

apiRouter.patch(
  '/settings',
  mutationRateLimiter,
  requireRole('ADMIN'),
  validateBody(UpdateSettingsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updates = req.body as Partial<SystemSettings>;
      const updated = await repository.updateSettings(updates, req.user?.name || 'ADMIN');
      await repository.addAuditLog({
        actor: req.user?.name || 'ADMIN',
        actorRole: 'ADMIN',
        action: 'ADMIN_CHANGED_SETTING',
        result: 'SUCCESS',
        metadata: updates,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 7. RETRY POLICIES
// ==========================================
apiRouter.get('/retry-policies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await repository.getRetryPolicies());
  } catch (err) {
    next(err);
  }
});

apiRouter.patch(
  '/retry-policies/:policyId',
  requireRole('ADMIN'),
  validateBody(UpdateRetryPolicySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const policies = await repository.getRetryPolicies();
      const policy = policies.find((p) => p.policyId === req.params.policyId);
      if (!policy) {
        return res.status(404).json({ error: 'Retry policy not found', code: 'POLICY_NOT_FOUND' });
      }
      Object.assign(policy, req.body);
      await repository.saveRetryPolicy(policy);
      res.json(policy);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 8. OPERATORS
// ==========================================
apiRouter.get('/operators', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await repository.getOperators());
  } catch (err) {
    next(err);
  }
});

apiRouter.post(
  '/operators',
  requireRole('ADMIN'),
  validateBody(CreateOperatorSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, role, telegramChatId, maxConcurrentHumanTasks } = req.body;
      const operators = await repository.getOperators();
      const operatorId = `OP-00${operators.length + 1}`;

      const operator = {
        operatorId,
        name,
        email,
        role: role || 'OPERATOR',
        telegramChatId,
        active: true,
        maxConcurrentHumanTasks: maxConcurrentHumanTasks || 4,
        currentTasksCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await repository.saveOperator(operator);
      res.status(201).json(operator);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 9. GOOGLE SHEETS SYNC
// ==========================================
apiRouter.post('/sheets/sync', requireRole('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await googleSheetsService.syncAllSheets();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/sheets/sync/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await repository.getSheetSyncLogs());
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/sheets/export/csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const csv = await googleSheetsService.exportMasterQueue();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="master_queue_export.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 10. NOTIFICATIONS & TELEGRAM
// ==========================================
apiRouter.get('/notifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    res.json(await repository.getNotifications(limit));
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/notifications/test', requireRole('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notif = await telegramNotificationService.sendNotification({
      type: 'INFO',
      title: 'Manual Test Notification',
      message: req.body.message || 'Test broadcast from Workflow Operations Platform.',
    });
    res.json(notif);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 11. OUTLOOK / MICROSOFT GRAPH HEALTH
// ==========================================
apiRouter.get('/integrations/outlook/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await microsoftGraphService.getMailboxStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 12. AUDIT LOGS (WITH FILTERING & PAGINATION)
// ==========================================
apiRouter.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId, actor, limit } = req.query;
    const logs = await repository.getAuditLogs({
      jobId: jobId as string,
      actor: actor as string,
      limit: limit ? parseInt(limit as string, 10) : 100,
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 13. CLOUD SCHEDULER ENDPOINTS
// ==========================================
apiRouter.post('/scheduler/process-queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await workflowEngine.processQueue();
    res.json({
      task: 'PROCESS_QUEUE',
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/scheduler/process-human-tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const openTasks = await repository.getHumanTasks({ status: 'OPEN' });
    let remindersDispatched = 0;
    for (const task of openTasks) {
      task.reminderCount += 1;
      task.lastReminderSentAt = new Date().toISOString();
      await repository.saveHumanTask(task);
      await telegramNotificationService.sendTaskReminder(task, `T+${task.reminderCount * 15}`);
      remindersDispatched++;
    }
    res.json({
      task: 'PROCESS_HUMAN_TASKS',
      openTasksChecked: openTasks.length,
      remindersDispatched,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/scheduler/check-reviews', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reviewJobs = (await repository.getJobs({ status: 'WAITING_FOR_REVIEW' })).items;
    res.json({
      task: 'CHECK_REVIEWS',
      reviewJobsChecked: reviewJobs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 14. REPORTS
// ==========================================
apiRouter.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = (await repository.getJobs()).items;
    const attempts = await repository.getApplicationAttempts();
    const humanTasks = await repository.getHumanTasks();
    const sessions = await repository.getSessions();

    const statusDistribution: Record<string, number> = {};
    jobs.forEach((j) => {
      statusDistribution[j.status] = (statusDistribution[j.status] || 0) + 1;
    });

    const outcomeDistribution = {
      APPROVED: attempts.filter((a) => a.finalStatus === 'APPROVED').length,
      REJECTED: attempts.filter((a) => a.finalStatus === 'REJECTED').length,
      PENDING: attempts.filter((a) => a.finalStatus === 'PENDING').length,
    };

    res.json({
      totalJobs: jobs.length,
      totalAttempts: attempts.length,
      statusDistribution,
      outcomeDistribution,
      avgCompletionMinutes: 24.5,
      avgHumanTaskMinutes: 11.2,
      activeSessionsCount: sessions.filter((s) => s.status === 'RUNNING' || s.status === 'PAUSED').length,
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 15. ADMIN UTILITIES
// ==========================================
apiRouter.post('/admin/reset-demo-data', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await repository.resetDemoData();
    res.json({ success: true, message: 'Platform demo data successfully reset.' });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 16. WORKFLOW LIFECYCLE & STEPS
// ==========================================
apiRouter.get('/workflow/steps', (_req: Request, res: Response) => {
  res.json(workflowEngine.getWorkflowSteps());
});

apiRouter.post('/workflow/steps', requireRole('ADMIN', 'SUPERADMIN'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      stepId,
      name,
      phase,
      type,
      requiredPermission,
      timeoutMinutes,
      allowedNextStepIds,
      defaultNextStepId,
      description,
      automatedAction,
      humanInstructions,
    } = req.body;

    if (!stepId || !name || !phase || !type) {
      return res.status(400).json({ error: 'Missing required step fields: stepId, name, phase, type' });
    }

    const stepDef: WorkflowStepDefinition = {
      stepId,
      name,
      phase,
      type,
      requiredPermission: requiredPermission || 'OPERATOR',
      timeoutMinutes: timeoutMinutes || 30,
      allowedNextStepIds: allowedNextStepIds || [],
      defaultNextStepId,
      description: description || '',
      automatedAction,
      humanInstructions,
      isSystemStep: false,
    };

    workflowEngine.registerWorkflowStep(stepDef);
    res.status(201).json(stepDef);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/jobs/:jobId/workflow-runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runs = await repository.getWorkflowRuns(req.params.jobId);
    res.json(runs);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/workflow-runs/:runId/steps', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stepRuns = await repository.getStepRuns({ workflowRunId: req.params.runId });
    res.json(stepRuns);
  } catch (err) {
    next(err);
  }
});
