import React from 'react';
import {
  Monitor,
  ExternalLink,
  Pause,
  Play,
  RotateCcw,
  Square,
  User,
  Clock,
  Globe,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import { Session, Operator } from '../types';
import { StatusBadge } from './StatusBadge';

interface DynamicSessionCardProps {
  session: Session;
  operators: Operator[];
  onOpenSession: (session: Session) => void;
  onPauseJob?: (jobId: string) => void;
  onResumeJob?: (jobId: string) => void;
  onRetryJob?: (jobId: string) => void;
  onManualReviewJob?: (jobId: string) => void;
  onStopSession: (sessionId: string) => void;
  onSelectJob?: (jobId: string) => void;
}

export const DynamicSessionCard: React.FC<DynamicSessionCardProps> = ({
  session,
  operators,
  onOpenSession,
  onPauseJob,
  onResumeJob,
  onRetryJob,
  onManualReviewJob,
  onStopSession,
  onSelectJob,
}) => {
  const operator = operators.find((o) => o.operatorId === session.operatorId);
  const isRunning = session.status === 'RUNNING';
  const isPaused = session.status === 'PAUSED';
  const isStopped = session.status === 'STOPPED';

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div
      id={`session-card-${session.sessionId}`}
      className="bg-white rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
    >
      <div>
        {/* Top bar: Session ID and Status */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isRunning ? 'bg-emerald-500 animate-pulse' : isPaused ? 'bg-amber-400' : 'bg-slate-300'
              }`}
            />
            <span className="font-mono text-xs font-semibold text-slate-900">{session.sessionId}</span>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded font-medium ${
              isRunning
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : isPaused
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {session.status}
          </span>
        </div>

        {/* Shop Name & Job link */}
        <div className="mt-3">
          <button
            onClick={() => onSelectJob && onSelectJob(session.jobId)}
            className="text-left group"
          >
            <h4 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
              {session.shopName || session.jobId}
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" />
            </h4>
            <p className="text-xs font-mono text-slate-500">{session.jobId}</p>
          </button>
        </div>

        {/* GoLogin Profile & Current Workflow State */}
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1 text-slate-500">
              <Monitor className="w-3.5 h-3.5 text-slate-400" /> Profile:
            </span>
            <span className="font-mono text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
              {session.gologinProfileId}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1 text-slate-500">
              <Radio className="w-3.5 h-3.5 text-slate-400" /> Workflow State:
            </span>
            <StatusBadge status={session.currentWorkflowState} size="sm" />
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1 text-slate-500">
              <User className="w-3.5 h-3.5 text-slate-400" /> Operator:
            </span>
            <span className="text-slate-800 font-medium">{operator ? operator.name.split(' ')[0] : 'Unassigned'}</span>
          </div>

          {session.currentUrl && (
            <div className="pt-1 flex items-start gap-1 text-slate-500">
              <Globe className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
              <span className="truncate font-mono text-[11px] text-slate-600 max-w-[240px]">{session.currentUrl}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Details and Actions */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> Started: {formatTime(session.startedAt)}
          </span>
          <span>Heartbeat: {formatTime(session.lastHeartbeat)}</span>
        </div>

        {/* Action Buttons strictly based on current state */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* OPEN SESSION */}
          <button
            id={`btn-open-session-${session.sessionId}`}
            onClick={() => onOpenSession(session)}
            className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Monitor className="w-3.5 h-3.5" />
            Open Session
          </button>

          {/* PAUSE / RESUME */}
          {isRunning && onPauseJob && (
            <button
              id={`btn-pause-${session.sessionId}`}
              onClick={() => onPauseJob(session.jobId)}
              title="Pause Job & Session"
              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs transition-colors"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          )}

          {isPaused && onResumeJob && (
            <button
              id={`btn-resume-${session.sessionId}`}
              onClick={() => onResumeJob(session.jobId)}
              title="Resume Job & Session"
              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}

          {/* RETRY */}
          {onRetryJob && (
            <button
              id={`btn-retry-${session.sessionId}`}
              onClick={() => onRetryJob(session.jobId)}
              title="Trigger Technical Retry"
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* MANUAL REVIEW */}
          {onManualReviewJob && (
            <button
              id={`btn-review-${session.sessionId}`}
              onClick={() => onManualReviewJob(session.jobId)}
              title="Escalate to Manual Review"
              className="p-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-xs transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
            </button>
          )}

          {/* STOP SESSION */}
          {!isStopped && (
            <button
              id={`btn-stop-${session.sessionId}`}
              onClick={() => onStopSession(session.sessionId)}
              title="Stop Cloud Browser"
              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
