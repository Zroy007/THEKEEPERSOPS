import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { NavTab } from '../Navigation';
import { Operator, UserRole, UserAccount, DashboardMetrics } from '../../types';

interface AppLayoutProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  humanTasksCount: number;
  activeSessionsCount: number;
  unreadNotificationsCount?: number;
  currentRole?: UserRole;
  metrics: DashboardMetrics | null;
  mockMode: boolean;
  loggedInUser: UserAccount | null;
  operators: Operator[];
  currentOperatorId: string;
  onSelectOperator: (opId: string, role: UserRole) => void;
  onOpenNewJob: () => void;
  onTriggerQueueWorker: () => void;
  onTriggerSyncSheets: () => void;
  onOpenLogin: () => void;
  onOpenPasswordChange: () => void;
  onLogout: () => void;
  isProcessingQueue: boolean;
  globalSearchTerm: string;
  onGlobalSearchChange: (val: string) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeTab,
  onSelectTab,
  humanTasksCount,
  activeSessionsCount,
  unreadNotificationsCount = 0,
  currentRole = 'SUPERADMIN',
  metrics,
  mockMode,
  loggedInUser,
  operators,
  currentOperatorId,
  onSelectOperator,
  onOpenNewJob,
  onTriggerQueueWorker,
  onTriggerSyncSheets,
  onOpenLogin,
  onOpenPasswordChange,
  onLogout,
  isProcessingQueue,
  globalSearchTerm,
  onGlobalSearchChange,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Collapsible Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        humanTasksCount={humanTasksCount}
        activeSessionsCount={activeSessionsCount}
        unreadNotificationsCount={unreadNotificationsCount}
        currentRole={currentRole}
        isMobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Workspace Frame */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ease-in-out ${
          collapsed ? 'lg:pl-16' : 'lg:pl-60'
        }`}
      >
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          metrics={metrics}
          mockMode={mockMode}
          loggedInUser={loggedInUser}
          currentRole={currentRole}
          operators={operators}
          currentOperatorId={currentOperatorId}
          onSelectOperator={onSelectOperator}
          onOpenNewJob={onOpenNewJob}
          onTriggerQueueWorker={onTriggerQueueWorker}
          onTriggerSyncSheets={onTriggerSyncSheets}
          onOpenLogin={onOpenLogin}
          onOpenPasswordChange={onOpenPasswordChange}
          onLogout={onLogout}
          onSelectTab={onSelectTab}
          onOpenMobileMenu={() => setMobileOpen(true)}
          isProcessingQueue={isProcessingQueue}
          globalSearchTerm={globalSearchTerm}
          onGlobalSearchChange={onGlobalSearchChange}
          unreadNotificationsCount={unreadNotificationsCount}
        />

        {/* Operational Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto space-y-5">
          {children}
        </main>
      </div>
    </div>
  );
};
