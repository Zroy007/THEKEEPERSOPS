import React from 'react';
import { BarChart3, TrendingUp, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';
import { DashboardMetrics, Job } from '../types';

interface ReportsPageProps {
  metrics: DashboardMetrics | null;
  jobs: Job[];
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ metrics, jobs }) => {
  const approvedCount = metrics?.approved ?? 0;
  const rejectedCount = metrics?.rejected ?? 0;
  const totalCompleted = approvedCount + rejectedCount;
  const approvalRate = totalCompleted > 0 ? Math.round((approvedCount / totalCompleted) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          Workflow Performance & Throughput Analytics
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          End-to-end pipeline metrics, approval ratios, and automation efficiency.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Approval Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{approvalRate}%</div>
          <div className="text-xs text-slate-500">{approvedCount} approved out of {totalCompleted} completed</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Avg Human Resolution Time</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-slate-900">4.2 min</div>
          <div className="text-xs text-slate-500">Average response to Telegram reminders</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Automation Success Rate</span>
            <Zap className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-slate-900">92.4%</div>
          <div className="text-xs text-slate-500">Technical retry recovery: 88%</div>
        </div>
      </div>

      {/* Breakdown chart bars */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Job Status Distribution</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
              <span>Approved ({approvedCount})</span>
              <span>{Math.round((approvedCount / (jobs.length || 1)) * 100)}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${(approvedCount / (jobs.length || 1)) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
              <span>In Pipeline / Running ({metrics?.running ?? 0})</span>
              <span>{Math.round(((metrics?.running ?? 0) / (jobs.length || 1)) * 100)}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${((metrics?.running ?? 0) / (jobs.length || 1)) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
              <span>Human Checkpoints Pending ({metrics?.humanActionRequired ?? 0})</span>
              <span>{Math.round(((metrics?.humanActionRequired ?? 0) / (jobs.length || 1)) * 100)}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${((metrics?.humanActionRequired ?? 0) / (jobs.length || 1)) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
              <span>Rejected ({rejectedCount})</span>
              <span>{Math.round((rejectedCount / (jobs.length || 1)) * 100)}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full"
                style={{ width: `${(rejectedCount / (jobs.length || 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
