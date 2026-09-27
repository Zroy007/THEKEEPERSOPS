import React, { useState } from 'react';
import {
  Monitor,
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
  Cpu,
  CheckCircle,
  Play,
  Pause,
  Square,
  AlertTriangle,
  LayoutGrid,
  List,
} from 'lucide-react';
import { Session, Operator } from '../types';
import { DynamicSessionCard } from '../components/DynamicSessionCard';
import { StatusBadge } from '../components/StatusBadge';
import { MetricTile } from '../components/ui/MetricTile';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

interface SessionsPageProps {
  sessions: Session[];
  operators: Operator[];
  concurrencyLimit: number | string;
  onRefresh: () => void;
  onOpenSession: (session: Session) => void;
  onPauseJob?: (jobId: string) => void;
  onResumeJob?: (jobId: string) => void;
  onRetryJob?: (jobId: string) => void;
  onManualReviewJob?: (jobId: string) => void;
  onStopSession: (sessionId: string) => void;
  onSelectJob?: (jobId: string) => void;
}

export const SessionsPage: React.FC<SessionsPageProps> = ({
  sessions,
  operators,
  concurrencyLimit,
  onRefresh,
  onOpenSession,
  onPauseJob,
  onResumeJob,
  onRetryJob,
  onManualReviewJob,
  onStopSession,
  onSelectJob,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const runningCount = sessions.filter((s) => s.status === 'RUNNING').length;
  const pausedCount = sessions.filter((s) => s.status === 'PAUSED').length;
  const stoppedCount = sessions.filter((s) => s.status === 'STOPPED').length;
  const activeCount = runningCount + pausedCount;

  const limitNum = typeof concurrencyLimit === 'number' ? concurrencyLimit : parseInt(concurrencyLimit as string) || 6;
  const availableCapacity = Math.max(0, limitNum - activeCount);

  // Filter sessions
  const filteredSessions = sessions.filter((s) => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        s.sessionId.toLowerCase().includes(q) ||
        (s.shopName && s.shopName.toLowerCase().includes(q)) ||
        s.jobId.toLowerCase().includes(q) ||
        s.gologinProfileId.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / ITEMS_PER_PAGE));
  const paginatedSessions = filteredSessions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-4">
      {/* Top Operational Metrics (Section 15) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricTile
          label="Active Sessions"
          value={activeCount}
          sublabel="Running or paused in GoLogin"
          icon={<Monitor className="w-4 h-4 text-sky-500" />}
          indicatorVariant={activeCount > 0 ? 'info' : 'neutral'}
        />

        <MetricTile
          label="Available Capacity"
          value={availableCapacity}
          sublabel={`Limit: ${concurrencyLimit} concurrent`}
          icon={<Cpu className="w-4 h-4 text-emerald-500" />}
          indicatorVariant={availableCapacity > 0 ? 'success' : 'warning'}
        />

        <MetricTile
          label="Paused Sessions"
          value={pausedCount}
          sublabel="Awaiting manual resume"
          icon={<Pause className="w-4 h-4 text-amber-500" />}
          indicatorVariant={pausedCount > 0 ? 'warning' : 'neutral'}
        />

        <MetricTile
          label="Stopped / Inactive"
          value={stoppedCount}
          sublabel="Completed or closed profiles"
          icon={<Square className="w-4 h-4 text-slate-400" />}
        />
      </div>

      {/* Console Controls bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Monitor className="w-4 h-4 text-sky-600" />
              GoLogin Cloud Browser Session Registry
            </h2>
            <span className="px-2 py-0.5 rounded-sm bg-blue-50 text-blue-800 font-mono text-[11px] font-bold border border-blue-200">
              {activeCount} Active / Limit {concurrencyLimit}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Dynamic pool of antidetect browser profiles with live debugging ports and health monitoring
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                viewMode === 'table' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                viewMode === 'grid' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            leftIcon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center gap-2.5 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search session ID, profile, shop..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:bg-white focus:border-slate-300 text-xs"
          />
        </div>

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
            <option value="ALL">All Session States ({sessions.length})</option>
            <option value="RUNNING">Running ({runningCount})</option>
            <option value="PAUSED">Paused ({pausedCount})</option>
            <option value="STOPPED">Stopped ({stoppedCount})</option>
          </select>
        </div>
      </div>

      {/* SESSIONS DISPLAY: Table (Default) or Grid */}
      {filteredSessions.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="No Sessions Active"
          description={
            searchTerm || statusFilter !== 'ALL'
              ? 'No sessions match your search or filter criteria.'
              : 'Browser sessions are dynamically allocated when workflow jobs advance to browser preparation.'
          }
        />
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Shop Name</th>
                  <th className="py-2.5 px-3">Job ID</th>
                  <th className="py-2.5 px-3">Session ID</th>
                  <th className="py-2.5 px-3">GoLogin Profile</th>
                  <th className="py-2.5 px-3">Current State</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Last Heartbeat</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
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
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      onClick={() => onOpenSession(session)}
                    >
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={isRunning ? 'success' : isPaused ? 'neutral' : 'danger'}
                          size="xs"
                          dot
                        >
                          {session.status}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                        {session.shopName || 'Registration'}
                      </td>

                      <td className="py-2.5 px-3 text-slate-600">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectJob) onSelectJob(session.jobId);
                          }}
                          className="hover:underline hover:text-blue-600 font-semibold"
                        >
                          {session.jobId}
                        </button>
                      </td>

                      <td className="py-2.5 px-3 text-slate-500 truncate max-w-[130px]">
                        {session.sessionId}
                      </td>

                      <td className="py-2.5 px-3 text-slate-500 truncate max-w-[130px]">
                        {session.gologinProfileId}
                      </td>

                      <td className="py-2.5 px-3 font-sans">
                        <StatusBadge status={session.currentWorkflowState} size="sm" />
                      </td>

                      <td className="py-2.5 px-3 font-sans text-slate-600">
                        {assignedOp ? assignedOp.name : 'System Automated'}
                      </td>

                      <td className="py-2.5 px-3 text-slate-500 font-sans">
                        {(session as any).durationSeconds ? `${Math.floor((session as any).durationSeconds / 60)}m ${(session as any).durationSeconds % 60}s` : '3m 14s'}
                      </td>

                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(session.lastHeartbeat).toLocaleTimeString()}
                      </td>

                      <td
                        className="py-2.5 px-3 text-right whitespace-nowrap space-x-1 font-sans"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => onOpenSession(session)}
                        >
                          Console View
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
                          title="Halt browser profile"
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
            {totalPages > 1 && (
              <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredSessions.length)} of{' '}
                  {filteredSessions.length} sessions
                </span>
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
            )}
          </div>
        </div>
      ) : (
        /* Grid Mode (using DynamicSessionCard with responsive layout) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedSessions.map((session) => (
            <DynamicSessionCard
              key={session.sessionId}
              session={session}
              operators={operators}
              onOpenSession={onOpenSession}
              onPauseJob={onPauseJob}
              onResumeJob={onResumeJob}
              onRetryJob={onRetryJob}
              onManualReviewJob={onManualReviewJob}
              onStopSession={onStopSession}
              onSelectJob={onSelectJob}
            />
          ))}
        </div>
      )}
    </div>
  );
};
