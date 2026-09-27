import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Monitor,
  CheckSquare,
  Award,
  Bell,
  BarChart3,
  Users,
  Shield,
  Sliders,
  FileText,
  Activity,
  ChevronLeft,
  ChevronRight,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { NavTab } from '../Navigation';
import { UserRole } from '../../types';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  humanTasksCount: number;
  activeSessionsCount: number;
  unreadNotificationsCount?: number;
  currentRole?: UserRole;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  badgeVariant?: 'amber' | 'blue' | 'neutral';
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  humanTasksCount,
  activeSessionsCount,
  unreadNotificationsCount = 0,
  currentRole = 'SUPERADMIN',
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const operationsNav: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'jobs', label: 'Jobs', icon: Layers },
    {
      id: 'sessions',
      label: 'Sessions',
      icon: Monitor,
      badge: activeSessionsCount > 0 ? activeSessionsCount : undefined,
      badgeVariant: 'blue',
    },
    {
      id: 'human-tasks',
      label: 'Human Tasks',
      icon: CheckSquare,
      badge: humanTasksCount > 0 ? humanTasksCount : undefined,
      badgeVariant: 'amber',
    },
    { id: 'applications', label: 'Applications', icon: Award },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
      badgeVariant: 'neutral',
    },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  // Administration navigation items
  const adminNav: NavItem[] = [
    { id: 'accounts', label: 'Accounts', icon: Users },
    { id: 'roles', label: 'Roles', icon: Shield },
    { id: 'system-settings', label: 'Settings', icon: Sliders },
    { id: 'audit-logs', label: 'Audit Logs', icon: FileText },
    { id: 'health', label: 'System Health', icon: Activity },
  ];

  // Role permissions gate for administration section
  const canAccessAdmin = currentRole === 'SUPERADMIN' || currentRole === 'ADMIN';

  const handleNavClick = (tabId: NavTab) => {
    onSelectTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const renderNavList = (items: NavItem[], sectionTitle?: string) => (
    <div className="space-y-0.5">
      {sectionTitle && !collapsed && (
        <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
          {sectionTitle}
        </div>
      )}
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            title={collapsed ? item.label : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all select-none group relative ${
              isActive
                ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs border border-slate-700/60'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            } ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <Icon
              className={`w-4 h-4 shrink-0 transition-colors ${
                isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            />

            {!collapsed && (
              <>
                <span className="truncate flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-sm shrink-0 leading-tight ${
                      item.badgeVariant === 'amber'
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 animate-pulse'
                        : item.badgeVariant === 'blue'
                        ? 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </>
            )}

            {/* Collapsed Badge Dot */}
            {collapsed && item.badge !== undefined && (
              <span
                className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-slate-900 ${
                  item.badgeVariant === 'amber'
                    ? 'bg-amber-400'
                    : item.badgeVariant === 'blue'
                    ? 'bg-sky-400'
                    : 'bg-slate-400'
                }`}
              />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col transition-all duration-200 ease-in-out ${
          collapsed ? 'w-16' : 'w-60'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand / Platform Identity Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800/80 shrink-0">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-400/30 flex items-center justify-center shrink-0">
                <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
              </div>
              <div className="leading-tight truncate">
                <div className="text-xs font-bold text-white tracking-wider uppercase">
                  Workflow Ops
                </div>
                <div className="text-[10px] text-slate-400 font-mono">Control Center</div>
              </div>
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-400/30 flex items-center justify-center mx-auto">
              <Radio className="w-3.5 h-3.5 text-sky-400" />
            </div>
          )}

          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
          {renderNavList(operationsNav, 'Operations')}

          {canAccessAdmin && (
            <div className="pt-2 border-t border-slate-800/80">
              {renderNavList(adminNav, 'Administration')}
            </div>
          )}
        </div>

        {/* Footer Role & Environment Indicator */}
        <div className="p-3 border-t border-slate-800 shrink-0 bg-slate-950/40">
          {!collapsed ? (
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="font-mono text-slate-400 truncate">{currentRole}</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-300 font-mono text-[10px]">
                v2.4
              </span>
            </div>
          ) : (
            <div className="flex justify-center" title={`Current Role: ${currentRole}`}>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
