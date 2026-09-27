import {
  Job,
  Session,
  HumanTask,
  Operator,
  SystemSettings,
  RetryPolicy,
  ApplicationAttempt,
  AuditLog,
  IntegrationStatusItem,
  DashboardMetrics,
  SheetSyncLog,
  UserRole,
  UserAccount,
  RoleDefinition,
  SecretMetadata,
  SettingVersion,
  WorkflowStepDefinition,
  WorkflowRun,
  StepRun,
} from '../types';

// In-memory authentication state with sessionStorage persistence for tab survival
const TOKEN_STORAGE_KEY = 'thekeepersops_session_token';

function getStoredToken(): string | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // sessionStorage unavailable
  }
  return null;
}

let inMemoryAuthToken: string | null = getStoredToken();
type UnauthorizedHandler = () => void;
let unauthorizedHandlers: UnauthorizedHandler[] = [];

export function onUnauthorized(handler: UnauthorizedHandler) {
  unauthorizedHandlers.push(handler);
  return () => {
    unauthorizedHandlers = unauthorizedHandlers.filter((h) => h !== handler);
  };
}

export function setAuthToken(token: string | null) {
  inMemoryAuthToken = token;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (token) {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  } catch {
    // ignore storage error
  }
}

export function getAuthToken(): string | null {
  return inMemoryAuthToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  // CSRF protection marker for cookie-based session authentication
  headers.set('X-Requested-With', 'XMLHttpRequest');

  if (inMemoryAuthToken) {
    headers.set('Authorization', `Bearer ${inMemoryAuthToken}`);
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include', // Automatically send HttpOnly session cookie
    headers,
  });

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    let isMustChangePassword = false;
    let errorCode: string | undefined;

    try {
      const data = await res.json();
      if (data.error) errorMsg = data.error;
      if (data.code) errorCode = data.code;
      if (data.mustChangePassword) isMustChangePassword = true;
    } catch {
      // ignore json parse error
    }

    if (res.status === 401) {
      const wasAuthenticated = Boolean(inMemoryAuthToken);
      setAuthToken(null);
      // Only fire unauthorized handlers if an active authenticated session was rejected
      // Avoid firing on initial /auth/me probe or during /auth/login credential failure
      if (wasAuthenticated && path !== '/auth/login') {
        unauthorizedHandlers.forEach((handler) => handler());
      }
    }

    const err: any = new Error(errorMsg);
    err.status = res.status;
    err.code = errorCode;
    err.mustChangePassword = isMustChangePassword;
    throw err;
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Authentication & Bootstrap
  getBootstrapStatus: () =>
    request<{ needsBootstrap: boolean; activeSuperAdminsCount: number }>('/auth/bootstrap-status'),
  bootstrap: async (data: { name: string; email: string; password: string; bootstrapSecret?: string }) => {
    const res = await request<{ success: boolean; message: string; token: string; user: UserAccount }>('/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },
  login: async (credentials: { email: string; password: string }) => {
    const res = await request<{ token: string; user: UserAccount; mustChangePassword: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },
  forgotPassword: (email: string) =>
    request<{ success: boolean; message: string; emailConfigured: boolean; devRecoveryToken?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (data: { email: string; token: string; newPassword: string }) =>
    request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  changePassword: async (data: { currentPassword?: string; newPassword: string }) => {
    const res = await request<{ success: boolean; message: string; token: string; user: UserAccount }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },
  getMe: () => request<{ user: UserAccount; permissions: string[]; mustChangePassword: boolean }>('/auth/me'),
  logout: async () => {
    try {
      return await request<{ success: boolean }>('/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null);
    }
  },

  // SuperAdmin: Accounts
  getUsers: (params?: { search?: string; role?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.role) query.set('role', params.role);
    if (params?.status) query.set('status', params.status);
    return request<{ items: UserAccount[]; total: number }>(`/admin/users?${query.toString()}`);
  },
  createUser: (user: Partial<UserAccount> & { password?: string }) =>
    request<UserAccount>('/admin/users', { method: 'POST', body: JSON.stringify(user) }),
  getUser: (id: string) => request<UserAccount>(`/admin/users/${id}`),
  updateUser: (id: string, updates: Partial<UserAccount> & { resetPassword?: string }) =>
    request<UserAccount>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteUser: (id: string) => request<{ success: boolean; message: string }>(`/admin/users/${id}`, { method: 'DELETE' }),
  unlockUser: (id: string) => request<UserAccount>(`/admin/users/${id}/unlock`, { method: 'POST' }),
  resetUserPassword: (id: string, resetPassword: string) =>
    request<UserAccount>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ resetPassword }) }),

  // SuperAdmin: Roles
  getRoles: () => request<{ items: RoleDefinition[]; total: number; allAvailablePermissions: string[] }>('/admin/roles'),
  createRole: (role: Partial<RoleDefinition>) =>
    request<RoleDefinition>('/admin/roles', { method: 'POST', body: JSON.stringify(role) }),
  updateRole: (id: string, updates: Partial<RoleDefinition>) =>
    request<RoleDefinition>(`/admin/roles/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteRole: (id: string) => request<{ success: boolean; message: string }>(`/admin/roles/${id}`, { method: 'DELETE' }),

  // SuperAdmin: Settings Versioning & Rollback
  getSettingsHistory: () => request<{ items: SettingVersion[]; total: number }>('/admin/settings/history'),
  rollbackSetting: (versionId: string) =>
    request<{ success: boolean; message: string; settingKey: string; restoredValue: any }>(
      `/admin/settings/rollback/${versionId}`,
      { method: 'POST' }
    ),

  // SuperAdmin: Secrets Management
  getSecrets: () => request<{ items: SecretMetadata[]; total: number }>('/admin/secrets'),
  updateSecret: (key: string, value: string) =>
    request<{ success: boolean; message: string; key: string; status: string }>(`/admin/secrets/${key}`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    }),
  clearSecret: (key: string) =>
    request<{ success: boolean; message: string; key: string; status: string }>(`/admin/secrets/${key}`, {
      method: 'DELETE',
    }),

  // SuperAdmin: Integration Connection Testing
  testGoLogin: () => request<any>('/admin/settings/test-gologin', { method: 'POST' }),
  testTelegram: () => request<any>('/admin/settings/test-telegram', { method: 'POST' }),
  testOutlook: () => request<any>('/admin/settings/test-outlook', { method: 'POST' }),
  testSheets: () => request<any>('/admin/settings/test-sheets', { method: 'POST' }),
  testGoLoginConnection: () => request<any>('/admin/settings/test-gologin', { method: 'POST' }),
  testTelegramConnection: () => request<any>('/admin/settings/test-telegram', { method: 'POST' }),
  testOutlookConnection: () => request<any>('/admin/settings/test-outlook', { method: 'POST' }),
  testSheetsConnection: () => request<any>('/admin/settings/test-sheets', { method: 'POST' }),

  // Metrics & Health
  getMetrics: () => request<DashboardMetrics>('/dashboard/metrics'),
  getHealth: () => request<{ status: string; mockMode: boolean; integrations: IntegrationStatusItem[] }>('/health'),
  getIntegrations: () => request<IntegrationStatusItem[]>('/integrations/status'),

  // Jobs
  getJobs: (params?: { status?: string; operatorId?: string; search?: string; priority?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.operatorId) query.set('operatorId', params.operatorId);
    if (params?.search) query.set('search', params.search);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    return request<{ items: Job[]; total: number }>(`/jobs?${query.toString()}`);
  },
  getJob: (jobId: string) =>
    request<{
      job: Job;
      session?: Session;
      humanTasks: HumanTask[];
      attempts: ApplicationAttempt[];
      auditLogs: AuditLog[];
      workflowRuns?: WorkflowRun[];
      stepRuns?: StepRun[];
    }>(`/jobs/${jobId}`),
  getWorkflowSteps: () => request<{ items: WorkflowStepDefinition[]; total: number }>('/workflow/steps'),
  getWorkflowRuns: (jobId: string) => request<{ items: WorkflowRun[]; total: number }>(`/jobs/${jobId}/workflow-runs`),
  getWorkflowStepRuns: (runId: string) => request<{ items: StepRun[]; total: number }>(`/workflow-runs/${runId}/steps`),
  createJob: (job: Partial<Job>) => request<Job>('/jobs', { method: 'POST', body: JSON.stringify(job) }),
  patchJob: (jobId: string, updates: Partial<Job>) => request<Job>(`/jobs/${jobId}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  pauseJob: (jobId: string, reason?: string) => request<Job>(`/jobs/${jobId}/pause`, { method: 'POST', body: JSON.stringify({ reason }) }),
  resumeJob: (jobId: string) => request<Job>(`/jobs/${jobId}/resume`, { method: 'POST' }),
  retryJob: (jobId: string) => request<{ retried: boolean; reason: string }>(`/jobs/${jobId}/retry`, { method: 'POST' }),
  manualReviewJob: (jobId: string, reason?: string) =>
    request<Job>(`/jobs/${jobId}/manual-review`, { method: 'POST', body: JSON.stringify({ reason }) }),
  submitJob: (jobId: string) => request<Job>(`/jobs/${jobId}/submit`, { method: 'POST' }),
  reapplyJob: (jobId: string) => request<Job>(`/jobs/${jobId}/reapply`, { method: 'POST' }),
  rejectJob: (jobId: string, reason: string) => request<Job>(`/jobs/${jobId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Sessions
  getSessions: (params?: { status?: string; operatorId?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.operatorId) query.set('operatorId', params.operatorId);
    return request<Session[]>(`/sessions?${query.toString()}`);
  },
  getSession: (sessionId: string) => request<Session>(`/sessions/${sessionId}`),
  stopSession: (sessionId: string) => request<{ success: boolean }>(`/sessions/${sessionId}/stop`, { method: 'POST' }),

  // Human Tasks
  getHumanTasks: (params?: { status?: string; operatorId?: string; priority?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.operatorId) query.set('operatorId', params.operatorId);
    if (params?.priority) query.set('priority', params.priority);
    return request<HumanTask[]>(`/human-tasks?${query.toString()}`);
  },
  assignHumanTask: (taskId: string, operatorId: string) =>
    request<HumanTask>(`/human-tasks/${taskId}/assign`, { method: 'POST', body: JSON.stringify({ operatorId }) }),
  completeHumanTask: (taskId: string, notes?: string, payload?: Record<string, any>) =>
    request<{ task: HumanTask; job: Job }>(`/human-tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ notes, payload }),
    }),
  remindHumanTask: (taskId: string) => request<{ success: boolean }>(`/human-tasks/${taskId}/remind`, { method: 'POST' }),

  // Applications / Attempts
  getAttempts: (jobId?: string) =>
    request<ApplicationAttempt[]>(jobId ? `/applications/${jobId}/attempts` : '/applications/attempts'),

  // Settings
  getSettings: () => request<SystemSettings>('/settings'),
  updateSettings: (updates: Partial<SystemSettings>) =>
    request<SystemSettings>('/settings', { method: 'PATCH', body: JSON.stringify(updates) }),

  // Retry Policies
  getRetryPolicies: () => request<RetryPolicy[]>('/retry-policies'),
  updateRetryPolicy: (policyId: string, updates: Partial<RetryPolicy>) =>
    request<RetryPolicy>(`/retry-policies/${policyId}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  // Operators
  getOperators: () => request<Operator[]>('/operators'),
  createOperator: (data: Partial<Operator>) => request<Operator>('/operators', { method: 'POST', body: JSON.stringify(data) }),

  // Sheets Sync
  syncSheets: () => request<{ success: boolean; pulledJobs: number; pushedJobs: number; logs: SheetSyncLog[] }>('/sheets/sync', { method: 'POST' }),
  getSheetLogs: () => request<SheetSyncLog[]>('/sheets/sync/status'),

  // Notifications
  getNotifications: () => request<any[]>('/notifications'),
  testNotification: (message: string) => request<any>('/notifications/test', { method: 'POST', body: JSON.stringify({ message }) }),

  // Audit Logs
  getAuditLogs: (params?: { jobId?: string; actor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.jobId) query.set('jobId', params.jobId);
    if (params?.actor) query.set('actor', params.actor);
    if (params?.limit) query.set('limit', String(params.limit));
    return request<AuditLog[]>(`/audit-logs?${query.toString()}`);
  },

  // Cloud Scheduler triggers
  triggerQueueWorker: () => request<{ task: string; startedJobs: number; capacityRemaining: number }>('/scheduler/process-queue', { method: 'POST' }),
  triggerHumanTaskWorker: () => request<{ task: string; remindersDispatched: number }>('/scheduler/process-human-tasks', { method: 'POST' }),
  triggerReviewWorker: () => request<{ task: string; reviewJobsChecked: number }>('/scheduler/check-reviews', { method: 'POST' }),

  // Reports
  getReports: () => request<any>('/reports'),

  // Admin
  resetDemoData: () => request<{ success: boolean; message: string }>('/admin/reset-demo-data', { method: 'POST' }),
};
