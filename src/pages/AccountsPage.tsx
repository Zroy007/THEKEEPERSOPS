import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Mail,
  Send,
  UserX,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../services/api';
import { UserAccount, RoleDefinition, UserRole, AccountStatus } from '../types';

interface AccountsPageProps {
  currentRole?: UserRole;
}

export const AccountsPage: React.FC<AccountsPageProps> = ({ currentRole = 'SUPERADMIN' }) => {
  const isSuperAdmin = currentRole === 'SUPERADMIN';
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [resetModalUser, setResetModalUser] = useState<UserAccount | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'OPERATOR' as UserRole,
    status: 'ACTIVE' as AccountStatus,
    telegramChatId: '',
    notes: '',
  });

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.getUsers({ search: search || undefined, role: roleFilter, status: statusFilter }),
        api.getRoles(),
      ]);
      setUsers(usersRes.items);
      setRoles(rolesRes.items);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to load accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, roleFilter, statusFilter]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser(form);
      showFeedback('success', `Account ${form.name} (${form.email}) created successfully.`);
      setIsCreateOpen(false);
      setForm({
        name: '',
        email: '',
        role: 'OPERATOR',
        status: 'ACTIVE',
        telegramChatId: '',
        notes: '',
      });
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to create account.');
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await api.updateUser(editingUser.uid, {
        name: editingUser.name,
        role: editingUser.role,
        status: editingUser.status,
        telegramChatId: editingUser.telegramChatId,
        notes: editingUser.notes,
      });
      showFeedback('success', `Account ${editingUser.name} updated successfully.`);
      setEditingUser(null);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to update account.');
    }
  };

  const handleToggleStatus = async (user: UserAccount) => {
    const newStatus: AccountStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await api.updateUser(user.uid, { status: newStatus });
      showFeedback('success', `Account ${user.name} is now ${newStatus}.`);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to change status.');
    }
  };

  const handleUnlock = async (user: UserAccount) => {
    try {
      await api.unlockUser(user.uid);
      showFeedback('success', `Account ${user.name} has been unlocked.`);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to unlock account.');
    }
  };

  const handleDelete = async (user: UserAccount) => {
    if (!window.confirm(`Are you sure you want to permanently delete account ${user.name} (${user.email})?`)) {
      return;
    }
    try {
      await api.deleteUser(user.uid);
      showFeedback('success', `Account ${user.name} deleted.`);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to delete account.');
    }
  };

  const handleTriggerResetPassword = async (user: UserAccount) => {
    const tempPassword = `Reset${Math.random().toString(36).slice(-6)}!Aa1`;
    try {
      await api.resetUserPassword(user.uid, tempPassword);
      setResetSuccessMessage(
        `Temporary password set to: ${tempPassword}. The user ${user.email} must change it on their next login.`
      );
      setResetModalUser(user);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to issue password reset.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Users className="w-4 h-4 text-blue-600" />
            Identity & Access Administration
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Accounts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage user identity records, assigned roles, security status, and account authorizations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Account
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or user ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:bg-white"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPERADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="OPERATOR">Operator</option>
            <option value="VIEWER">Viewer</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
            <option value="LOCKED">Locked</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No accounts found matching search filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{u.uid}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {u.email}
                      {u.telegramChatId && (
                        <div className="text-[10px] text-blue-600 font-mono mt-0.5">
                          TG: {u.telegramChatId}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          u.role === 'SUPERADMIN'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : u.role === 'ADMIN'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : u.role === 'SUPERVISOR'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : u.status === 'LOCKED'
                            ? 'bg-rose-100 text-rose-800'
                            : u.status === 'DISABLED'
                            ? 'bg-slate-200 text-slate-600'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {u.status === 'LOCKED' && <Lock className="w-2.5 h-2.5" />}
                        {u.status}
                      </span>
                      {u.failedLoginAttempts > 0 && (
                        <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                          {u.failedLoginAttempts} failed attempts
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {u.lastLoginAt ? (
                        <div>
                          <div>{new Date(u.lastLoginAt).toLocaleDateString()}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{u.lastLoginIp || '-'}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Never</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {u.status === 'LOCKED' && isSuperAdmin && (
                          <button
                            onClick={() => handleUnlock(u)}
                            title="Unlock Account"
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={u.role === 'SUPERADMIN' && u.status === 'ACTIVE'}
                            title={u.status === 'ACTIVE' ? 'Disable Account' : 'Enable Account'}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
                          >
                            {u.status === 'ACTIVE' ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleTriggerResetPassword(u)}
                            title="Issue Password Reset"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => setEditingUser({ ...u })}
                            title="Edit Account Details"
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={u.role === 'SUPERADMIN'}
                            title={u.role === 'SUPERADMIN' ? 'SuperAdmin protected' : 'Delete Account'}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ACCOUNT MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create New Account</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="operator@enterprise.internal"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                  >
                    <option value="OPERATOR">OPERATOR</option>
                    <option value="SUPERVISOR">SUPERVISOR</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="VIEWER">VIEWER</option>
                    <option value="SUPERADMIN">SUPERADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as AccountStatus })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PENDING">PENDING</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Telegram Chat ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 123456789"
                  value={form.telegramChatId}
                  onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Administrative Notes</label>
                <textarea
                  rows={2}
                  placeholder="Department, authorization level, notes..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-800">
                <span className="font-semibold">Temporary Invitation Flow:</span> A temporary initialization credential will be provisioned. The user will be required to configure their permanent password on first sign-in.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors shadow-xs"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ACCOUNT MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Account: {editingUser.name}</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateAccount} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={editingUser.email}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Role</label>
                  <select
                    value={editingUser.role}
                    disabled={editingUser.role === 'SUPERADMIN'}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white disabled:opacity-50"
                  >
                    <option value="OPERATOR">OPERATOR</option>
                    <option value="SUPERVISOR">SUPERVISOR</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="VIEWER">VIEWER</option>
                    <option value="SUPERADMIN">SUPERADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editingUser.status}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as AccountStatus })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DISABLED">DISABLED</option>
                    <option value="LOCKED">LOCKED</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Telegram Chat ID</label>
                <input
                  type="text"
                  value={editingUser.telegramChatId || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, telegramChatId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Administrative Notes</label>
                <textarea
                  rows={2}
                  value={editingUser.notes || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD CONFIRMATION MODAL */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200 text-center">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Password Reset Dispatched</h3>
            <p className="text-xs text-slate-500 mb-4">
              {resetSuccessMessage || (
                <>
                  A temporary password reset token has been issued for <strong>{resetModalUser.email}</strong>. The user must rotate their credential upon their next sign-in.
                </>
              )}
            </p>
            <button
              onClick={() => setResetModalUser(null)}
              className="w-full px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
