import React, { useEffect, useState, useCallback } from 'react';
import { api } from './services/api';
import {
  Job,
  Session,
  HumanTask,
  Operator,
  UserRole,
  DashboardMetrics,
  SystemSettings,
  RetryPolicy,
  ApplicationAttempt,
  AuditLog,
  SheetSyncLog,
  IntegrationStatusItem,
} from './types';

import { Navbar } from './components/Navbar';
import { Navigation, NavTab } from './components/Navigation';
import { DashboardPage } from './pages/DashboardPage';
import { JobsPage } from './pages/JobsPage';
import { SessionsPage } from './pages/SessionsPage';
import { HumanTasksPage } from './pages/HumanTasksPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { SheetsSyncPage } from './pages/SheetsSyncPage';
import { SettingsPage } from './pages/SettingsPage';
import { RetryPoliciesPage } from './pages/RetryPoliciesPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { OperatorsPage } from './pages/OperatorsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { AdminPage } from './pages/AdminPage';
import { AccountsPage } from './pages/AccountsPage';
import { RolesPage } from './pages/RolesPage';
import { SystemSettingsPage } from './pages/SystemSettingsPage';

import { NewJobModal } from './components/NewJobModal';
import { HumanTaskModal } from './components/HumanTaskModal';
import { JobDetailsModal } from './components/JobDetailsModal';
import { BrowserSessionModal } from './components/BrowserSessionModal';
import { LoginModal } from './components/LoginModal';
import { BootstrapModal } from './components/BootstrapModal';
import { PasswordChangeModal } from './components/PasswordChangeModal';
import { UserAccount } from './types';
import { onUnauthorized, setAuthToken } from './services/api';
import { Lock, ShieldCheck, LogIn, AlertTriangle, KeyRound, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';

export default function App() {
  // Navigation & Operator State
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [currentOperatorId, setCurrentOperatorId] = useState('OP-001');
  const [currentRole, setCurrentRole] = useState<UserRole>('VIEWER');

  // Core Data Collections
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [humanTasks, setHumanTasks] = useState<HumanTask[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [retryPolicies, setRetryPolicies] = useState<RetryPolicy[]>([]);
  const [attempts, setAttempts] = useState<ApplicationAttempt[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [sheetLogs, setSheetLogs] = useState<SheetSyncLog[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatusItem[]>([]);
  const [mockMode, setMockMode] = useState(true);

  // Modals & Active Selections
  const [isNewJobOpen, setIsNewJobOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Authentication & Super Admin Layer State
  const [loggedInUser, setLoggedInUser] = useState<UserAccount | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Inline Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Forgot Password / Recovery state
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'reset'>('request');
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);

  // Action states
  const [loading, setLoading] = useState(true);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Check initial authentication and bootstrap status
  useEffect(() => {
    let isMounted = true;

    const checkInitialSession = async () => {
      try {
        const bootStatus = await api.getBootstrapStatus().catch(() => ({ needsBootstrap: false }));
        if (isMounted && bootStatus.needsBootstrap) {
          setNeedsBootstrap(true);
          setCheckingAuth(false);
          return;
        }

        const me = await api.getMe();
        if (isMounted && me.user) {
          setLoggedInUser(me.user);
          setCurrentOperatorId(me.user.uid);
          setCurrentRole(me.user.role);
          setMustChangePassword(Boolean(me.mustChangePassword));
          if (me.mustChangePassword) {
            setIsPasswordChangeOpen(true);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setLoggedInUser(null);
          if (err.mustChangePassword) {
            setMustChangePassword(true);
            setIsPasswordChangeOpen(true);
          }
        }
      } finally {
        if (isMounted) {
          setCheckingAuth(false);
        }
      }
    };

    checkInitialSession();

    const unsubscribe = onUnauthorized(() => {
      if (isMounted) {
        setLoggedInUser(null);
        setMetrics(null);
        setJobs([]);
        setSessions([]);
        setHumanTasks([]);
        showToast('Session expired or unauthorized. Please sign in.');
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Main data fetcher
  const loadData = useCallback(async () => {
    if (!loggedInUser || mustChangePassword) return;
    try {
      const [
        metricsRes,
        jobsRes,
        sessionsRes,
        tasksRes,
        operatorsRes,
        settingsRes,
        policiesRes,
        attemptsRes,
        auditRes,
        sheetLogsRes,
        notifRes,
        healthRes,
      ] = await Promise.allSettled([
        api.getMetrics(),
        api.getJobs({ limit: 100 }),
        api.getSessions(),
        api.getHumanTasks(),
        api.getOperators(),
        api.getSettings(),
        api.getRetryPolicies(),
        api.getAttempts(),
        api.getAuditLogs({ limit: 50 }),
        api.getSheetLogs(),
        api.getNotifications(),
        api.getHealth(),
      ]);

      if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value);
      if (jobsRes.status === 'fulfilled') {
        setJobs(jobsRes.value.items);
        setTotalJobs(jobsRes.value.total);
      }
      if (sessionsRes.status === 'fulfilled') setSessions(sessionsRes.value);
      if (tasksRes.status === 'fulfilled') setHumanTasks(tasksRes.value);
      if (operatorsRes.status === 'fulfilled') setOperators(operatorsRes.value);
      if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value);
      if (policiesRes.status === 'fulfilled') setRetryPolicies(policiesRes.value);
      if (attemptsRes.status === 'fulfilled') setAttempts(attemptsRes.value);
      if (auditRes.status === 'fulfilled') setAuditLogs(auditRes.value);
      if (sheetLogsRes.status === 'fulfilled') setSheetLogs(sheetLogsRes.value);
      if (notifRes.status === 'fulfilled') setNotifications(notifRes.value);
      if (healthRes.status === 'fulfilled') {
        setMockMode(healthRes.value.mockMode);
        setIntegrations(healthRes.value.integrations);
      }
    } catch (err) {
      console.error('Error loading platform state', err);
    } finally {
      setLoading(false);
    }
  }, [loggedInUser]);

  useEffect(() => {
    if (!loggedInUser) return;
    loadData();
    // Periodic refresh every 10 seconds for real-time heartbeat and worker updates
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData, loggedInUser]);

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const res = await api.login({ email: loginEmail, password: loginPassword });
      // Validate authenticated session before rendering dashboard
      const me = await api.getMe().catch(() => ({ user: res.user, permissions: [], mustChangePassword: res.mustChangePassword }));
      const activeUser = me.user || res.user;

      setLoggedInUser(activeUser);
      setCurrentOperatorId(activeUser.uid);
      setCurrentRole(activeUser.role);
      const requiresChange = Boolean(res.mustChangePassword || me.mustChangePassword);
      setMustChangePassword(requiresChange);
      showToast(`Welcome back, ${activeUser.name}`);
      if (requiresChange) {
        setIsPasswordChangeOpen(true);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Authentication failed');
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleRequestRecoveryToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoveryMessage(null);
    setRecoverySubmitting(true);
    try {
      const res = await api.forgotPassword(forgotEmail);
      setRecoveryMessage(res.message);
      if (res.devRecoveryToken) {
        setResetToken(res.devRecoveryToken);
      }
      setRecoveryStep('reset');
      showToast('Recovery token generated.');
    } catch (err: any) {
      setRecoveryError(err.message || 'Recovery request failed');
    } finally {
      setRecoverySubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    if (newPassword !== confirmPassword) {
      setRecoveryError('Passwords do not match.');
      return;
    }
    setRecoverySubmitting(true);
    try {
      const res = await api.resetPassword({
        email: forgotEmail,
        token: resetToken,
        newPassword,
      });
      showToast(res.message);
      setIsForgotMode(false);
      setRecoveryStep('request');
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      setLoginPassword('');
      setLoginEmail(forgotEmail);
      setLoginError(null);
    } catch (err: any) {
      setRecoveryError(err.message || 'Password reset failed');
    } finally {
      setRecoverySubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setLoggedInUser(null);
    setMetrics(null);
    setJobs([]);
    setSessions([]);
    setHumanTasks([]);
    showToast('Signed out successfully.');
  };

  // Operator selection
  const handleSelectOperator = (opId: string, role: UserRole) => {
    setCurrentOperatorId(opId);
  };

  // Quick Action: Process Queue Worker
  const handleTriggerQueueWorker = async () => {
    setIsProcessingQueue(true);
    try {
      const res = await api.triggerQueueWorker();
      showToast(`Queue processed: ${res.startedJobs} job(s) dispatched into browser sessions.`);
      await loadData();
    } catch (err: any) {
      showToast(`Error processing queue: ${err.message}`);
    } finally {
      setIsProcessingQueue(false);
    }
  };

  // Quick Action: Sheets Sync
  const handleTriggerSyncSheets = async () => {
    setIsSyncingSheets(true);
    try {
      const res = await api.syncSheets();
      showToast(`Google Sheets sync complete: +${res.pulledJobs} pulled, ${res.pushedJobs} updated.`);
      await loadData();
    } catch (err: any) {
      showToast(`Error syncing sheets: ${err.message}`);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Job Actions
  const handleCreateJob = async (data: Partial<Job>) => {
    try {
      const newJob = await api.createJob(data);
      showToast(`Job ${newJob.jobId} created and en-queued.`);
      await loadData();
    } catch (err: any) {
      alert(`Error creating job: ${err.message}`);
    }
  };

  const handlePauseJob = async (jobId: string) => {
    try {
      await api.pauseJob(jobId, 'Operator manual pause request');
      showToast(`Job ${jobId} and associated browser session paused.`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResumeJob = async (jobId: string) => {
    try {
      await api.resumeJob(jobId);
      showToast(`Job ${jobId} resumed.`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await api.retryJob(jobId);
      showToast(`Technical retry scheduled: ${res.reason}`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmitJob = async (jobId: string) => {
    try {
      await api.submitJob(jobId);
      showToast(`Application for ${jobId} submitted to merchant review.`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReapplyJob = async (jobId: string) => {
    try {
      const res = await api.reapplyJob(jobId);
      showToast(`New attempt #${res.currentAttemptNo} generated for ${jobId}. Historical attempts preserved.`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStopSession = async (sessionId: string) => {
    if (!confirm(`Are you sure you want to stop cloud browser session ${sessionId}?`)) return;
    try {
      await api.stopSession(sessionId);
      showToast(`Browser session ${sessionId} stopped.`);
      await loadData();
      if (selectedSessionId === sessionId) setSelectedSessionId(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Human Task Actions
  const handleCompleteHumanTask = async (taskId: string, notes?: string, payload?: Record<string, any>) => {
    try {
      await api.completeHumanTask(taskId, notes, payload);
      showToast(`Human checkpoint ${taskId} verified. Workflow progression resumed.`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemindHumanTask = async (taskId: string) => {
    try {
      await api.remindHumanTask(taskId);
      showToast(`Reminder alert sent to operator via Telegram.`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAssignHumanTask = async (taskId: string, operatorId: string) => {
    try {
      await api.assignHumanTask(taskId, operatorId);
      showToast(`Task assigned to ${operatorId}.`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Settings & Policies
  const handleSaveSettings = async (updates: Partial<SystemSettings>) => {
    const updated = await api.updateSettings(updates);
    setSettings(updated);
    showToast('Platform settings successfully updated.');
    await loadData();
  };

  const handleSavePolicy = async (policyId: string, updates: Partial<RetryPolicy>) => {
    await api.updateRetryPolicy(policyId, updates);
    showToast(`Retry policy ${policyId} updated.`);
    await loadData();
  };

  const handleCreateOperator = async (data: Partial<Operator>) => {
    await api.createOperator(data);
    showToast(`Operator registered.`);
    await loadData();
  };

  // Active items for modals
  const activeHumanTask = humanTasks.find((t) => t.humanTaskId === selectedTaskId);
  const activeSession = sessions.find((s) => s.sessionId === selectedSessionId);

  const openHumanTasksCount = humanTasks.filter(
    (t) => t.status === 'OPEN' || t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS'
  ).length;

  const activeSessionsCount = sessions.filter(
    (s) => s.status === 'RUNNING' || s.status === 'PAUSED'
  ).length;

  // 1. Initial Authentication Check Screen
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-white font-sans">
        <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-semibold text-slate-300">Verifying secure session credentials...</p>
      </div>
    );
  }

  // 2. Unauthenticated Experience: ONLY branding, login, password recovery, and bootstrap (NO operational controls)
  if (!loggedInUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{toastMessage}</span>
          </div>
        )}

        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
          {/* Platform Branding */}
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight leading-tight">The Keeper's Ops</h1>
              <p className="text-xs text-slate-400 mt-0.5">Private Human-in-the-Loop Operations Console</p>
            </div>
          </div>

          {!isForgotMode ? (
            /* Normal Login Form */
            <>
              <div className="mb-5 p-3.5 bg-slate-800/60 border border-slate-700/70 rounded-xl text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-white">Secure Access Control</strong>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotMode(true);
                        setForgotEmail('zakwanrhmn@gmail.com');
                        setRecoveryStep('request');
                        setRecoveryError(null);
                        setRecoveryMessage(null);
                      }}
                      className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline ml-2 cursor-pointer"
                    >
                      Set / Recover Password
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Primary Owner Account: <span className="font-mono text-amber-300">z********@gmail.com</span>
                  </div>
                </div>
              </div>

              {loginError && (
                <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleInlineLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="operator@internal.domain"
                    autoComplete="username"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:bg-slate-800/90 transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotMode(true);
                        setForgotEmail(loginEmail);
                        setRecoveryStep('request');
                        setRecoveryError(null);
                        setRecoveryMessage(null);
                      }}
                      className="text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter account password"
                    autoComplete="current-password"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:bg-slate-800/90 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginSubmitting}
                  id="btn-login-submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  <LogIn className="w-4 h-4 text-slate-950" />
                  {loginSubmitting ? 'Authenticating...' : 'Sign In to Operations Console'}
                </button>
              </form>

              {needsBootstrap && (
                <div className="mt-6 pt-5 border-t border-slate-800 text-center">
                  <button
                    onClick={() => setNeedsBootstrap(true)}
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 underline"
                  >
                    No Super Admin registered? Run One-Time Bootstrap Setup
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Forgot Password / Recovery Flow */
            <>
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setIsForgotMode(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                  title="Return to Sign In"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-sm font-bold text-white">Owner Password Recovery</h2>
                  <p className="text-[11px] text-slate-400">
                    {recoveryStep === 'request'
                      ? 'Request a secure single-use recovery token'
                      : 'Enter recovery token and establish new password'}
                  </p>
                </div>
              </div>

              {recoveryError && (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{recoveryError}</span>
                </div>
              )}

              {recoveryMessage && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{recoveryMessage}</span>
                </div>
              )}

              {recoveryStep === 'request' ? (
                <form onSubmit={handleRequestRecoveryToken} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Registered Email</label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="owner@internal.domain"
                      autoComplete="email"
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>

                  <div className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl text-[11px] text-slate-400 leading-relaxed">
                    ℹ️ For private self-hosted deployments without outbound SMTP, the recovery token is safely output to your server console logs.
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsForgotMode(false)}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                    >
                      Back to Sign In
                    </button>
                    <button
                      type="submit"
                      disabled={recoverySubmitting}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-950" />
                      {recoverySubmitting ? 'Requesting...' : 'Request Recovery Token'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Recovery Token</label>
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste recovery token"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {resetToken && (
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Local development recovery token loaded. Enter your new password below.</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setRecoveryStep('request')}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Request New Token
                    </button>
                    <button
                      type="submit"
                      disabled={recoverySubmitting}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-950" />
                      {recoverySubmitting ? 'Resetting...' : 'Set New Password'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Super Admin Bootstrap Modal if required */}
        <BootstrapModal
          isOpen={needsBootstrap}
          onSuccess={(user) => {
            setNeedsBootstrap(false);
            setLoggedInUser(user);
            setCurrentOperatorId(user.uid);
            setCurrentRole('SUPERADMIN');
            showToast(`Super Admin initialized successfully. Welcome, ${user.name}`);
          }}
        />
      </div>
    );
  }

  // 3. Authenticated Operational Dashboard Experience
  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col text-slate-900 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Navbar - Exclusively rendered when authenticated */}
      <Navbar
        operators={operators}
        currentOperatorId={currentOperatorId}
        currentRole={currentRole}
        metrics={metrics}
        mockMode={mockMode}
        loggedInUser={loggedInUser}
        mustChangePassword={mustChangePassword}
        onSelectOperator={handleSelectOperator}
        onOpenNewJob={() => setIsNewJobOpen(true)}
        onTriggerQueueWorker={handleTriggerQueueWorker}
        onTriggerSyncSheets={handleTriggerSyncSheets}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenPasswordChange={() => setIsPasswordChangeOpen(true)}
        onLogout={handleLogout}
        isProcessingQueue={isProcessingQueue}
      />

      {/* Primary Navigation Tabs */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        humanTasksCount={openHumanTasksCount}
        activeSessionsCount={activeSessionsCount}
        currentRole={currentRole}
      />

      {/* Main View Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
            {loading && !metrics ? (
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs font-semibold text-slate-500">Connecting to Workflow Engine...</p>
              </div>
            ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardPage
                metrics={metrics}
                sessions={sessions}
                humanTasks={humanTasks}
                recentJobs={jobs}
                operators={operators}
                onOpenSession={(s) => setSelectedSessionId(s.sessionId)}
                onOpenHumanTask={(t) => setSelectedTaskId(t.humanTaskId)}
                onSelectJob={(id) => setSelectedJobId(id)}
                onNavigateTab={(tab) => setActiveTab(tab as NavTab)}
                onPauseJob={handlePauseJob}
                onResumeJob={handleResumeJob}
                onRetryJob={handleRetryJob}
                onManualReviewJob={(id) => api.manualReviewJob(id).then(loadData)}
                onStopSession={handleStopSession}
              />
            )}

            {activeTab === 'admin' && <AdminPage />}
            {activeTab === 'accounts' && <AccountsPage currentRole={currentRole} />}
            {activeTab === 'roles' && <RolesPage currentRole={currentRole} />}
            {(activeTab === 'system-settings' || (activeTab === 'settings' && (currentRole === 'SUPERADMIN' || currentRole === 'ADMIN'))) && (
              <SystemSettingsPage currentRole={currentRole} />
            )}

            {activeTab === 'jobs' && (
              <JobsPage
                jobs={jobs}
                operators={operators}
                totalJobs={totalJobs}
                onRefresh={loadData}
                onSelectJob={(id) => setSelectedJobId(id)}
                onOpenNewJob={() => setIsNewJobOpen(true)}
                onPauseJob={handlePauseJob}
                onResumeJob={handleResumeJob}
                onRetryJob={handleRetryJob}
                onSubmitJob={handleSubmitJob}
              />
            )}

            {activeTab === 'sessions' && (
              <SessionsPage
                sessions={sessions}
                operators={operators}
                concurrencyLimit={metrics?.concurrencyLimit ?? 6}
                onRefresh={loadData}
                onOpenSession={(s) => setSelectedSessionId(s.sessionId)}
                onPauseJob={handlePauseJob}
                onResumeJob={handleResumeJob}
                onRetryJob={handleRetryJob}
                onManualReviewJob={(id) => api.manualReviewJob(id).then(loadData)}
                onStopSession={handleStopSession}
                onSelectJob={(id) => setSelectedJobId(id)}
              />
            )}

            {activeTab === 'human-tasks' && (
              <HumanTasksPage
                humanTasks={humanTasks}
                operators={operators}
                onRefresh={loadData}
                onOpenTask={(t) => setSelectedTaskId(t.humanTaskId)}
                onRemindTask={handleRemindHumanTask}
                onAssignTask={handleAssignHumanTask}
                onSelectJob={(id) => setSelectedJobId(id)}
              />
            )}

            {activeTab === 'applications' && (
              <ApplicationsPage
                attempts={attempts}
                operators={operators}
                onSelectJob={(id) => setSelectedJobId(id)}
                onReapplyJob={handleReapplyJob}
              />
            )}

            {activeTab === 'sheets' && (
              <SheetsSyncPage
                logs={sheetLogs}
                jobs={jobs}
                onSync={handleTriggerSyncSheets}
                isSyncing={isSyncingSheets}
              />
            )}

            {activeTab === 'settings' && settings && (
              <SettingsPage settings={settings} onSaveSettings={handleSaveSettings} />
            )}

            {activeTab === 'retry-policies' && (
              <RetryPoliciesPage policies={retryPolicies} onSavePolicy={handleSavePolicy} />
            )}

            {activeTab === 'audit-logs' && <AuditLogsPage logs={auditLogs} />}

            {activeTab === 'operators' && (
              <OperatorsPage operators={operators} onCreateOperator={handleCreateOperator} />
            )}

            {activeTab === 'notifications' && (
              <NotificationsPage
                notifications={notifications}
                onTestNotification={(msg) => api.testNotification(msg).then(loadData)}
              />
            )}

            {activeTab === 'reports' && <ReportsPage metrics={metrics} jobs={jobs} />}

            {activeTab === 'health' && (
              <SystemHealthPage
                integrations={integrations}
                mockMode={mockMode}
                onRefresh={loadData}
                onResetDemoData={() => api.resetDemoData().then(loadData)}
                onTriggerQueueWorker={handleTriggerQueueWorker}
                onTriggerHumanTaskWorker={async () => {
                  const res = await api.triggerHumanTaskWorker();
                  showToast(`Human task check complete: ${res.remindersDispatched} reminder(s) dispatched.`);
                  await loadData();
                }}
                onTriggerReviewWorker={async () => {
                  const res = await api.triggerReviewWorker();
                  showToast(`Review poller complete: ${res.reviewJobsChecked} job(s) checked.`);
                  await loadData();
                }}
              />
            )}
          </>
        )}
      </main>

      {/* MODALS */}
      {/* 1. New Job Modal */}
      {isNewJobOpen && (
        <NewJobModal
          onClose={() => setIsNewJobOpen(false)}
          onCreateJob={handleCreateJob}
        />
      )}

      {/* 2. Human Task Verification Modal */}
      {activeHumanTask && (
        <HumanTaskModal
          task={activeHumanTask}
          operators={operators}
          onClose={() => setSelectedTaskId(null)}
          onComplete={handleCompleteHumanTask}
          onRemind={handleRemindHumanTask}
        />
      )}

      {/* 3. Live Job Details Modal */}
      {selectedJobId && (
        <JobDetailsModal
          jobId={selectedJobId}
          operators={operators}
          onClose={() => setSelectedJobId(null)}
          onRefreshParent={loadData}
          onOpenSession={(s) => setSelectedSessionId(s.sessionId)}
          onOpenHumanTask={(t) => setSelectedTaskId(t.humanTaskId)}
        />
      )}

      {/* 4. Browser Session Cloud Viewer Modal */}
      {activeSession && (
        <BrowserSessionModal
          session={activeSession}
          onClose={() => setSelectedSessionId(null)}
          onPauseJob={handlePauseJob}
          onResumeJob={handleResumeJob}
          onStopSession={handleStopSession}
        />
      )}

      {/* 5. Platform Sign In Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={(user, mustChange) => {
          setLoggedInUser(user);
          setCurrentOperatorId(user.uid);
          setMustChangePassword(mustChange);
          if (user.role === 'SUPERADMIN' || user.role === 'ADMIN') {
            setCurrentRole(user.role as any);
          }
          showToast(`Signed in successfully as ${user.name} (${user.role})`);
          if (mustChange) {
            setIsPasswordChangeOpen(true);
          }
        }}
      />

      {/* 6. One-Time Super Admin Bootstrap Modal */}
      <BootstrapModal
        isOpen={needsBootstrap}
        onSuccess={(user) => {
          setNeedsBootstrap(false);
          setLoggedInUser(user);
          setCurrentOperatorId(user.uid);
          setCurrentRole('SUPERADMIN');
          showToast(`Super Admin initialized successfully. Welcome, ${user.name}`);
        }}
      />

      {/* 7. Password Change Modal */}
      <PasswordChangeModal
        isOpen={isPasswordChangeOpen}
        userEmail={loggedInUser?.email || 'zakwanrhmn@gmail.com'}
        isMandatory={mustChangePassword}
        onSuccess={() => {
          setMustChangePassword(false);
          setIsPasswordChangeOpen(false);
          showToast('Password updated securely. Permanent credential active.');
          api.getMe().then((res) => setLoggedInUser(res.user)).catch(() => {});
        }}
        onCancel={!mustChangePassword ? () => setIsPasswordChangeOpen(false) : undefined}
      />
    </div>
  );
}
