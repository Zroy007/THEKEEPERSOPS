import React from 'react';
import { UserRole } from '../types';
import {
  LayoutDashboard,
  Layers,
  Monitor,
  CheckSquare,
  Award,
  Bell,
  Users,
  Sliders,
  Shield,
  FileText,
  Activity,
  BarChart3,
  ShieldCheck,
  Table,
  RotateCcw,
  Settings,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'jobs'
  | 'sessions'
  | 'human-tasks'
  | 'applications'
  | 'notifications'
  | 'reports'
  | 'accounts'
  | 'roles'
  | 'system-settings'
  | 'audit-logs'
  | 'health'
  // Legacy / alias tabs
  | 'operators'
  | 'sheets'
  | 'settings'
  | 'retry-policies'
  | 'admin';

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  humanTasksCount: number;
  activeSessionsCount: number;
  currentRole?: UserRole;
}

interface TabItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  badgeColor?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  humanTasksCount,
  activeSessionsCount,
  currentRole = 'SUPERADMIN',
}) => {
  // Master definitions of all available system tabs
  const allTabDefs: Record<NavTab, TabItem> = {
    dashboard: { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    jobs: { id: 'jobs', label: 'Jobs', icon: Layers },
    sessions: {
      id: 'sessions',
      label: 'Sessions',
      icon: Monitor,
      badge: activeSessionsCount > 0 ? activeSessionsCount : undefined,
    },
    'human-tasks': {
      id: 'human-tasks',
      label: 'Human Tasks',
      icon: CheckSquare,
      badge: humanTasksCount > 0 ? humanTasksCount : undefined,
      badgeColor: 'bg-amber-500',
    },
    applications: { id: 'applications', label: 'Applications', icon: Award },
    notifications: { id: 'notifications', label: 'Notifications', icon: Bell },
    reports: { id: 'reports', label: 'Reports', icon: BarChart3 },
    accounts: { id: 'accounts', label: 'Accounts', icon: Users },
    roles: { id: 'roles', label: 'Roles', icon: Shield },
    'system-settings': { id: 'system-settings', label: 'System Settings', icon: Sliders },
    'audit-logs': { id: 'audit-logs', label: 'Audit Logs', icon: FileText },
    health: { id: 'health', label: 'System Health', icon: Activity },
    // Aliases
    operators: { id: 'operators', label: 'Operators', icon: Users },
    sheets: { id: 'sheets', label: 'Sheets Sync', icon: Table },
    settings: { id: 'settings', label: 'Settings', icon: Settings },
    'retry-policies': { id: 'retry-policies', label: 'Retry Policies', icon: RotateCcw },
    admin: { id: 'admin', label: 'Admin Suite', icon: ShieldCheck },
  };

  // Determine authorized tabs based strictly on currentRole as requested by user
  let allowedTabIds: NavTab[] = [];
  if (currentRole === 'SUPERADMIN' || currentRole === 'ADMIN') {
    allowedTabIds = [
      'dashboard',
      'jobs',
      'sessions',
      'human-tasks',
      'applications',
      'notifications',
      'reports',
      'accounts',
      'roles',
      'system-settings',
      'audit-logs',
      'health',
    ];
  } else if (currentRole === 'SUPERVISOR') {
    allowedTabIds = [
      'dashboard',
      'jobs',
      'sessions',
      'human-tasks',
      'applications',
      'notifications',
      'reports',
      'health',
    ];
  } else if (currentRole === 'OPERATOR') {
    allowedTabIds = [
      'dashboard',
      'jobs',
      'sessions',
      'human-tasks',
      'applications',
    ];
  } else if (currentRole === 'VIEWER') {
    allowedTabIds = [
      'dashboard',
      'jobs',
      'applications',
      'reports',
    ];
  } else {
    // Default fallback
    allowedTabIds = ['dashboard', 'jobs', 'sessions', 'human-tasks', 'applications'];
  }

  const visibleTabs = allowedTabIds.map((id) => allTabDefs[id]).filter(Boolean);

  return (
    <nav className="bg-white border-b border-slate-200/80 px-6 overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-1 max-w-7xl mx-auto py-2">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            activeTab === tab.id ||
            (tab.id === 'accounts' && activeTab === 'admin') ||
            (tab.id === 'system-settings' && activeTab === 'settings');
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold text-white ${
                    tab.badgeColor || 'bg-blue-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
