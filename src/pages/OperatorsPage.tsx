import React, { useState } from 'react';
import { Users, Plus, Shield, CheckCircle2, UserCheck, MessageSquare } from 'lucide-react';
import { Operator, UserRole } from '../types';

interface OperatorsPageProps {
  operators: Operator[];
  onCreateOperator: (data: Partial<Operator>) => Promise<void>;
}

export const OperatorsPage: React.FC<OperatorsPageProps> = ({ operators, onCreateOperator }) => {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('OPERATOR');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [maxConcurrentHumanTasks, setMaxConcurrentHumanTasks] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreateOperator({
        name,
        email,
        role,
        telegramChatId,
        maxConcurrentHumanTasks,
        active: true,
      });
      setShowModal(false);
      setName('');
      setEmail('');
      setTelegramChatId('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Human Operators & Access Control (RBAC)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Authorized team members assigned to handle manual checkpoints, OTP entry, and application reviews.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Operator
        </button>
      </div>

      {/* Grid of Operators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {operators.map((op) => (
          <div
            key={op.operatorId}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <span className="font-mono text-xs font-bold text-slate-500">{op.operatorId}</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded font-bold ${
                    op.role === 'ADMIN'
                      ? 'bg-purple-100 text-purple-800'
                      : op.role === 'SUPERVISOR'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {op.role}
                </span>
              </div>

              <div className="mt-3">
                <h3 className="text-base font-bold text-slate-900">{op.name}</h3>
                <p className="text-xs text-slate-500 font-mono">{op.email}</p>
              </div>

              <div className="mt-4 p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-500" /> Telegram Chat ID:
                  </span>
                  <span className="font-mono text-slate-800 font-medium">
                    {op.telegramChatId || 'Not configured'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Active Task Load:</span>
                  <span className="font-semibold text-slate-900">
                    {op.currentTasksCount} / {op.maxConcurrentHumanTasks} Max
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Active Status
              </span>
              <span className="text-slate-400 font-mono text-[11px]">Since {new Date(op.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Operator Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in">
            <h3 className="text-base font-bold text-slate-900 mb-4">Register Platform Operator</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Role (RBAC)</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="OPERATOR">Operator</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="ADMIN">Admin</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Concurrent Limit</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={maxConcurrentHumanTasks}
                    onChange={(e) => setMaxConcurrentHumanTasks(parseInt(e.target.value) || 5)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Telegram Chat ID</label>
                <input
                  type="text"
                  placeholder="e.g. 58392019"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                >
                  {submitting ? 'Registering...' : 'Register Operator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
