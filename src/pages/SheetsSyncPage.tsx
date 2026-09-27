import React, { useState } from 'react';
import { Table, RefreshCw, Download, CheckCircle2, AlertTriangle, ExternalLink, ArrowUpDown } from 'lucide-react';
import { SheetSyncLog, Job } from '../types';

interface SheetsSyncPageProps {
  logs: SheetSyncLog[];
  jobs: Job[];
  onSync: () => Promise<void>;
  isSyncing: boolean;
}

export const SheetsSyncPage: React.FC<SheetsSyncPageProps> = ({
  logs,
  jobs,
  onSync,
  isSyncing,
}) => {
  const [copied, setCopied] = useState(false);

  const handleExportCsv = () => {
    const headers = [
      'jobId',
      'shopName',
      'email',
      'status',
      'subStatus',
      'priority',
      'currentAttemptNo',
      'operatorId',
      'createdAt',
      'updatedAt',
    ];
    const rows = jobs.map((j) => [
      j.jobId,
      `"${j.shopName.replace(/"/g, '""')}"`,
      j.email,
      j.status,
      j.subStatus,
      j.priority,
      j.currentAttemptNo,
      j.operatorId || '',
      j.createdAt,
      j.updatedAt,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `workflow_jobs_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Table className="w-5 h-5 text-emerald-600" />
            Google Sheets Bi-Directional Synchronization
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Synchronizes intake records from external spreadsheets and pushes real-time workflow statuses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-medium transition-colors"
          >
            <Download className="w-4 h-4 text-slate-600" /> Export CSV
          </button>

          <button
            onClick={onSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Synchronizing...' : 'Trigger Bi-Directional Sync'}
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-medium">Synced Spreadsheet Reference</span>
          <div className="font-mono text-xs font-bold text-slate-900 truncate">
            1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
          </div>
          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium inline-block">
            Connected via Service Account
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-medium">Last Sync Result</span>
          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> All columns mapped & synced
          </div>
          <span className="text-[10px] text-slate-400">Pull & Push operations active</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-medium">Mapped Sheet Tabs</span>
          <div className="text-xs font-bold text-slate-900">Job_Queue & Application_History</div>
          <span className="text-[10px] text-slate-400">12 metadata fields synchronized</span>
        </div>
      </div>

      {/* Sync Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Recent Synchronization Audit Logs</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Sync ID</th>
                <th className="p-3">Sheet</th>
                <th className="p-3">Direction</th>
                <th className="p-3">Processed</th>
                <th className="p-3">Inserted</th>
                <th className="p-3">Updated</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {logs.map((log) => (
                <tr key={log.syncId}>
                  <td className="p-3 text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td className="p-3 font-bold text-slate-700">{log.syncId}</td>
                  <td className="p-3 font-sans text-slate-800">{log.sheetName}</td>
                  <td className="p-3 font-sans">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                      {log.direction}
                    </span>
                  </td>
                  <td className="p-3">{log.rowsProcessed}</td>
                  <td className="p-3 text-emerald-600">+{log.rowsInserted}</td>
                  <td className="p-3 text-blue-600">{log.rowsUpdated}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.status === 'SUCCESS' ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {log.status}
                    </span>
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
