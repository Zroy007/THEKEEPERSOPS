import React, { useState } from 'react';
import { Users, Shield, Sliders, ShieldCheck } from 'lucide-react';
import { AccountsPage } from './AccountsPage';
import { RolesPage } from './RolesPage';
import { SystemSettingsPage } from './SystemSettingsPage';
import { UserRole } from '../types';

interface AdminPageProps {
  currentRole?: UserRole;
  initialSubTab?: 'accounts' | 'roles' | 'settings';
}

export const AdminPage: React.FC<AdminPageProps> = ({
  currentRole = 'SUPERADMIN',
  initialSubTab = 'accounts',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'accounts' | 'roles' | 'settings'>(initialSubTab);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              Super Admin Control Suite
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">Admin Control Panel</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Centralized administrative governance for user accounts, role-based permissions matrix, dynamic workflow capacity, and encrypted credentials.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-xl border border-slate-700/80">
            <button
              onClick={() => setActiveSubTab('accounts')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'accounts'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Accounts
            </button>

            <button
              onClick={() => setActiveSubTab('roles')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'roles'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Roles & Permissions
            </button>

            <button
              onClick={() => setActiveSubTab('settings')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'settings'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              System Settings
            </button>
          </div>
        </div>
      </div>

      {/* Sub Tab Contents */}
      <div>
        {activeSubTab === 'accounts' && <AccountsPage currentRole={currentRole} />}
        {activeSubTab === 'roles' && <RolesPage currentRole={currentRole} />}
        {activeSubTab === 'settings' && <SystemSettingsPage currentRole={currentRole} />}
      </div>
    </div>
  );
};
