import { WorkflowStepDefinition, JobStatus, HumanTaskType, WorkflowPhase, WorkflowStepType } from '../types.js';

export const DEFAULT_WORKFLOW_STEPS: WorkflowStepDefinition[] = [
  {
    stepId: 'step_account_prep',
    name: 'Account & Context Preparation',
    description: 'Allocates operational credentials, validates configurations, and initializes execution context.',
    phase: 'PREPARATION',
    type: 'AUTOMATED',
    order: 1,
    associatedJobStatus: 'PREPARING',
    nextDefaultStepId: 'step_profile_setup',
    retryPolicy: {
      maxRetries: 3,
      retryableErrorCodes: ['CONFIG_ERROR', 'LOCK_TIMEOUT'],
      isTechnicalOnly: true,
    },
  },
  {
    stepId: 'step_profile_setup',
    name: 'GoLogin Profile Provisioning',
    description: 'Provisions isolated anti-detect browser fingerprint and profile parameters.',
    phase: 'SESSION_SETUP',
    type: 'AUTOMATED',
    order: 2,
    associatedJobStatus: 'PROFILE_CREATED',
    nextDefaultStepId: 'step_proxy_validation',
    retryPolicy: {
      maxRetries: 3,
      retryableErrorCodes: ['ERR_GOLOGIN_STARTUP', 'BROWSER_START_TIMEOUT'],
      isTechnicalOnly: true,
    },
  },
  {
    stepId: 'step_proxy_validation',
    name: 'Residential Proxy Validation',
    description: 'Validates residential proxy tunnel, checking latency, IP pool reputation, and tunnel stability.',
    phase: 'SESSION_SETUP',
    type: 'AUTOMATED',
    order: 3,
    associatedJobStatus: 'PROXY_CHECKING',
    nextDefaultStepId: 'step_browser_startup',
    retryPolicy: {
      maxRetries: 4,
      retryableErrorCodes: ['PROXY_ERROR', 'ERR_PROXY_TIMEOUT'],
      isTechnicalOnly: true,
    },
  },
  {
    stepId: 'step_browser_startup',
    name: 'Cloud Browser Startup',
    description: 'Launches cloud browser container session and establishes remote debugging websocket.',
    phase: 'SESSION_SETUP',
    type: 'AUTOMATED',
    order: 4,
    associatedJobStatus: 'BROWSER_STARTING',
    nextDefaultStepId: 'step_registration_start',
    retryPolicy: {
      maxRetries: 3,
      retryableErrorCodes: ['ERR_GOLOGIN_STARTUP', 'BROWSER_START_TIMEOUT'],
      isTechnicalOnly: true,
    },
  },
  {
    stepId: 'step_registration_start',
    name: 'Registration Portal Navigation',
    description: 'Opens target merchant signup portal and enters initial account registration details.',
    phase: 'REGISTRATION',
    type: 'AUTOMATED',
    order: 5,
    associatedJobStatus: 'SIGNUP_STARTED',
    nextDefaultStepId: 'step_email_otp_checkpoint',
    retryPolicy: {
      maxRetries: 3,
      retryableErrorCodes: ['ELEMENT_NOT_FOUND', 'NETWORK_TIMEOUT'],
      isTechnicalOnly: true,
    },
  },
  {
    stepId: 'step_email_otp_checkpoint',
    name: 'Email OTP Human Checkpoint',
    description: 'Halts automation. Operator manually inspects authorized Outlook mailbox and submits verification code.',
    phase: 'HUMAN_VERIFICATION',
    type: 'HUMAN_CHECKPOINT',
    order: 6,
    associatedJobStatus: 'WAITING_FOR_EMAIL_OTP',
    humanTaskType: 'EMAIL_OTP',
    requiresHumanCompletion: true,
    nextDefaultStepId: 'step_password_credentials',
    timeoutMinutes: 60,
  },
  {
    stepId: 'step_password_credentials',
    name: 'Account Password Configuration',
    description: 'Applies vault-secured merchant password and security questions.',
    phase: 'REGISTRATION',
    type: 'AUTOMATED',
    order: 7,
    associatedJobStatus: 'PASSWORD_STAGE',
    nextDefaultStepId: 'step_registration_progression',
  },
  {
    stepId: 'step_registration_progression',
    name: 'Registration Progression',
    description: 'Advances onboarding navigation towards business entity and identity verification stages.',
    phase: 'REGISTRATION',
    type: 'AUTOMATED',
    order: 8,
    associatedJobStatus: 'REGISTRATION_CONTINUING',
    nextDefaultStepId: 'step_identity_verification_checkpoint',
  },
  {
    stepId: 'step_identity_verification_checkpoint',
    name: 'Identity Document Verification Checkpoint',
    description: 'Halts automation. Operator conducts manual government identity verification within active session.',
    phase: 'HUMAN_VERIFICATION',
    type: 'HUMAN_CHECKPOINT',
    order: 9,
    associatedJobStatus: 'HUMAN_IDENTITY_VERIFICATION',
    humanTaskType: 'IDENTITY_VERIFICATION',
    requiresHumanCompletion: true,
    nextDefaultStepId: 'step_selfie_verification_checkpoint',
    timeoutMinutes: 120,
  },
  {
    stepId: 'step_selfie_verification_checkpoint',
    name: 'Selfie / Liveness Verification Checkpoint',
    description: 'Halts automation. Operator completes live camera or facial verification challenge.',
    phase: 'HUMAN_VERIFICATION',
    type: 'HUMAN_CHECKPOINT',
    order: 10,
    associatedJobStatus: 'HUMAN_SELFIE_REQUIRED',
    humanTaskType: 'SELFIE',
    requiresHumanCompletion: true,
    nextDefaultStepId: 'step_biometric_checkpoint',
    timeoutMinutes: 60,
  },
  {
    stepId: 'step_biometric_checkpoint',
    name: 'Biometric Confirmation Checkpoint',
    description: 'Halts automation. Operator completes biometric prompt challenge if demanded by platform security.',
    phase: 'HUMAN_VERIFICATION',
    type: 'HUMAN_CHECKPOINT',
    order: 11,
    associatedJobStatus: 'HUMAN_BIOMETRIC_REQUIRED',
    humanTaskType: 'BIOMETRIC',
    requiresHumanCompletion: true,
    nextDefaultStepId: 'step_shop_information',
    timeoutMinutes: 60,
  },
  {
    stepId: 'step_shop_information',
    name: 'Shop Information & Category Configuration',
    description: 'Inputs shop title, business description, inventory category, and return address details.',
    phase: 'REGISTRATION',
    type: 'AUTOMATED',
    order: 12,
    associatedJobStatus: 'SHOP_INFORMATION',
    nextDefaultStepId: 'step_phone_verification_checkpoint',
  },
  {
    stepId: 'step_phone_verification_checkpoint',
    name: 'Phone / SMS Verification Checkpoint',
    description: 'Halts automation. Operator completes manual SMS phone code verification challenge.',
    phase: 'HUMAN_VERIFICATION',
    type: 'HUMAN_CHECKPOINT',
    order: 13,
    associatedJobStatus: 'PHONE_VERIFICATION',
    humanTaskType: 'PHONE_VERIFICATION',
    requiresHumanCompletion: true,
    nextDefaultStepId: 'step_ready_for_submission',
    timeoutMinutes: 60,
  },
  {
    stepId: 'step_ready_for_submission',
    name: 'Pre-Submission Verification & Confirmation',
    description: 'Pre-submission review stage. Verifies all required fields and documents before final dispatch.',
    phase: 'SUBMISSION',
    type: 'MANUAL_TASK',
    order: 14,
    associatedJobStatus: 'READY_FOR_SUBMISSION',
    nextDefaultStepId: 'step_submission',
  },
  {
    stepId: 'step_submission',
    name: 'Final Application Submission',
    description: 'Formally submits merchant application, captures receipt confirmation, and creates immutable ApplicationAttempt.',
    phase: 'SUBMISSION',
    type: 'AUTOMATED',
    order: 15,
    associatedJobStatus: 'SUBMITTED',
    nextDefaultStepId: 'step_review_monitoring',
  },
  {
    stepId: 'step_review_monitoring',
    name: 'Review Status Monitoring',
    description: 'Periodic background check awaiting merchant platform underwriting decision.',
    phase: 'REVIEW',
    type: 'REVIEW_WAIT',
    order: 16,
    associatedJobStatus: 'WAITING_FOR_REVIEW',
    nextDefaultStepId: 'step_approval',
  },
  {
    stepId: 'step_approval',
    name: 'Application Approval',
    description: 'Underwriting approval confirmed. Advances to post-approval merchant setup.',
    phase: 'REVIEW',
    type: 'AUTOMATED',
    order: 17,
    associatedJobStatus: 'APPROVED',
    nextDefaultStepId: 'step_post_approval_setup',
  },
  {
    stepId: 'step_post_approval_setup',
    name: 'Post-Approval Setup & Store Handover',
    description: 'Configures banking payout rails, shipping templates, and concludes lifecycle as completed.',
    phase: 'POST_APPROVAL',
    type: 'POST_APPROVAL',
    order: 18,
    associatedJobStatus: 'COMPLETED',
    isTerminal: true,
  },
];

export class WorkflowStepRegistry {
  private steps: Map<string, WorkflowStepDefinition> = new Map();

  constructor() {
    this.resetToDefaults();
  }

  public resetToDefaults(): void {
    this.steps.clear();
    for (const step of DEFAULT_WORKFLOW_STEPS) {
      this.steps.set(step.stepId, { ...step });
    }
  }

  public getStep(stepId: string): WorkflowStepDefinition | undefined {
    return this.steps.get(stepId);
  }

  public getStepByStatus(status: JobStatus): WorkflowStepDefinition | undefined {
    for (const step of this.steps.values()) {
      if (step.associatedJobStatus === status) {
        return step;
      }
    }
    return undefined;
  }

  public getAllSteps(): WorkflowStepDefinition[] {
    return Array.from(this.steps.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Extensible step registration: Allows adding future steps dynamically
   * without code rewrites or schema migrations.
   */
  public registerStep(step: WorkflowStepDefinition): void {
    if (!step.stepId || !step.name || !step.phase || !step.type) {
      throw new Error('Invalid step definition: stepId, name, phase, and type are required.');
    }
    this.steps.set(step.stepId, { ...step });
  }

  public removeStep(stepId: string): boolean {
    return this.steps.delete(stepId);
  }
}

export const workflowStepRegistry = new WorkflowStepRegistry();
