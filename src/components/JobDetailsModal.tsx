import React, { useEffect, useState } from 'react';
import {
  X,
  Clock,
  Monitor,
  Shield,
  RotateCcw,
  Play,
  Pause,
  Send,
  ExternalLink,
  Tag,
  CheckCircle2,
  AlertTriangle,
  History,
  FileText,
  UserCheck,
  Globe,
  Radio,
  Copy,
  Check,
  ChevronRight,
  Info,
  GitBranch,
  Layers,
  Cpu,
  CheckCircle,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Job,
  Session,
  HumanTask,
  ApplicationAttempt,
  AuditLog,
  Operator,
  JobStatus,
  WorkflowRun,
  StepRun,
} from '../types';
import { StatusBadge } from './StatusBadge';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';

interface JobDetailsModalProps {
  jobId: string;
  operators: Operator[];
  onClose: () => void;
  onRefreshParent: () => void;
  onOpenSession: (session: Session) => void;
  onOpenHumanTask: (task: HumanTask) => void;
}

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
  jobId,
  operators,
  onClose,
  onRefreshParent,
  onOpenSession,
  onOpenHumanTask,
}) => {
  const [data, setData] = useState<{
    job: Job;
    session?: Session;
    humanTasks: HumanTask[];
    attempts: ApplicationAttempt[];
    auditLogs: AuditLog[];
    workflowRuns?: WorkflowRun[];
    stepRuns?: StepRun[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const fetchJob = async () => {
    try {
      setLoading(true);
      const res = await api.getJob(jobId);
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading && !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
        <div className="bg-white p-6 rounded-xl shadow-xl border border-slate-200 text-center">
          <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading Job {jobId}...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
        <div className="bg-white p-6 rounded-xl max-w-md w-full text-center space-y-3 border border-slate-200 shadow-xl">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-semibold text-slate-900">Error loading job details</p>
          <p className="text-xs text-slate-500">{error || 'Job not found'}</p>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  const { job, session, humanTasks, attempts, auditLogs, workflowRuns = [], stepRuns = [] } = data;
  const assignedOperator = operators.find((o) => o.operatorId === job.operatorId);

  const activeRun = workflowRuns.find((r) => r.workflowRunId === selectedRunId) || workflowRuns[workflowRuns.length - 1] || null;
  const currentRunStepRuns = stepRuns.filter((s) => !activeRun || s.workflowRunId === activeRun.workflowRunId);

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await api.pauseJob(job.jobId, 'Manual pause by operator');
      await fetchJob();
      onRefreshParent();
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      await api.resumeJob(job.jobId);
      await fetchJob();
      onRefreshParent();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async () => {
    setActionLoading(true);
    try {
      await api.retryJob(job.jobId);
      await fetchJob();
      onRefreshParent();
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      await api.submitJob(job.jobId);
      await fetchJob();
      onRefreshParent();
    } finally {
      setActionLoading(false);
    }
  };

  const isPaused = job.status === 'PAUSED';
  const isError = job.status === 'ERROR';

  // Standard ordered pipeline stages for vertical timeline (Section 14)
  const timelineStages: { status: JobStatus; title: string; desc: string }[] = [
    { status: 'NEW', title: 'New Job Ingested', desc: 'Job entry registered from master spreadsheet or API' },
    { status: 'PROFILE_CREATED', title: 'GoLogin Profile Created', desc: 'Fingerprint and isolation container provisioned' },
    { status: 'PROXY_READY', title: 'Proxy Ready & Checked', desc: 'Residential IP validated with target merchant portal' },
    { status: 'BROWSER_READY', title: 'Browser Instance Started', desc: 'Automation script initialized with headless/headful runner' },
    { status: 'WAITING_FOR_EMAIL_OTP', title: 'Email OTP Verification', desc: '2FA verification code dispatched to email' },
    { status: 'HUMAN_IDENTITY_VERIFICATION', title: 'Identity Verification Checkpoint', desc: 'Government ID & selfie document submission' },
    { status: 'SUBMITTED', title: 'Application Submitted', desc: 'Onboarding packet submitted to merchant portal review' },
    { status: 'WAITING_FOR_REVIEW', title: 'Waiting Review & Polling', desc: 'Automated status poller monitoring merchant approval' },
    { status: 'APPROVED', title: 'Approved & Finalized', desc: 'Application approved and merchant dashboard active' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200/90 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden text-slate-900 animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* 1. OPERATIONAL HEADER (Section 13) */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 tracking-tight">
                {job.shopName}
              </span>
              <span className="font-mono text-xs text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-sm">
                {job.jobId}
              </span>
              <StatusBadge status={job.status} size="sm" />
              <Badge
                variant={
                  job.priority === 'CRITICAL'
                    ? 'danger'
                    : job.priority === 'HIGH'
                    ? 'warning'
                    : 'neutral'
                }
                size="xs"
              >
                {job.priority} Priority
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
              <span>Run Mode: <strong className="text-slate-700">{job.runMode}</strong></span>
              <span>&bull;</span>
              <span>Operator: <strong className="text-slate-700">{assignedOperator?.name || 'Unassigned'}</strong></span>
              <span>&bull;</span>
              <span>Retries: <strong className="text-slate-700">{job.retryCount}/{job.maxRetries}</strong></span>
            </div>
          </div>

          {/* Action buttons bar */}
          <div className="flex items-center gap-2 shrink-0">
            {isPaused ? (
              <Button
                variant="success"
                size="sm"
                loading={actionLoading}
                onClick={handleResume}
                leftIcon={<Play className="w-3.5 h-3.5" />}
              >
                Resume
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                loading={actionLoading}
                onClick={handlePause}
                leftIcon={<Pause className="w-3.5 h-3.5 text-amber-600" />}
              >
                Pause
              </Button>
            )}

            {isError && (
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading}
                onClick={handleRetry}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Retry
              </Button>
            )}

            {job.status === 'READY_FOR_SUBMISSION' && (
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading}
                onClick={handleSubmit}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                Submit
              </Button>
            )}

            {session && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenSession(session)}
                leftIcon={<Monitor className="w-3.5 h-3.5 text-sky-600" />}
              >
                Open Session
              </Button>
            )}

            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. MAIN WORKSPACE SCROLL BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Top Split: JOB INFORMATION (Left) + CURRENT WORKFLOW STATE (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Box: Job Information */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                Job Information
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block">Registration Email</span>
                  <span className="font-mono text-slate-800 font-medium truncate block">
                    {job.email}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block">Proxy Reference</span>
                  <span className="font-mono text-slate-800 font-medium truncate block">
                    {job.proxyReference || (job as any).proxyRef || 'Default Residential US'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block">Created Timestamp</span>
                  <span className="font-mono text-slate-600 text-[11px] block">
                    {new Date(job.createdAt).toLocaleString()}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block">Last Updated</span>
                  <span className="font-mono text-slate-600 text-[11px] block">
                    {new Date(job.updatedAt).toLocaleString()}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className="text-[11px] text-slate-400 block mb-1">Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {job.tags && job.tags.length > 0 ? (
                      job.tags.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-sm bg-white border border-slate-200 text-slate-700 font-mono text-[10px]"
                        >
                          #{t}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">No tags assigned</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Box: Current Workflow State */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Current Workflow State
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Active Workflow Step:</span>
                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-200">
                    {(job as any).currentStep || job.status}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Sub-Status Description:</span>
                  <span className="text-slate-700 font-medium">
                    {job.subStatus || 'Executing normal pipeline step'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">GoLogin Session:</span>
                  {session ? (
                    <span className="font-mono text-emerald-700 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {session.sessionId}
                    </span>
                  ) : (
                    <span className="text-slate-400">None Active</span>
                  )}
                </div>

                {job.lastErrorMessage && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                    <div className="font-bold flex items-center gap-1 mb-0.5">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      Last Error ({job.lastErrorCode || 'GENERIC_ERROR'})
                    </div>
                    <div className="font-mono text-[10px] break-all">{job.lastErrorMessage}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. WORKFLOW TIMELINE (Section 14) - Clean vertical timeline */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <History className="w-3.5 h-3.5 text-slate-500" />
              Workflow Pipeline Timeline
            </h3>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {timelineStages.map((stage, idx) => {
                const isPassed = true; // Based on stage sequence
                const isCurrent = job.status === stage.status;

                return (
                  <div key={stage.status} className="relative flex items-start gap-3 text-xs">
                    {/* Circle Node */}
                    <div
                      className={`absolute -left-6 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isCurrent
                          ? 'bg-blue-600 border-white ring-2 ring-blue-500'
                          : 'bg-white border-slate-300'
                      }`}
                    >
                      {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold ${
                            isCurrent ? 'text-blue-700 font-bold' : 'text-slate-800'
                          }`}
                        >
                          {stage.title}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 rounded-sm bg-blue-100 text-blue-800 font-mono text-[10px] font-bold">
                            CURRENT
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{stage.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3.5. WORKFLOW LIFECYCLE RUNS & STEP EXECUTIONS */}
          {workflowRuns.length > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Workflow Runs & Step Executions
                  </h3>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-mono">
                    {workflowRuns.length} {workflowRuns.length === 1 ? 'Run' : 'Runs'}
                  </span>
                </div>

                {workflowRuns.length > 1 && (
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                    {workflowRuns.map((r) => (
                      <button
                        key={r.workflowRunId}
                        onClick={() => setSelectedRunId(r.workflowRunId)}
                        className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                          (activeRun?.workflowRunId === r.workflowRunId)
                            ? 'bg-white text-slate-900 shadow-xs font-semibold'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Run #{r.runNumber}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {activeRun && (
                <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-500 text-[11px]">{activeRun.workflowRunId}</span>
                    <Badge
                      variant={
                        activeRun.status === 'COMPLETED'
                          ? 'success'
                          : activeRun.status === 'AWAITING_HUMAN'
                          ? 'warning'
                          : activeRun.status === 'FAILED'
                          ? 'danger'
                          : 'neutral'
                      }
                      size="xs"
                    >
                      {activeRun.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Started {new Date(activeRun.startedAt).toLocaleTimeString()}
                    {activeRun.completedAt && ` • Completed ${new Date(activeRun.completedAt).toLocaleTimeString()}`}
                  </div>
                </div>
              )}

              {currentRunStepRuns.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No individual step executions recorded for this run yet.</p>
              ) : (
                <div className="space-y-2">
                  {currentRunStepRuns.map((step) => {
                    const isHuman = step.stepType === 'HUMAN_CHECKPOINT';
                    const isCompleted = step.status === 'COMPLETED';
                    const isAwaiting = step.status === 'AWAITING_HUMAN';
                    const isFailed = step.status === 'FAILED';

                    return (
                      <div
                        key={step.stepRunId}
                        className={`p-3 rounded-lg border transition-all text-xs ${
                          isAwaiting
                            ? 'bg-amber-50/40 border-amber-200'
                            : isFailed
                            ? 'bg-rose-50/40 border-rose-200'
                            : isCompleted
                            ? 'bg-white border-slate-200/80 hover:border-slate-300'
                            : 'bg-slate-50/40 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-md bg-slate-100 text-slate-600">
                              {isHuman ? <UserCheck className="w-3.5 h-3.5 text-amber-600" /> : <Cpu className="w-3.5 h-3.5 text-slate-600" />}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">{step.stepName}</span>
                                <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 text-[10px] font-mono">
                                  {step.phase}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-mono ${
                                  isHuman ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'
                                }`}>
                                  {step.stepType}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                <span>Actor: <strong className="text-slate-700 font-mono">{step.actor}</strong></span>
                                <span>&bull;</span>
                                <span>Started: {new Date(step.startedAt).toLocaleTimeString()}</span>
                                {step.completedAt && (
                                  <>
                                    <span>&bull;</span>
                                    <span>Finished: {new Date(step.completedAt).toLocaleTimeString()}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                isCompleted
                                  ? 'success'
                                  : isAwaiting
                                  ? 'warning'
                                  : isFailed
                                  ? 'danger'
                                  : 'neutral'
                              }
                              size="xs"
                            >
                              {step.status}
                            </Badge>
                          </div>
                        </div>

                        {step.errorMessage && (
                          <div className="mt-2 p-2 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                            <span className="font-bold">Error ({step.errorCode || 'STEP_ERROR'}): </span>
                            {step.errorMessage}
                          </div>
                        )}

                        {step.outputPayload && Object.keys(step.outputPayload).length > 0 && (
                          <div className="mt-2 p-2 rounded-md bg-slate-50 border border-slate-100 text-[11px] text-slate-600 font-mono">
                            <span className="font-semibold text-slate-700 block font-sans mb-0.5">Execution Output / Resolution:</span>
                            {JSON.stringify(step.outputPayload, null, 2)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. HUMAN CHECKPOINTS SECTION */}
          {humanTasks.length > 0 && (
            <div className="bg-amber-50/30 border border-amber-200 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Human Checkpoints for this Job ({humanTasks.length})
              </h3>

              <div className="space-y-2">
                {humanTasks.map((t) => (
                  <div
                    key={t.humanTaskId}
                    className="p-3 rounded-lg bg-white border border-amber-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {(t.taskType || (t as any).type || 'MANUAL_TASK').replace(/_/g, ' ')}
                        </span>
                        <Badge
                          variant={t.status === 'COMPLETED' ? 'success' : 'warning'}
                          size="xs"
                        >
                          {t.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Created at {new Date(t.createdAt).toLocaleTimeString()}
                      </p>
                    </div>

                    <Button
                      variant="primary"
                      size="xs"
                      onClick={() => onOpenHumanTask(t)}
                    >
                      {t.status === 'COMPLETED' ? 'View Details' : 'Resolve Task'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. APPLICATION ATTEMPTS HISTORY */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Application Submission Attempts ({attempts.length})
            </h3>

            {attempts.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No formal submission attempts recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="text-[11px] font-semibold text-slate-500 bg-slate-50">
                    <tr>
                      <th className="py-1.5 px-3">Attempt #</th>
                      <th className="py-1.5 px-3">Timestamp</th>
                      <th className="py-1.5 px-3">Status</th>
                      <th className="py-1.5 px-3">Error Code</th>
                      <th className="py-1.5 px-3">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {attempts.map((att) => (
                      <tr key={att.attemptId}>
                        <td className="py-2 px-3 font-semibold text-slate-700">#{att.attemptNo || (att as any).attemptNumber || 1}</td>
                        <td className="py-2 px-3 text-slate-500">{new Date(att.submittedAt || (att as any).startedAt || Date.now()).toLocaleTimeString()}</td>
                        <td className="py-2 px-3">
                          <Badge variant={att.finalStatus === 'APPROVED' ? 'success' : att.finalStatus === 'REJECTED' ? 'danger' : 'neutral'} size="xs">
                            {att.finalStatus}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{att.rejectionReason ? 'REJECTED' : '-'}</td>
                        <td className="py-2 px-3 text-slate-500 font-sans">{att.rejectionReason || 'Attempt finished'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 6. IMMUTABLE AUDIT LOGS FOR THIS JOB */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              Audit Trail for Job {job.jobId}
            </h3>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No audit records found for this job.</p>
            ) : (
              <div className="space-y-1.5 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <div
                    key={log.auditId}
                    className="p-2 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-between text-slate-700"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <strong className="text-blue-700">{log.action}</strong>
                      <span className="text-slate-500">by {log.actor}</span>
                    </div>
                    <span className="text-slate-500 text-[10px]">{log.reason || '-'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
