import React, { useState } from 'react';
import {
  Search,
  Filter,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Send,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  FileCheck,
  AlertTriangle,
} from 'lucide-react';
import { Job, Operator, JobStatus } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

interface JobsPageProps {
  jobs: Job[];
  operators: Operator[];
  totalJobs: number;
  onRefresh: () => void;
  onSelectJob: (jobId: string) => void;
  onOpenNewJob: () => void;
  onPauseJob: (jobId: string) => void;
  onResumeJob: (jobId: string) => void;
  onRetryJob: (jobId: string) => void;
  onSubmitJob: (jobId: string) => void;
}

export const JobsPage: React.FC<JobsPageProps> = ({
  jobs,
  operators,
  totalJobs,
  onRefresh,
  onSelectJob,
  onOpenNewJob,
  onPauseJob,
  onResumeJob,
  onRetryJob,
  onSubmitJob,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [operatorFilter, setOperatorFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'updatedAt' | 'createdAt' | 'priority' | 'shopName'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    if (statusFilter !== 'ALL' && job.status !== statusFilter) return false;
    if (operatorFilter !== 'ALL' && job.operatorId !== operatorFilter) return false;
    if (priorityFilter !== 'ALL' && job.priority !== priorityFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        job.jobId.toLowerCase().includes(q) ||
        job.shopName.toLowerCase().includes(q) ||
        job.email.toLowerCase().includes(q) ||
        (job.tags && job.tags.some((t) => t.toLowerCase().includes(q)));
      if (!match) return false;
    }
    return true;
  });

  // Sort jobs
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'updatedAt' || sortField === 'createdAt') {
      comparison = new Date(a[sortField]).getTime() - new Date(b[sortField]).getTime();
    } else if (sortField === 'shopName') {
      comparison = a.shopName.localeCompare(b.shopName);
    } else if (sortField === 'priority') {
      const pMap: Record<string, number> = { CRITICAL: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
      comparison = (pMap[a.priority] || 0) - (pMap[b.priority] || 0);
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / ITEMS_PER_PAGE));
  const paginatedJobs = sortedJobs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setOperatorFilter('ALL');
    setPriorityFilter('ALL');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchTerm !== '' || statusFilter !== 'ALL' || operatorFilter !== 'ALL' || priorityFilter !== 'ALL';

  const allStatuses: JobStatus[] = [
    'NEW',
    'QUEUED',
    'PREPARING',
    'PROFILE_CREATED',
    'PROXY_READY',
    'BROWSER_READY',
    'SIGNUP_STARTED',
    'WAITING_FOR_EMAIL_OTP',
    'HUMAN_IDENTITY_VERIFICATION',
    'HUMAN_SELFIE_REQUIRED',
    'READY_FOR_SUBMISSION',
    'SUBMITTED',
    'WAITING_FOR_REVIEW',
    'APPROVED',
    'REJECTED',
    'PAUSED',
    'ERROR',
    'MANUAL_REVIEW',
  ];

  return (
    <div className="space-y-4">
      {/* Header & Controls bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-sky-600 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Job Queue & Management
              </h2>
              <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold">
                {filteredJobs.length} of {totalJobs} Total
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Pipeline controller for automated browser registration and candidate workflows
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            leftIcon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
            title="Refresh jobs"
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onOpenNewJob}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            New Job
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center gap-2.5 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search job ID, shop, email, tags..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-blue-500/10 text-xs"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold text-slate-500">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-xs text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Statuses ({totalJobs})</option>
            {allStatuses.map((st) => (
              <option key={st} value={st}>
                {st.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold text-slate-500">Priority:</label>
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-xs text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {/* Operator Filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold text-slate-500">Operator:</label>
          <select
            value={operatorFilter}
            onChange={(e) => {
              setOperatorFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-xs text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Operators</option>
            {operators.map((op) => (
              <option key={op.operatorId} value={op.operatorId}>
                {op.name}
              </option>
            ))}
          </select>
        </div>

        {/* Reset Filters button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="xs"
            onClick={resetFilters}
            leftIcon={<X className="w-3 h-3 text-slate-500" />}
            className="text-slate-600 hover:text-slate-900"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* JOBS DATA TABLE (Section 12) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {filteredJobs.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No Jobs Found"
            description={
              hasActiveFilters
                ? 'No jobs match your selected filter criteria. Try resetting the filters.'
                : 'No workflow jobs currently exist in the database queue.'
            }
            actionLabel={hasActiveFilters ? 'Clear Filters' : 'Create New Job'}
            onAction={hasActiveFilters ? resetFilters : onOpenNewJob}
            actionIcon={<Plus className="w-3.5 h-3.5" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200 sticky top-0 z-10 select-none">
                <tr>
                  <th className="py-2.5 px-3">Job ID</th>
                  <th
                    className="py-2.5 px-3 cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      if (sortField === 'shopName') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('shopName');
                        setSortOrder('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Shop Name
                      {sortField === 'shopName' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Sub-Status / Step</th>
                  <th className="py-2.5 px-3">Session</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th
                    className="py-2.5 px-3 cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      if (sortField === 'priority') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('priority');
                        setSortOrder('desc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Priority
                      {sortField === 'priority' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 px-3">Attempts</th>
                  <th
                    className="py-2.5 px-3 cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      if (sortField === 'updatedAt') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('updatedAt');
                        setSortOrder('desc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Updated
                      {sortField === 'updatedAt' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {paginatedJobs.map((job) => {
                  const assignedOp = operators.find((o) => o.operatorId === job.operatorId);
                  const isRunning = job.status.startsWith('SIGNUP_') || job.status === 'PREPARING';
                  const isPaused = job.status === 'PAUSED';
                  const isError = job.status === 'ERROR';

                  return (
                    <tr
                      key={job.jobId}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => onSelectJob(job.jobId)}
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        <span className="group-hover:text-blue-600 transition-colors">
                          {job.jobId}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                        <div className="truncate max-w-[150px]">{job.shopName}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                          {job.email}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 font-sans" onClick={(e) => e.stopPropagation()}>
                        <StatusBadge status={job.status} size="sm" />
                      </td>

                      <td className="py-2.5 px-3 font-sans text-slate-600">
                        <span className="text-[11px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-sm truncate max-w-[130px] inline-block">
                          {(job as any).currentStep || job.subStatus || '-'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-slate-500 font-mono truncate max-w-[100px]">
                        {job.currentSessionId || (job as any).sessionId ? (
                          <span className="text-blue-600 font-medium">{job.currentSessionId || (job as any).sessionId}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-sans text-slate-600 whitespace-nowrap">
                        {assignedOp ? assignedOp.name : <span className="text-slate-400 italic">Unassigned</span>}
                      </td>

                      <td className="py-2.5 px-3">
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
                          {job.priority}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-3 text-slate-600 font-sans">
                        <span className={job.retryCount > 0 ? 'text-amber-700 font-bold' : ''}>
                          {job.retryCount}
                        </span>
                        <span className="text-slate-400">/{job.maxRetries}</span>
                      </td>

                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(job.updatedAt).toLocaleTimeString()}
                      </td>

                      <td
                        className="py-2.5 px-3 text-right whitespace-nowrap font-sans space-x-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isPaused ? (
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => onResumeJob(job.jobId)}
                            title="Resume job execution"
                          >
                            <Play className="w-3 h-3 text-emerald-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => onPauseJob(job.jobId)}
                            title="Pause job execution"
                          >
                            <Pause className="w-3 h-3 text-slate-600" />
                          </Button>
                        )}

                        {isError && (
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => onRetryJob(job.jobId)}
                            title="Retry job"
                          >
                            <RotateCcw className="w-3 h-3 text-blue-600" />
                          </Button>
                        )}

                        {job.status === 'READY_FOR_SUBMISSION' && (
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => onSubmitJob(job.jobId)}
                            title="Submit application"
                          >
                            <Send className="w-3 h-3" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => onSelectJob(job.jobId)}
                          rightIcon={<ExternalLink className="w-3 h-3" />}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination footer */}
            <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                {Math.min(currentPage * ITEMS_PER_PAGE, sortedJobs.length)} of {sortedJobs.length} jobs
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="xs"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="font-mono px-2 text-slate-700">
                  {currentPage} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="xs"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
