import React from 'react';
import {
  Activity,
  User,
  Plus,
  RefreshCw,
  Sliders,
  Bell,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  Table,
  KeyRound,
  LogIn,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import { Operator, UserRole, DashboardMetrics, UserAccount } from '../types';

interface NavbarProps {
  operators: Operator[];
  currentOperatorId: string;
  currentRole: UserRole;
  metrics: DashboardMetrics | null;
  mockMode: boolean;
  loggedInUser: UserAccount | null;
  mustChangePassword?: boolean;
  onSelectOperator: (opId: string, role: UserRole) => void;
  onOpenNewJob: () => void;
  onTriggerQueueWorker: () => void;
  onTriggerSyncSheets: () => void;
  onOpenLogin: () => void;
  onOpenPasswordChange: () => void;
  onLogout: () => void;
  isProcessingQueue: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  operators,
  currentOperatorId,
  currentRole,
  metrics,
  mockMode,
  loggedInUser,
  mustChangePassword,
  onSelectOperator,
  onOpenNewJob,
  onTriggerQueueWorker,
  onTriggerSyncSheets,
  onOpenLogin,
  onOpenPasswordChange,
  onLogout,
  isProcessingQueue,
}) => {
  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-6 py-3">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Brand & Mode */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-xs">
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 leading-none">The Keeper's Ops</h1>
              {mockMode && (
                <span
                  id="mock-mode-indicator"
                  className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-amber-100 text-amber-900 border border-amber-300 animate-pulse"
                >
                  MOCK MODE
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Configurable Human-in-the-Loop Browser Engine</p>
          </div>
        </div>

        {/* Dynamic Capacity Status - Only for authenticated sessions */}
        {loggedInUser && metrics && (
          <div className="hidden lg:flex items-center gap-4 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200/70 text-xs">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-500 font-medium">Capacity:</span>
              <span className="font-mono font-bold text-slate-900">
                {metrics.activeSessions} Active / {metrics.concurrencyLimit} Limit
              </span>
            </div>
            <div className="w-px h-3.5 bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Available:</span>
              <span className="font-mono font-bold text-emerald-600">
                {metrics.availableCapacity} slots
              </span>
            </div>
          </div>
        )}

        {/* Action buttons and Operator Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Operational Controls - Rendered strictly when authenticated */}
          {loggedInUser && (
            <>
              {/* Quick Queue Worker Trigger */}
              <button
                id="btn-process-queue"
                onClick={onTriggerQueueWorker}
                disabled={isProcessingQueue}
                title="Execute Queue Scheduler Worker"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isProcessingQueue ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Process Queue</span>
              </button>

              {/* Quick Sheets Sync */}
              <button
                id="btn-sync-sheets"
                onClick={onTriggerSyncSheets}
                title="Synchronize Google Sheets"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
              >
                <Table className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Sync Sheets</span>
              </button>

              {/* New Job Action */}
              <button
                id="btn-new-job"
                onClick={onOpenNewJob}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Job</span>
              </button>
            </>
          )}

          {/* Authenticated User Profile & Session Controls */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            {mustChangePassword && (
              <button
                onClick={onOpenPasswordChange}
                className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border border-amber-500/30 rounded-md text-[11px] font-semibold flex items-center gap-1 animate-pulse"
                title="Password change required"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Change Pwd</span>
              </button>
            )}

            {loggedInUser ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  {loggedInUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    {loggedInUser.name}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      id="verified-role-badge"
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded border ${
                        loggedInUser.role === 'SUPERADMIN'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : loggedInUser.role === 'ADMIN'
                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {loggedInUser.role}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                      {loggedInUser.email}
                    </span>
                  </div>
                </div>

                <button
                  onClick={onOpenPasswordChange}
                  title="Change Account Password"
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors ml-1"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={onLogout}
                  title="Sign Out"
                  id="btn-navbar-logout"
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                id="btn-navbar-login"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
