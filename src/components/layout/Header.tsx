import React, { useState } from 'react';
import {
  Search,
  Bell,
  Menu,
  Plus,
  Play,
  Table,
  User,
  Shield,
  KeyRound,
  LogIn,
  LogOut,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Cpu,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Operator, UserRole, UserAccount, DashboardMetrics } from '../../types';
import { NavTab } from '../Navigation';

interface HeaderProps {
  activeTab: NavTab;
  metrics: DashboardMetrics | null;
  mockMode: boolean;
  loggedInUser: UserAccount | null;
  currentRole: UserRole;
  operators: Operator[];
  currentOperatorId: string;
  onSelectOperator: (opId: string, role: UserRole) => void;
  onOpenNewJob: () => void;
  onTriggerQueueWorker: () => void;
  onTriggerSyncSheets: () => void;
  onOpenLogin: () => void;
  onOpenPasswordChange: () => void;
  onLogout: () => void;
  onSelectTab: (tab: NavTab) => void;
  onOpenMobileMenu: () => void;
  isProcessingQueue: boolean;
  globalSearchTerm: string;
  onGlobalSearchChange: (val: string) => void;
  unreadNotificationsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  metrics,
  mockMode,
  loggedInUser,
  currentRole,
  operators,
  currentOperatorId,
  onSelectOperator,
  onOpenNewJob,
  onTriggerQueueWorker,
  onTriggerSyncSheets,
  onOpenLogin,
  onOpenPasswordChange,
  onLogout,
  onSelectTab,
  onOpenMobileMenu,
  isProcessingQueue,
  globalSearchTerm,
  onGlobalSearchChange,
  unreadNotificationsCount = 0,
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Tab Titles map
  const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: { title: 'Operations Dashboard', subtitle: 'Real-time overview of pipeline throughput and system capacity' },
    jobs: { title: 'Job Queue & Management', subtitle: 'Automated workflow execution and candidate shop tracking' },
    sessions: { title: 'Cloud Browser Sessions', subtitle: 'Live GoLogin antidetect browser profiles and active runtimes' },
    'human-tasks': { title: 'Human Verification Queue', subtitle: 'Manual operator checkpoints: OTPs, ID verifications, and biometrics' },
    applications: { title: 'Candidate Applications', subtitle: 'Historical submission attempts and platform portal logs' },
    notifications: { title: 'Notifications Center', subtitle: 'Telegram alerts and operator dispatch communication feed' },
    reports: { title: 'Operations Reports', subtitle: 'Throughput analytics, success rates, and workflow performance' },
    accounts: { title: 'User & Access Governance', subtitle: 'Platform accounts, credential rotation, and security lockouts' },
    roles: { title: 'Roles & Permissions Matrix', subtitle: 'Granular role-based capability boundaries and policies' },
    'system-settings': { title: 'System Configuration', subtitle: 'Capacity limits, integration credentials, and service settings' },
    'audit-logs': { title: 'System Audit Logs', subtitle: 'Immutable trace of all administrative and workflow actions' },
    health: { title: 'System Diagnostics & Health', subtitle: 'Integration connection statuses and manual worker triggers' },
    // Aliases
    operators: { title: 'Operator Management', subtitle: 'Human operator assignments and concurrent task quotas' },
    sheets: { title: 'Google Sheets Sync', subtitle: 'Bidirectional spreadsheet synchronization and master queue logs' },
    settings: { title: 'System Settings', subtitle: 'Workflow and capacity configuration' },
    'retry-policies': { title: 'Retry Policies', subtitle: 'Automated error handling and backoff rules' },
    admin: { title: 'Super Admin Suite', subtitle: 'Comprehensive platform administration' },
  };

  const currentTabInfo = tabTitles[activeTab] || {
    title: 'Operations Center',
    subtitle: 'Browser workflow platform',
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30 shadow-2xs">
      {/* Left: Mobile hamburger + Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="truncate">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-900 tracking-tight truncate">
              {currentTabInfo.title}
            </h1>
            {mockMode && (
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-sm bg-amber-50 text-amber-800 border border-amber-300 font-mono text-[10px] font-bold">
                MOCK MODE
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Global Search Input */}
      <div className="hidden md:flex items-center flex-1 max-w-xs mx-3">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search jobs, shops, sessions..."
            value={globalSearchTerm}
            onChange={(e) => onGlobalSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
      </div>

      {/* Right Controls: Capacity + Quick Actions + Notifications + User Menu */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Real-time System Capacity Indicator */}
        {metrics && (
          <div
            className="hidden xl:flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => onSelectTab('sessions')}
            title="Click to view live sessions"
          >
            <Cpu className="w-3.5 h-3.5 text-sky-600" />
            <span className="font-semibold text-slate-800">{metrics.activeSessions}</span>
            <span className="text-slate-400">/</span>
            <span>{metrics.concurrencyLimit ?? '∞'}</span>
            <span className="text-[10px] font-sans text-emerald-700 bg-emerald-100/60 px-1 py-0.2 rounded-sm font-medium">
              {metrics.availableCapacity} avail
            </span>
          </div>
        )}

        {/* Global Quick Actions */}
        <Button
          variant="primary"
          size="sm"
          onClick={onOpenNewJob}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          className="hidden sm:inline-flex"
        >
          New Job
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onTriggerQueueWorker}
          loading={isProcessingQueue}
          leftIcon={<Play className="w-3.5 h-3.5 text-emerald-600" />}
          title="Process Queued Jobs"
          className="hidden lg:inline-flex"
        >
          Run Queue
        </Button>

        {/* Notification Bell */}
        <button
          onClick={() => onSelectTab('notifications')}
          aria-label="View notifications"
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
          )}
        </button>

        {/* User Profile / Authentication Menu */}
        <div className="relative">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 p-1.5 pl-2 rounded-lg hover:bg-slate-100 border border-slate-200/80 transition-colors text-left"
          >
            <div className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center text-xs font-bold font-mono">
              {loggedInUser ? loggedInUser.email[0].toUpperCase() : 'A'}
            </div>
            <div className="hidden sm:block leading-tight pr-1">
              <div className="text-[11px] font-semibold text-slate-800 truncate max-w-[100px]">
                {loggedInUser ? loggedInUser.name : 'Operator'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">{currentRole}</div>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* User Dropdown */}
          {userDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setUserDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-lg border border-slate-200/90 py-1.5 z-40 text-xs text-slate-700 animate-in fade-in duration-100">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="font-semibold text-slate-900 truncate">
                    {loggedInUser?.email || 'zakwanrhmn@gmail.com'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="px-1.5 py-0.2 rounded-sm bg-blue-50 text-blue-700 font-mono text-[10px] font-bold">
                      {currentRole}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">OP: {currentOperatorId}</span>
                  </div>
                </div>

                {/* Operator Switcher */}
                <div className="px-3 py-2 border-b border-slate-100">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Active Operator Context
                  </label>
                  <select
                    value={currentOperatorId}
                    onChange={(e) => {
                      const op = operators.find((o) => o.operatorId === e.target.value);
                      if (op) {
                        onSelectOperator(op.operatorId, op.role);
                      }
                    }}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:bg-white"
                  >
                    {operators.map((op) => (
                      <option key={op.operatorId} value={op.operatorId}>
                        {op.name} ({op.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="py-1">
                  {loggedInUser ? (
                    <>
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onOpenPasswordChange();
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                        Change Password
                      </button>
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-rose-50 flex items-center gap-2 text-rose-700"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-500" />
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onOpenLogin();
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-800 font-semibold"
                    >
                      <LogIn className="w-3.5 h-3.5 text-blue-600" />
                      Sign In as Super Admin
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
