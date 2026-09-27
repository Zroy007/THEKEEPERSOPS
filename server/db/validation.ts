import { z } from 'zod';
import { ValidationError } from './errors.js';
import {
  Job,
  ApplicationAttempt,
  WorkflowRun,
  StepRun,
  HumanTask,
  Session,
  Notification,
  AuditLog,
} from '../types.js';

const IsoTimestampSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Invalid ISO timestamp',
});

export const JobDomainSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  shopName: z.string().min(1, 'shopName is required'),
  email: z.string().email('Valid email is required'),
  status: z.enum([
    'NEW',
    'QUEUED',
    'PREPARING',
    'PROFILE_CREATED',
    'PROXY_CHECKING',
    'PROXY_READY',
    'BROWSER_STARTING',
    'BROWSER_READY',
    'SIGNUP_STARTED',
    'WAITING_FOR_EMAIL_OTP',
    'PASSWORD_STAGE',
    'REGISTRATION_CONTINUING',
    'HUMAN_IDENTITY_VERIFICATION',
    'HUMAN_SELFIE_REQUIRED',
    'HUMAN_BIOMETRIC_REQUIRED',
    'HUMAN_ACTION_COMPLETED',
    'SHOP_INFORMATION',
    'PHONE_VERIFICATION',
    'READY_FOR_SUBMISSION',
    'SUBMITTED',
    'WAITING_FOR_REVIEW',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'PAUSED',
    'ERROR',
    'RETRY_PENDING',
    'MANUAL_REVIEW',
    'COMPLETED',
  ]),
  subStatus: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']),
  runMode: z.enum(['AUTO', 'SEMI_AUTO', 'MANUAL']),
  autoStart: z.boolean(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
  retryCount: z.number().int().min(0),
  maxRetries: z.number().int().min(0),
  currentAttemptNo: z.number().int().min(1),
  currentWorkflowRunId: z.string().optional(),
  passwordReference: z.string().optional(),
  proxyReference: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const ApplicationAttemptDomainSchema = z.object({
  attemptId: z.string().min(1, 'attemptId is required'),
  attemptNo: z.number().int().min(1, 'attemptNo must be at least 1'),
  jobId: z.string().min(1, 'jobId relationship is required'),
  shopName: z.string().min(1),
  email: z.string().email(),
  finalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ABANDONED']),
  createdAt: IsoTimestampSchema,
  nextAttemptAllowed: z.boolean(),
});

export const WorkflowRunDomainSchema = z.object({
  workflowRunId: z.string().min(1, 'workflowRunId is required'),
  jobId: z.string().min(1, 'jobId relationship is required'),
  runNumber: z.number().int().min(1),
  status: z.enum(['RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'TERMINATED', 'AWAITING_HUMAN']),
  currentStepId: z.string().min(1),
  currentStepName: z.string().min(1),
  currentStatus: z.string().min(1),
  startedAt: IsoTimestampSchema,
  endedAt: IsoTimestampSchema.optional(),
  stepRuns: z.array(z.any()).default([]),
  executionLogs: z.array(z.any()).default([]),
});

export const StepRunDomainSchema = z.object({
  stepRunId: z.string().min(1, 'stepRunId is required'),
  workflowRunId: z.string().min(1, 'workflowRunId relationship is required'),
  jobId: z.string().min(1, 'jobId relationship is required'),
  stepId: z.string().min(1),
  stepName: z.string().min(1),
  stepType: z.string().optional(),
  phase: z.enum([
    'PREPARATION',
    'SESSION_SETUP',
    'REGISTRATION',
    'HUMAN_VERIFICATION',
    'SUBMISSION',
    'REVIEW',
    'POST_APPROVAL',
  ]),
  stepOrder: z.number().int().min(1).optional(),
  status: z.enum(['PENDING', 'RUNNING', 'AWAITING_HUMAN', 'COMPLETED', 'FAILED', 'SKIPPED', 'PAUSED']),
  startedAt: IsoTimestampSchema,
  completedAt: IsoTimestampSchema.optional(),
  durationMs: z.number().int().min(0).optional(),
  actor: z.string().optional(),
  executedBy: z.string().optional(),
  isHumanCheckpoint: z.boolean().optional(),
  humanTaskId: z.string().optional(),
  retryCount: z.number().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  outputPayload: z.record(z.string(), z.any()).optional(),
  executionLogs: z.array(z.any()).optional(),
});

export const HumanTaskDomainSchema = z.object({
  humanTaskId: z.string().min(1, 'humanTaskId is required'),
  jobId: z.string().min(1, 'jobId relationship is required'),
  taskType: z.enum([
    'EMAIL_OTP',
    'IDENTITY_VERIFICATION',
    'SELFIE',
    'BIOMETRIC',
    'PHONE_VERIFICATION',
    'MANUAL_REVIEW',
    'FINAL_SUBMISSION_CONFIRMATION',
  ]),
  status: z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'CANCELLED']),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']),
  createdAt: IsoTimestampSchema,
  dueAt: IsoTimestampSchema,
  completedAt: IsoTimestampSchema.optional(),
  completedBy: z.string().optional(),
  reminderCount: z.number().int().min(0),
});

export const SessionDomainSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  jobId: z.string().min(1, 'jobId relationship is required'),
  gologinProfileId: z.string().min(1),
  status: z.enum(['CREATING', 'ACTIVE', 'IDLE', 'RELEASING', 'TERMINATED', 'ERROR']),
  startedAt: IsoTimestampSchema,
  lastHeartbeat: IsoTimestampSchema,
});

export const NotificationDomainSchema = z.object({
  notificationId: z.string().min(1, 'notificationId is required'),
  type: z.enum(['INFO', 'ACTION_REQUIRED', 'WARNING', 'ERROR', 'SUCCESS', 'ESCALATION']),
  channel: z.enum(['TELEGRAM', 'EMAIL', 'IN_APP']),
  recipient: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  sentAt: IsoTimestampSchema,
  status: z.enum(['SENT', 'FAILED', 'PENDING']),
  attemptCount: z.number().int().min(0),
});

export const AuditLogDomainSchema = z.object({
  auditId: z.string().min(1, 'auditId is required'),
  timestamp: IsoTimestampSchema,
  actor: z.string().min(1),
  action: z.string().min(1),
  result: z.enum(['SUCCESS', 'FAILURE', 'BLOCKED']),
});

/**
 * Validates domain record against its corresponding schema
 */
export function validateDomainRecord<T>(schema: z.ZodSchema<any>, record: T, entityName: string): T {
  const result = schema.safeParse(record);
  if (!result.success) {
    const errorMessages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ValidationError(`Domain validation failed for ${entityName}: ${errorMessages}`, result.error.issues);
  }
  return record;
}
