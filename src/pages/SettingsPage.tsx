import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Cpu, Clock, Bell, Shield, CheckCircle } from 'lucide-react';
import { SystemSettings } from '../types';

interface SettingsPageProps {
  settings: SystemSettings;
  onSaveSettings: (updates: Partial<SystemSettings>) => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSaveSettings }) => {
  const [form, setForm] = useState<SystemSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings(form);
      setSuccessMsg('Settings successfully updated.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Platform System Settings & Dynamic Capacity
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure concurrency limits, operational timeouts, human task escalation schedules, and integrations.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* DYNAMIC CONCURRENCY & LIMITS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Cpu className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Dynamic Concurrency & Throttling Limits</h3>
            <p className="text-xs text-slate-500">
              Never hardcoded to 6. Supports configurable positive integers or unlimited execution.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Concurrency Mode</label>
            <select
              value={form.concurrencyMode}
              onChange={(e) =>
                setForm({
                  ...form,
                  concurrencyMode: e.target.value as 'CONFIGURED' | 'UNLIMITED',
                })
              }
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
            >
              <option value="CONFIGURED">CONFIGURED (Strict Limit Enforcement)</option>
              <option value="UNLIMITED">UNLIMITED (Run All Queued Jobs)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Max Concurrent Browser Sessions {form.concurrencyMode === 'UNLIMITED' && '(Disabled)'}
            </label>
            <input
              type="number"
              min="1"
              max="500"
              disabled={form.concurrencyMode === 'UNLIMITED'}
              value={form.concurrencyLimit ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  concurrencyLimit: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl disabled:bg-slate-100 disabled:text-slate-400 font-mono"
            />
            <span className="text-[11px] text-slate-400">e.g. 10, 20, 50, or leave empty for unlimited</span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Daily Job Throughput Limit</label>
            <input
              type="number"
              min="1"
              value={form.dailyJobLimit ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  dailyJobLimit: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Maximum Queue Backlog Size</label>
            <input
              type="number"
              min="1"
              value={form.queueLimit ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  queueLimit: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
            />
          </div>
        </div>
      </div>

      {/* TIMEOUTS & ESCALATION INTERVALS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Clock className="w-5 h-5 text-amber-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Timeouts & Operator Escalation Schedules</h3>
            <p className="text-xs text-slate-500">
              Timers for OTP expiration, human task reminders (T+0, T+15, T+30...), and review polling.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Email OTP Expiration (Minutes)</label>
            <input
              type="number"
              value={form.otpTimeoutMinutes}
              onChange={(e) => setForm({ ...form, otpTimeoutMinutes: parseInt(e.target.value) || 30 })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Human Task Reminder Interval (Min)</label>
            <input
              type="number"
              value={form.humanTaskReminderMinutes}
              onChange={(e) => setForm({ ...form, humanTaskReminderMinutes: parseInt(e.target.value) || 15 })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Supervisor Escalation Timeout (Min)</label>
            <input
              type="number"
              value={form.humanTaskEscalationMinutes}
              onChange={(e) => setForm({ ...form, humanTaskEscalationMinutes: parseInt(e.target.value) || 60 })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Application Review Polling (Min)</label>
            <input
              type="number"
              value={form.reviewCheckIntervalMinutes}
              onChange={(e) => setForm({ ...form, reviewCheckIntervalMinutes: parseInt(e.target.value) || 60 })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Browser Session Idle Timeout (Min)</label>
            <input
              type="number"
              value={form.sessionIdleTimeoutMinutes}
              onChange={(e) => setForm({ ...form, sessionIdleTimeoutMinutes: parseInt(e.target.value) || 30 })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Max Default Retries</label>
            <input
              type="number"
              value={form.defaultMaxRetries}
              onChange={(e) => setForm({ ...form, defaultMaxRetries: parseInt(e.target.value) || 3 })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
            />
          </div>
        </div>
      </div>

      {/* SYSTEM TOGGLES */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Shield className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Integration Switches & Operations</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoStartJobs}
              onChange={(e) => setForm({ ...form, autoStartJobs: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-slate-300"
            />
            <div>
              <span className="font-semibold text-slate-800 block">Auto-Start New Jobs</span>
              <span className="text-slate-500 text-[11px]">Advance newly submitted jobs straight into queue</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoRetryTechnicalErrors}
              onChange={(e) => setForm({ ...form, autoRetryTechnicalErrors: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-slate-300"
            />
            <div>
              <span className="font-semibold text-slate-800 block">Auto-Retry Technical Errors</span>
              <span className="text-slate-500 text-[11px]">Apply exponential backoff policy automatically</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={form.telegramNotificationsEnabled}
              onChange={(e) => setForm({ ...form, telegramNotificationsEnabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-slate-300"
            />
            <div>
              <span className="font-semibold text-slate-800 block">Telegram Operator Alerts</span>
              <span className="text-slate-500 text-[11px]">Dispatch notifications for checkpoints and state changes</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={form.maintenanceMode}
              onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })}
              className="w-4 h-4 text-rose-600 rounded border-slate-300"
            />
            <div>
              <span className="font-semibold text-slate-800 block">Maintenance Mode</span>
              <span className="text-slate-500 text-[11px]">Pause all automatic queue processing</span>
            </div>
          </label>
        </div>
      </div>
    </form>
  );
};
