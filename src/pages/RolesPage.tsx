import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Check,
  Lock,
  Users,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../services/api';
import { RoleDefinition, UserRole, Permission } from '../types';

interface RolesPageProps {
  currentRole?: UserRole;
}

const PERMISSION_GROUPS: { name: string; permissions: Permission[] }[] = [
  {
    name: 'Workflow & Jobs',
    permissions: ['jobs.view', 'jobs.create', 'jobs.update', 'jobs.pause', 'jobs.resume', 'jobs.retry'],
  },
  {
    name: 'Browser Sessions & Remote Automation',
    permissions: ['sessions.view', 'sessions.control'],
  },
  {
    name: 'Human-in-the-Loop & Verification',
    permissions: ['human_tasks.view', 'human_tasks.assign', 'human_tasks.complete'],
  },
  {
    name: 'Candidate Applications & Submission',
    permissions: ['applications.view', 'applications.update'],
  },
  {
    name: 'Analytics, Audit & Health',
    permissions: ['reports.view', 'audit_logs.view', 'system_health.view'],
  },
  {
    name: 'Accounts & Identity',
    permissions: ['users.view', 'users.create', 'users.update', 'users.disable', 'users.delete'],
  },
  {
    name: 'Roles & Permissions Matrix',
    permissions: ['roles.view', 'roles.create', 'roles.update', 'roles.delete'],
  },
  {
    name: 'System Settings & Concurrency',
    permissions: ['settings.view', 'settings.update'],
  },
  {
    name: 'Secrets & Credential Vault',
    permissions: ['secrets.view_metadata', 'secrets.update'],
  },
  {
    name: 'External Integrations & Sync',
    permissions: ['integrations.view', 'integrations.configure'],
  },
];

export const RolesPage: React.FC<RolesPageProps> = ({ currentRole = 'SUPERADMIN' }) => {
  const isSuperAdmin = currentRole === 'SUPERADMIN';
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    name: '',
    role: '',
    description: '',
    permissions: [] as string[],
  });

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getRoles();
      setRoles(res.items);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to load roles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createRole(createForm as any);
      showFeedback('success', `Role ${createForm.name} created successfully.`);
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', role: '', description: '', permissions: [] });
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to create role.');
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    try {
      await api.updateRole(editingRole.role, {
        name: editingRole.name,
        description: editingRole.description,
        permissions: editingRole.permissions,
      });
      showFeedback('success', `Role ${editingRole.name} updated successfully.`);
      setEditingRole(null);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to update role.');
    }
  };

  const handleDeleteRole = async (role: RoleDefinition) => {
    if (role.isSystem) {
      alert('System core roles cannot be deleted.');
      return;
    }
    if ((role as any).userCount > 0) {
      alert(`Cannot delete role '${role.name}' because ${(role as any).userCount} active users are currently assigned to it. Please reassign them first.`);
      return;
    }
    if (!window.confirm(`Permanently delete role ${role.name}?`)) return;

    try {
      await api.deleteRole(role.role);
      showFeedback('success', `Role ${role.name} deleted.`);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to delete role.');
    }
  };

  const togglePermissionInCreate = (perm: Permission) => {
    setCreateForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const togglePermissionInEdit = (perm: Permission) => {
    if (!editingRole) return;
    if (editingRole.role === 'SUPERADMIN') {
      alert('SUPERADMIN possesses full non-revocable system privileges.');
      return;
    }
    setEditingRole({
      ...editingRole,
      permissions: editingRole.permissions.includes(perm)
        ? editingRole.permissions.filter((p) => p !== perm)
        : [...editingRole.permissions, perm],
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Shield className="w-4 h-4 text-indigo-600" />
            Role-Based Access Control (RBAC)
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Roles & Permissions</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Define system roles, grant fine-grained capability flags, and configure operational access boundaries.
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
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              New Role
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

      {/* Roles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {roles.map((r) => {
          const userCount = (r as any).userCount || 0;
          return (
            <div
              key={r.roleId}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{r.name}</h3>
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                        {r.role}
                      </span>
                      {r.isSystem && (
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                          System Role
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{r.description}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {userCount} {userCount === 1 ? 'user' : 'users'}
                    </span>
                  </div>
                </div>

                {/* Granted Permissions List */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Assigned Permissions ({r.permissions.length})
                    </span>
                    {r.role === 'SUPERADMIN' && (
                      <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Full System Omnipotence
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto pr-1">
                    {r.permissions.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200/80 rounded-md text-[10px] font-mono text-slate-700"
                      >
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[10px]">
                  Updated {new Date(r.updatedAt).toLocaleDateString()}
                </span>
                {isSuperAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingRole({ ...r })}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit Matrix
                    </button>
                    {!r.isSystem && (
                      <button
                        onClick={() => handleDeleteRole(r)}
                        disabled={userCount > 0}
                        title={userCount > 0 ? 'Cannot delete role with assigned users' : 'Delete Role'}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* EDIT ROLE MODAL & PERMISSIONS MATRIX */}
      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Role & Permissions: {editingRole.name}
                </h3>
                <p className="text-xs text-slate-500">Configure granted capabilities for this role.</p>
              </div>
              <button
                onClick={() => setEditingRole(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateRole} className="flex-1 overflow-y-auto py-4 space-y-4 text-xs pr-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={editingRole.name}
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role Description</label>
                <input
                  type="text"
                  required
                  value={editingRole.description}
                  onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="pt-2">
                <h4 className="font-bold text-slate-900 mb-2">Permissions Matrix</h4>
                {editingRole.role === 'SUPERADMIN' ? (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>The SUPERADMIN role maintains absolute administrative control across all sub-systems.</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {PERMISSION_GROUPS.map((group) => (
                      <div key={group.name} className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl">
                        <div className="font-bold text-slate-800 mb-2">{group.name}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {group.permissions.map((perm) => {
                            const isChecked = editingRole.permissions.includes(perm);
                            return (
                              <label
                                key={perm}
                                className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-white transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermissionInEdit(perm)}
                                  className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className={`font-mono text-[11px] ${isChecked ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                                  {perm}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors shadow-xs"
                >
                  Save Role & Permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ROLE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create Custom Role</h3>
                <p className="text-xs text-slate-500">Define a new operational role with tailored capabilities.</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="flex-1 overflow-y-auto py-4 space-y-4 text-xs pr-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Compliance Auditor"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role Identifier (Uppercase)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. COMPLIANCE_AUDITOR"
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value.toUpperCase().trim() })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Read-only oversight for audit logs and verification reports"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="pt-2">
                <h4 className="font-bold text-slate-900 mb-2">Granted Permissions</h4>
                <div className="space-y-4">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.name} className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl">
                      <div className="font-bold text-slate-800 mb-2">{group.name}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.permissions.map((perm) => {
                          const isChecked = createForm.permissions.includes(perm);
                          return (
                            <label
                              key={perm}
                              className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-white transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermissionInCreate(perm)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              <span className={`font-mono text-[11px] ${isChecked ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                                {perm}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors shadow-xs"
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
