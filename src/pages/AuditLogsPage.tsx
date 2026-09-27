import React, { useState } from 'react';
import {
  FileText,
  Search,
  ShieldCheck,
  Download,
  Filter,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Sliders,
  Play,
  RotateCcw,
} from 'lucide-react';
import { AuditLog } from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

interface AuditLogsPageProps {
  logs: AuditLog[];
}

type QuickFilter = 'ALL' | 'SECURITY' | 'SETTINGS' | 'OVERRIDES' | 'FAILURES';

export const AuditLogsPage: React.FC<AuditLogsPageProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = logs.filter((log) => {
    if (quickFilter === 'SECURITY') {
      const isSec =
        log.action.includes('LOGIN') ||
        log.action.includes('ROLE') ||
        log.action.includes('PERMISSION') ||
        log.action.includes('PASSWORD');
      if (!isSec) return false;
    } else if (quickFilter === 'SETTINGS') {
      const isSettings =
        log.action.includes('SETTING') ||
        log.action.includes('CONFIG') ||
        log.action.includes('SECRET');
      if (!isSettings) return false;
    } else if (quickFilter === 'OVERRIDES') {
      const isOverride =
        log.action.includes('PAUSE') ||
        log.action.includes('RESUME') ||
        log.action.includes('RETRY') ||
        log.action.includes('OVERRIDE') ||
        log.actorRole === 'OPERATOR';
      if (!isOverride) return false;
    } else if (quickFilter === 'FAILURES') {
      if (log.result !== 'FAILURE' && log.result !== 'BLOCKED') return false;
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        log.actor.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        (log.jobId && log.jobId.toLowerCase().includes(q)) ||
        (log.auditId && log.auditId.toLowerCase().includes(q)) ||
        (log.reason && log.reason.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const exportLogs = () => {
    const jsonStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls (Section 24) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-900 text-white">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Append-Only Immutable Audit Log Trail
                </h2>
                <Badge variant="neutral" size="xs">
                  {logs.length} Recorded
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Cryptographically sequenced timeline of administrative overrides, workflow state mutations, and operator actions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search actor, action, job ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:bg-white text-xs w-48"
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={exportLogs}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export Logs
          </Button>
        </div>
      </div>

      {/* Quick Filter Chips (Section 24) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
          Quick Filters:
        </span>
        <button
          onClick={() => setQuickFilter('ALL')}
          className={`px-3 py-1 rounded-lg font-medium transition-colors ${
            quickFilter === 'ALL'
              ? 'bg-slate-900 text-white font-semibold'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All Logs
        </button>
        <button
          onClick={() => setQuickFilter('SECURITY')}
          className={`px-3 py-1 rounded-lg font-medium transition-colors ${
            quickFilter === 'SECURITY'
              ? 'bg-slate-900 text-white font-semibold'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Security & Access
        </button>
        <button
          onClick={() => setQuickFilter('SETTINGS')}
          className={`px-3 py-1 rounded-lg font-medium transition-colors ${
            quickFilter === 'SETTINGS'
              ? 'bg-slate-900 text-white font-semibold'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Settings Changes
        </button>
        <button
          onClick={() => setQuickFilter('OVERRIDES')}
          className={`px-3 py-1 rounded-lg font-medium transition-colors ${
            quickFilter === 'OVERRIDES'
              ? 'bg-slate-900 text-white font-semibold'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Manual Overrides
        </button>
        <button
          onClick={() => setQuickFilter('FAILURES')}
          className={`px-3 py-1 rounded-lg font-medium transition-colors ${
            quickFilter === 'FAILURES'
              ? 'bg-rose-600 text-white font-semibold'
              : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50'
          }`}
        >
          Failures & Blocked
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No Matching Audit Records"
            description="No entries matched the selected quick filter or search query."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-8"></th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target / Job ID</th>
                  <th className="py-2.5 px-3">Result</th>
                  <th className="py-2.5 px-3">State Transition</th>
                  <th className="py-2.5 px-3">Reason / Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-xs">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.auditId;
                  const isFail = log.result === 'FAILURE' || log.result === 'BLOCKED';

                  return (
                    <React.Fragment key={log.auditId}>
                      <tr
                        className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                          isFail ? 'bg-rose-50/15' : ''
                        }`}
                        onClick={() => toggleExpand(log.auditId)}
                      >
                        <td className="py-2.5 px-3 text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900">{log.actor}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {log.actorRole}
                          </span>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            {log.action}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {log.jobId || log.sessionId || '-'}
                        </td>

                        <td className="py-2.5 px-3">
                          <Badge
                            variant={
                              log.result === 'SUCCESS'
                                ? 'success'
                                : log.result === 'FAILURE'
                                ? 'danger'
                                : 'warning'
                            }
                            size="xs"
                          >
                            {log.result}
                          </Badge>
                        </td>

                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-600">
                          {log.previousState && log.newState ? (
                            <span>
                              {log.previousState} &rarr; {log.newState}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-xs truncate">
                          {log.reason || '-'}
                        </td>
                      </tr>

                      {/* Expandable JSON details row */}
                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={8} className="p-4 border-t border-slate-200">
                            <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px] space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 pb-1 border-b border-slate-100">
                                <span>Audit ID: {log.auditId}</span>
                                <span>IP / Source: 127.0.0.1 (Internal Agent Orchestrator)</span>
                              </div>
                              <pre className="text-slate-600 text-[10px] overflow-x-auto">
                                {JSON.stringify(log, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
