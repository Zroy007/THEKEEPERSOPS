import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Schema for Creating a Job
export const CreateJobSchema = z.object({
  shopName: z.string().min(2, 'Shop name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  passwordReference: z.string().optional(),
  proxyReference: z.string().min(5, 'Proxy reference required (e.g. proxy://host:port)'),
  gologinProfileId: z.string().optional(),
  gologinProfileName: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
  runMode: z.enum(['AUTO', 'SEMI_AUTO', 'MANUAL']).default('AUTO'),
  autoStart: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(1000).optional(),
});

// Schema for Transitioning a Job State
export const TransitionJobSchema = z.object({
  newStatus: z.string().min(2, 'newStatus is required'),
  reason: z.string().max(500).optional(),
});

// Schema for Completing a Human Task Checkpoint
export const CompleteHumanTaskSchema = z.object({
  notes: z.string().max(1000).optional(),
  resolutionPayload: z.record(z.string(), z.any()).optional(),
});

// Schema for Reapplication
export const ReapplyJobSchema = z.object({
  notes: z.string().max(1000).optional(),
});

// Schema for System Settings Update
export const UpdateSettingsSchema = z.object({
  concurrencyLimit: z.number().int().min(1).max(50).optional(),
  queueLimit: z.number().int().min(1).max(500).optional(),
  autoStartJobs: z.boolean().optional(),
  defaultPriority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
  otpTimeoutMinutes: z.number().int().min(1).max(120).optional(),
  reminderIntervalMinutes: z.number().int().min(1).max(60).optional(),
  autoRetryTechnicalErrors: z.boolean().optional(),
  maxAutomaticRetries: z.number().int().min(0).max(10).optional(),
  sheetsSyncEnabled: z.boolean().optional(),
  telegramNotificationsEnabled: z.boolean().optional(),
  outlookIntegrationEnabled: z.boolean().optional(),
  gologinEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  mockMode: z.boolean().optional(),
});

// Schema for Creating Operator
export const CreateOperatorSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'OPERATOR', 'VIEWER']),
  telegramChatId: z.string().optional(),
  maxConcurrentHumanTasks: z.number().int().min(1).max(20).default(5),
});

// Schema for Updating Operator
export const UpdateOperatorSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'OPERATOR', 'VIEWER']).optional(),
  telegramChatId: z.string().optional(),
  active: z.boolean().optional(),
  maxConcurrentHumanTasks: z.number().int().min(1).max(20).optional(),
});

// Schema for Updating Retry Policy
export const UpdateRetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(10).optional(),
  initialDelaySeconds: z.number().int().min(1).max(300).optional(),
  maxDelaySeconds: z.number().int().min(1).max(3600).optional(),
  backoffMultiplier: z.number().min(1.0).max(5.0).optional(),
  enabled: z.boolean().optional(),
});

/**
 * Express middleware helper for body validation with Zod
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues;
      const formattedErrors = issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return res.status(400).json({
        error: 'Validation failed for request payload',
        code: 'VALIDATION_ERROR',
        details: formattedErrors,
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Express middleware helper for query params validation with Zod
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const issues = result.error.issues;
      const formattedErrors = issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return res.status(400).json({
        error: 'Invalid query parameters',
        code: 'QUERY_VALIDATION_ERROR',
        details: formattedErrors,
      });
    }
    req.query = result.data as any;
    next();
  };
}
