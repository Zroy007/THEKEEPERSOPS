import React, { useState } from 'react';
import {
  Layers,
  Clock,
  PlayCircle,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  XCircle,
  Monitor,
  ArrowRight,
  ExternalLink,
  Cpu,
  Activity,
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  Sliders,
  Radio,
  Play,
  Pause,
  Square,
  ShieldCheck,
} from 'lucide-react';
import { DashboardMetrics, Session, HumanTask, Job, Operator } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { MetricTile } from '../components/ui/MetricTile';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

interface DashboardPageProps {
  metrics: DashboardMetrics | null;
  sessions: Session[];
  humanTasks: HumanTask[];
  recentJobs: Job[];
  operators: Operator[];
  onOpenSession: (session: Session) => void;
  onOpenHumanTask: (task: HumanTask) => void;
  onSelectJob: (jobId: string) => void;
  onNavigateTab: (tab: string) => void;
  onPauseJob?: (jobId: string) => void;
  onResumeJob?: (jobId: string) => void;
  onRetryJob?: (jobId: string) => void;
  onManualReviewJob?: (jobId: string) => void;
  onStopSession: (sessionId: string) => void;
  onTakeHumanTask?: (taskId: string, operatorId: string) => Promise<void>;
  currentOperatorId?: string;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  metrics,
  sessions,
  humanTasks,
  recentJobs,
  operators,
  onOpenSession,
  onOpenHumanTask,
  onSelectJob,
  onNavigateTab,
  onPauseJob,
  onResumeJob,
  onRetryJob,
  onManualReviewJob,
  onStopSession,
  onTakeHumanTask,
  currentOperatorId = 'OP-001',
}) => {
  // Filters & State
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionFilter, setSessionFilter] = useState<'ALL' | 'RUNNING' | 'PAUSED'>('ALL');
  const [sessionPage, setSessionPage] = useState(1);
  const SESSIONS_PER_PAGE = 5;

  const activeSessions = sessions.filter(
    (s) => s.status === 'RUNNING' || s.status === 'PAUSED' || s.status === 'STARTING'
  );
  const openHumanTasks = humanTasks.filter(
    (t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED'
  );

  // Filtered session list
  const filteredSessions = sessions.filter((s) => {
    if (sessionFilter !== 'ALL' && s.status !== sessionFilter) return false;
    if (sessionSearch) {
      const q = sessionSearch.toLowerCase();
      const match =
        s.sessionId.toLowerCase().includes(q) ||
        (s.shopName && s.shopName.toLowerCase().includes(q)) ||
        s.jobId.toLowerCase().includes(q) ||
        s.gologinProfileId.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const totalSessionPages = Math.max(1, Math.ceil(filteredSessions.length / SESSIONS_PER_PAGE));
  const paginatedSessions = filteredSessions.slice(
    (sessionPage - 1) * SESSIONS_PER_PAGE,
    sessionPage * SESSIONS_PER_PAGE
  );

  return (
    <div className="space-y-5">
      {/* 1. TOP METRIC TILES (Section 8 & 9) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricTile
          label="Total Jobs"
          value={metrics?.totalJobs ?? 0}
          sublabel="All pipeline jobs"
          icon={<Layers className="w-4 h-4" />}
          onClick={() => onNavigateTab('jobs')}
        />

        <MetricTile
          label="Running"
          value={metrics?.running ?? 0}
          sublabel="Active automated steps"
          indicatorVariant="success"
          contextIndicator={metrics?.running && metrics.running > 0 ? 'Active' : undefined}
          icon={<PlayCircle className="w-4 h-4 text-emerald-500" />}
          onClick={() => onNavigateTab('jobs')}
        />

        <MetricTile
          label="Human Action"
          value={metrics?.humanActionRequired ?? 0}
          sublabel="Checkpoints pending"
          indicatorVariant="warning"
          contextIndicator={
            metrics?.humanActionRequired && metrics.humanActionRequired > 0 ? 'Urgent' : undefined
          }
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          className={metrics?.humanActionRequired && metrics.humanActionRequired > 0 ? 'border-amber-300 ring-1 ring-amber-300/40' : ''}
          onClick={() => onNavigateTab('human-tasks')}
        />

        <MetricTile
          label="Waiting Review"
          value={metrics?.waitingForReview ?? 0}
          sublabel="Merchant approval poll"
          icon={<FileCheck className="w-4 h-4 text-indigo-500" />}
          onClick={() => onNavigateTab('jobs')}
        />

        <MetricTile
          label="Errors"
          value={metrics?.errors ?? 0}
          sublabel="Technical or halted"
          indicatorVariant="danger"
          contextIndicator={metrics?.errors && metrics.errors > 0 ? 'Attention' : undefined}
          icon={<XCircle className="w-4 h-4 text-rose-500" />}
          onClick={() => onNavigateTab('jobs')}
        />

        <MetricTile
          label="Approved"
          value={metrics?.approved ?? 0}
          sublabel="Successfully verified"
          indicatorVariant="success"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          onClick={() => onNavigateTab('jobs')}
        />
      </div>

      {/* 2. OPERATIONAL SUMMARY: Workflow Activity (Left) + System Health & Capacity (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Pipeline Throughput & Queue Controller */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Workflow Pipeline Activity
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-mono">
                Queued: <strong className="text-slate-700">{metrics?.queued ?? 0}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-400 font-mono">
                Running: <strong className="text-emerald-700">{metrics?.running ?? 0}</strong>
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onNavigateTab('jobs')}
                rightIcon={<ArrowRight className="w-3 h-3" />}
              >
                View Queue
              </Button>
            </div>
          </div>

          {/* Pipeline flow overview bar */}
          <div className="grid grid-cols-4 gap-2 pt-1 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">1. Queued</div>
              <div className="text-base font-bold font-mono text-slate-800 mt-0.5">
                {metrics?.queued ?? 0}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-100">
              <div className="text-[11px] text-blue-700 font-medium">2. Browser Prep</div>
              <div className="text-base font-bold font-mono text-blue-900 mt-0.5">
                {recentJobs.filter((j) => j.status === 'PREPARING' || j.status === 'PROXY_READY' || j.status === 'BROWSER_READY').length}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200">
              <div className="text-[11px] text-amber-800 font-medium">3. Verification</div>
              <div className="text-base font-bold font-mono text-amber-900 mt-0.5">
                {metrics?.humanActionRequired ?? 0}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
              <div className="text-[11px] text-emerald-700 font-medium">4. Submitted</div>
              <div className="text-base font-bold font-mono text-emerald-900 mt-0.5">
                {metrics?.waitingForReview ?? 0}
              </div>
            </div>
          </div>
        </div>

        {/* Right: System Capacity & Integration Health Summary */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                System Capacity
              </h3>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onNavigateTab('health')}
              rightIcon={<ArrowRight className="w-3 h-3" />}
            >
              Diagnostics
            </Button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-600 font-medium">Active GoLogin Sessions:</span>
              <span className="font-mono font-bold text-slate-900">
                {metrics?.activeSessions ?? 0} / {metrics?.concurrencyLimit ?? '∞'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-600 font-medium">Available Session Slots:</span>
              <span className="font-mono font-bold text-emerald-600">
                {metrics?.availableCapacity ?? 'Unlimited'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-600 font-medium">Daily Job Quota:</span>
              <span className="font-mono text-slate-700">
                {metrics?.dailyJobLimit ?? 'Unrestricted'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. HUMAN ACTION QUEUE (Section 11) - High visibility amber accent */}
      <div className="bg-white rounded-xl border border-amber-300 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="p-1 rounded-md bg-amber-500 text-white shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Human Action Required
                </h3>
                <span className="px-1.5 py-0.2 rounded-sm bg-amber-200 text-amber-900 font-mono text-[10px] font-bold">
                  {openHumanTasks.length} Pending
                </span>
              </div>
              <p className="text-[11px] text-amber-800">
                Immediate operator intervention required for OTP tokens, identity documents, and biometrics.
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="xs"
            onClick={() => onNavigateTab('human-tasks')}
            rightIcon={<ArrowRight className="w-3 h-3" />}
            className="border-amber-300 text-amber-900 hover:bg-amber-100"
          >
            All Checkpoints
          </Button>
        </div>

        {openHumanTasks.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-amber-50/20">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
            <span className="font-semibold text-slate-700">All Human Checkpoints Cleared</span>
            <p className="text-slate-400 text-[11px] mt-0.5">
              No tasks currently waiting for manual OTP or verification intervention.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-amber-100 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-50/50 text-[11px] font-semibold text-amber-900/80">
                <tr>
                  <th className="py-2.5 px-4">Priority</th>
                  <th className="py-2.5 px-4">Shop Name</th>
                  <th className="py-2.5 px-4">Checkpoint Type</th>
                  <th className="py-2.5 px-4">Job ID</th>
                  <th className="py-2.5 px-4">Assigned Operator</th>
                  <th className="py-2.5 px-4">Elapsed Time</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/60 font-sans">
                {openHumanTasks.slice(0, 5).map((task) => {
                  const assignedOp = operators.find((o) => o.operatorId === task.assignedOperatorId);
                  const isAssignedToMe = task.assignedOperatorId === currentOperatorId;

                  return (
                    <tr
                      key={task.humanTaskId}
                      className="hover:bg-amber-50/40 transition-colors"
                    >
                      <td className="py-2.5 px-4">
                        <Badge
                          variant={task.priority === 'CRITICAL' ? 'danger' : 'warning'}
                          size="xs"
                          dot
                        >
                          {task.priority}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {(task as any).shopName || task.title || task.jobId}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-mono text-[11px] text-amber-900 font-semibold bg-amber-100/80 px-2 py-0.5 rounded-sm">
                          {(task.taskType || (task as any).type || 'CHECKPOINT').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                        <button
                          onClick={() => onSelectJob(task.jobId)}
                          className="hover:underline hover:text-blue-600"
                        >
                          {task.jobId}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-medium">
                        {assignedOp ? assignedOp.name : <span className="text-slate-400 italic">Unassigned</span>}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(task.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => onOpenHumanTask(task)}
                        >
                          Take Task
                        </Button>
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => onSelectJob(task.jobId)}
                        >
                          Open Job
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. ACTIVE SESSIONS TABLE (Section 10) - Dynamic table with search & actions */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-sky-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Active Browser Sessions
            </h3>
            <span className="px-1.5 py-0.2 rounded-sm bg-blue-50 text-blue-700 font-mono text-[10px] font-bold">
              {activeSessions.length} Running
            </span>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter sessions..."
                value={sessionSearch}
                onChange={(e) => {
                  setSessionSearch(e.target.value);
                  setSessionPage(1);
                }}
                className="pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-slate-300 w-36 sm:w-48"
              />
            </div>

            <select
              value={sessionFilter}
              onChange={(e) => {
                setSessionFilter(e.target.value as any);
                setSessionPage(1);
              }}
              className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-none"
            >
              <option value="ALL">All States</option>
              <option value="RUNNING">Running</option>
              <option value="PAUSED">Paused</option>
            </select>

            <Button
              variant="secondary"
              size="xs"
              onClick={() => onNavigateTab('sessions')}
              rightIcon={<ArrowRight className="w-3 h-3" />}
            >
              Console
            </Button>
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <EmptyState
            icon={Monitor}
            title="No Active Sessions"
            description="No browser sessions are currently running matching your filters."
            actionLabel="View Jobs Queue"
            onAction={() => onNavigateTab('jobs')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Shop Name</th>
                  <th className="py-2 px-3">Job ID</th>
                  <th className="py-2 px-3">Session ID</th>
                  <th className="py-2 px-3">GoLogin Profile</th>
                  <th className="py-2 px-3">Current State</th>
                  <th className="py-2 px-3">Operator</th>
                  <th className="py-2 px-3">Last Heartbeat</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {paginatedSessions.map((session) => {
                  const assignedOp = operators.find((o) => o.operatorId === session.operatorId);
                  const isRunning = session.status === 'RUNNING';
                  const isPaused = session.status === 'PAUSED';

                  return (
                    <tr
                      key={session.sessionId}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-2 px-3">
                        <Badge
                          variant={isRunning ? 'success' : isPaused ? 'neutral' : 'info'}
                          size="xs"
                          dot
                        >
                          {session.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                        {session.shopName || 'Store Registration'}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        <button
                          onClick={() => onSelectJob(session.jobId)}
                          className="hover:underline hover:text-blue-600 font-semibold"
                        >
                          {session.jobId}
                        </button>
                      </td>
                      <td className="py-2 px-3 text-slate-500 truncate max-w-[120px]">
                        {session.sessionId}
                      </td>
                      <td className="py-2 px-3 text-slate-500 truncate max-w-[120px]">
                        {session.gologinProfileId}
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <StatusBadge status={session.currentWorkflowState} size="sm" />
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600">
                        {assignedOp ? assignedOp.name : 'Automated'}
                      </td>
                      <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(session.lastHeartbeat).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap space-x-1 font-sans">
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => onOpenSession(session)}
                        >
                          Open View
                        </Button>
                        {isRunning && onPauseJob && (
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => onPauseJob(session.jobId)}
                            title="Pause session automation"
                          >
                            <Pause className="w-3 h-3 text-amber-600" />
                          </Button>
                        )}
                        {isPaused && onResumeJob && (
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => onResumeJob(session.jobId)}
                            title="Resume session automation"
                          >
                            <Play className="w-3 h-3 text-emerald-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => onStopSession(session.sessionId)}
                          title="Halt browser process"
                          className="text-rose-600 hover:bg-rose-50"
                        >
                          <Square className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalSessionPages > 1 && (
              <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing {(sessionPage - 1) * SESSIONS_PER_PAGE + 1} to{' '}
                  {Math.min(sessionPage * SESSIONS_PER_PAGE, filteredSessions.length)} of{' '}
                  {filteredSessions.length} sessions
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary"
                    size="xs"
                    disabled={sessionPage === 1}
                    onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="font-mono px-2">
                    {sessionPage} / {totalSessionPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="xs"
                    disabled={sessionPage === totalSessionPages}
                    onClick={() => setSessionPage((p) => Math.min(totalSessionPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. RECENT WORKFLOW ACTIVITY (Section 8 bottom) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Job Activity
            </h3>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onNavigateTab('jobs')}
            rightIcon={<ArrowRight className="w-3 h-3" />}
          >
            All Jobs
          </Button>
        </div>

        <div className="divide-y divide-slate-100 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600">
              <tr>
                <th className="py-2 px-3">Job ID</th>
                <th className="py-2 px-3">Shop Name</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Run Mode</th>
                <th className="py-2 px-3">Priority</th>
                <th className="py-2 px-3">Attempts</th>
                <th className="py-2 px-3">Updated</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {recentJobs.slice(0, 6).map((job) => (
                <tr
                  key={job.jobId}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  <td className="py-2 px-3 font-semibold text-slate-900">
                    <button
                      onClick={() => onSelectJob(job.jobId)}
                      className="hover:underline hover:text-blue-600"
                    >
                      {job.jobId}
                    </button>
                  </td>
                  <td className="py-2 px-3 font-sans font-semibold text-slate-800">
                    {job.shopName}
                  </td>
                  <td className="py-2 px-3 font-sans">
                    <StatusBadge status={job.status} size="sm" />
                  </td>
                  <td className="py-2 px-3 font-sans text-slate-600">
                    <span className="px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-700 text-[10px] font-semibold">
                      {job.runMode}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <Badge
                      variant={job.priority === 'CRITICAL' ? 'danger' : job.priority === 'HIGH' ? 'warning' : 'neutral'}
                      size="xs"
                    >
                      {job.priority}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 text-slate-600 font-sans">
                    {job.retryCount} / {job.maxRetries}
                  </td>
                  <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                    {new Date(job.updatedAt).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-3 text-right font-sans">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onSelectJob(job.jobId)}
                      rightIcon={<ExternalLink className="w-3 h-3" />}
                    >
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
