import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Activity,
  Layers,
  Globe,
  Send,
  Mail,
  Table,
  Database,
  Shield,
  Clock,
  Bell,
  History,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Check,
  ExternalLink,
  Lock,
  Key,
  Flame,
} from 'lucide-react';
import { api } from '../services/api';
import { SystemSettings, SettingVersion, SecretMetadata, UserRole } from '../types';

interface SystemSettingsPageProps {
  currentRole?: UserRole;
}

type SettingsTab =
  | 'general'
  | 'workflow'
  | 'gologin'
  | 'telegram'
  | 'outlook'
  | 'sheets'
  | 'firebase'
  | 'security'
  | 'scheduler'
  | 'notifications'
  | 'history';

export const SystemSettingsPage: React.FC<SystemSettingsPageProps> = ({ currentRole = 'SUPERADMIN' }) => {
  const isSuperAdmin = currentRole === 'SUPERADMIN';
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Settings & History State
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [form, setForm] = useState<Partial<SystemSettings>>({});
  const [history, setHistory] = useState<SettingVersion[]>([]);
  const [secrets, setSecrets] = useState<SecretMetadata[]>([]);

  // Secret Edit Modal
  const [editingSecretKey, setEditingSecretKey] = useState<string | null>(null);
  const [newSecretValue, setNewSecretValue] = useState('');

  // Diagnostic tests state
  const [testResults, setTestResults] = useState<
    Record<string, { loading: boolean; result?: any; error?: string }>
  >({});

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [currentSettings, historyRes, secretsRes] = await Promise.all([
        api.getSettings(),
        api.getSettingsHistory(),
        api.getSecrets().catch(() => ({ items: [] })),
      ]);
      setSettings(currentSettings);
      setForm(currentSettings);
      setHistory(historyRes.items);
      setSecrets(secretsRes.items);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to load system settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      showFeedback('error', 'Only SUPERADMIN can modify platform settings.');
      return;
    }
    try {
      const res = await api.updateSettings(form);
      setSettings(res);
      showFeedback('success', 'Settings saved successfully. Worker configuration will refresh automatically.');
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to update system settings.');
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!isSuperAdmin) return;
    if (!window.confirm('Roll back this setting to the previous recorded snapshot?')) return;
    try {
      const res = await api.rollbackSetting(versionId);
      showFeedback('success', res.message);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to roll back setting.');
    }
  };

  const handleSaveSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSecretKey || !isSuperAdmin) return;
    try {
      await api.updateSecret(editingSecretKey, newSecretValue);
      showFeedback('success', `Secret ${editingSecretKey} securely updated.`);
      setEditingSecretKey(null);
      setNewSecretValue('');
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to update secret.');
    }
  };

  const handleClearSecret = async (key: string) => {
    if (!isSuperAdmin) return;
    if (!window.confirm(`Clear secret ${key}? This will revoke downstream integration credentials.`)) return;
    try {
      await api.clearSecret(key);
      showFeedback('success', `Secret ${key} cleared.`);
      loadData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to clear secret.');
    }
  };

  const runTest = async (key: string, fn: () => Promise<any>) => {
    setTestResults((prev) => ({ ...prev, [key]: { loading: true } }));
    try {
      const result = await fn();
      setTestResults((prev) => ({ ...prev, [key]: { loading: false, result } }));
    } catch (err: any) {
      setTestResults((prev) => ({ ...prev, [key]: { loading: false, error: err.message } }));
    }
  };

  const getSecretMetadata = (key: string): SecretMetadata | undefined => {
    return secrets.find((s) => s.key === key);
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'workflow', label: 'Workflow', icon: Layers },
    { id: 'gologin', label: 'GoLogin', icon: Globe },
    { id: 'telegram', label: 'Telegram', icon: Send },
    { id: 'outlook', label: 'Outlook', icon: Mail },
    { id: 'sheets', label: 'Google Sheets', icon: Table },
    { id: 'firebase', label: 'Firebase', icon: Flame },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'scheduler', label: 'Scheduler', icon: Clock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'history', label: 'Version History', icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-blue-600" />
            System Control Panel
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">System Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage application configuration, integration endpoints, capacity limits, and runtime credentials.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {form.mockMode && (
            <div className="px-3 py-1.5 bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-slate-950" />
              MOCK MODE ACTIVE
            </div>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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

      {/* Settings Layout: Left Navigation + Right Content (Section 19) */}
      <div className="flex flex-col md:flex-row gap-5 items-start">
        {/* Left Side Settings Navigation */}
        <div className="w-full md:w-56 shrink-0 bg-white rounded-xl border border-slate-200/80 p-2 space-y-0.5 shadow-2xs">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Settings Category
          </div>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Settings Form Container */}
        <div className="flex-1 min-w-0 w-full">
          <form onSubmit={handleSave} className="space-y-6">
        {/* TAB 1: GENERAL */}
        {activeTab === 'general' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">General Platform Settings</h3>
              <p className="text-xs text-slate-500">Core operational properties, system branding, and maintenance gates.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">System Name</label>
                <input
                  type="text"
                  value={form.systemName || ''}
                  onChange={(e) => setForm({ ...form, systemName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Timezone</label>
                <input
                  type="text"
                  value={form.timezone || 'Asia/Kuala_Lumpur'}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">System Description</label>
                <textarea
                  rows={2}
                  value={form.systemDescription || ''}
                  onChange={(e) => setForm({ ...form, systemDescription: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Default Job Priority</label>
                <select
                  value={form.defaultPriority || 'HIGH'}
                  onChange={(e) => setForm({ ...form, defaultPriority: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Default Run Mode</label>
                <select
                  value={form.defaultRunMode || 'HEADLESS'}
                  onChange={(e) => setForm({ ...form, defaultRunMode: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                >
                  <option value="HEADLESS">HEADLESS (Automated background execution)</option>
                  <option value="HEADED">HEADED (Visible browser window)</option>
                  <option value="INTERACTIVE">INTERACTIVE (Operator supervised stream)</option>
                </select>
              </div>

              {/* Toggles */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Maintenance Mode</div>
                  <div className="text-[11px] text-slate-500">Temporarily pauses queue scheduling and worker dispatch</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(form.maintenanceMode)}
                  onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-amber-900">Mock Integration Mode</div>
                  <div className="text-[11px] text-amber-700">Simulate external APIs (GoLogin, Telegram, Microsoft, Sheets)</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(form.mockMode)}
                  onChange={(e) => setForm({ ...form, mockMode: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={!isSuperAdmin}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors disabled:opacity-40 shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: WORKFLOW CAPACITY */}
        {activeTab === 'workflow' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Workflow Capacity</h3>
              <p className="text-xs text-slate-500">Dynamic concurrency configuration, queue throttling, and job thresholds.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Concurrency Mode</label>
                <select
                  value={form.concurrencyMode || 'CONFIGURED'}
                  onChange={(e) => setForm({ ...form, concurrencyMode: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                >
                  <option value="CONFIGURED">CONFIGURED (Exact integer limit)</option>
                  <option value="UNLIMITED">UNLIMITED (No artificial cap)</option>
                  <option value="AUTO">AUTO (Dynamic capacity allocation)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Concurrent Sessions Limit</label>
                <input
                  type="number"
                  placeholder="e.g. 10 (Leave blank for unlimited)"
                  value={form.concurrencyLimit ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      concurrencyLimit: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Daily Job Limit</label>
                <input
                  type="number"
                  placeholder="e.g. 100 (Leave blank for UNLIMITED)"
                  value={form.dailyJobLimit ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      dailyJobLimit: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Queue Size Limit</label>
                <input
                  type="number"
                  value={form.queueLimit ?? 100}
                  onChange={(e) => setForm({ ...form, queueLimit: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Session Idle Timeout (Minutes)</label>
                <input
                  type="number"
                  value={form.sessionIdleTimeoutMinutes ?? 15}
                  onChange={(e) => setForm({ ...form, sessionIdleTimeoutMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Human Task Timeout (Minutes)</label>
                <input
                  type="number"
                  value={form.humanTaskTimeoutMinutes ?? 30}
                  onChange={(e) => setForm({ ...form, humanTaskTimeoutMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              <div className="sm:col-span-2 p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Auto Start Queued Jobs</div>
                  <div className="text-[11px] text-slate-500">
                    Automatically triggers worker execution when jobs enter QUEUED state without manual intervention
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(form.autoStartJobs)}
                  onChange={(e) => setForm({ ...form, autoStartJobs: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={!isSuperAdmin}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors disabled:opacity-40 shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: GOLOGIN */}
        {activeTab === 'gologin' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">GoLogin Cloud Browser Integration</h3>
                <p className="text-xs text-slate-500">Antidetect browser profile management, proxy binding, and headless streaming.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Status: CONNECTED
                </span>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">API URL</label>
                <input
                  type="text"
                  value={form.gologinApiUrl || 'https://api.gologin.com'}
                  onChange={(e) => setForm({ ...form, gologinApiUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cloud Browser URL</label>
                <input
                  type="text"
                  value={form.gologinCloudUrl || 'https://cloudbrowser.gologin.com'}
                  onChange={(e) => setForm({ ...form, gologinCloudUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              {/* Secret API Token */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">API Token (Secret)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled
                    value={getSecretMetadata('GOLOGIN_API_TOKEN')?.maskedValue || '••••••••••••••••••••••••••••••'}
                    className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-600 tracking-wider"
                  />
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSecretKey('GOLOGIN_API_TOKEN');
                        setNewSecretValue('');
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs"
                    >
                      Rotate Token
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Secret tokens are stored securely in Google Secret Manager and are never transmitted to client browsers in plaintext.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Connection Timeout (ms)</label>
                  <input
                    type="number"
                    value={form.gologinConnectionTimeout ?? 30000}
                    onChange={(e) => setForm({ ...form, gologinConnectionTimeout: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Max Retries</label>
                  <input
                    type="number"
                    value={form.gologinMaxRetries ?? 3}
                    onChange={(e) => setForm({ ...form, gologinMaxRetries: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              {testResults['gologin'] && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    testResults['gologin'].error
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {testResults['gologin'].error
                    ? `Diagnostic failed: ${testResults['gologin'].error}`
                    : `Connection verified: ${testResults['gologin'].result?.message || 'Ready'}`}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                disabled={testResults['gologin']?.loading}
                onClick={() => runTest('gologin', api.testGoLoginConnection)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Activity className={`w-3.5 h-3.5 ${testResults['gologin']?.loading ? 'animate-spin' : ''}`} />
                Test Connection
              </button>

              <button
                type="submit"
                disabled={!isSuperAdmin}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors disabled:opacity-40 shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: TELEGRAM */}
        {activeTab === 'telegram' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Telegram Bot Notifications</h3>
              <p className="text-xs text-slate-500">Real-time alerts, escalation reminders, OTP checkpoints, and operator pings.</p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bot Token (Secret)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled
                    value={getSecretMetadata('TELEGRAM_BOT_TOKEN')?.maskedValue || '••••••••••••••••••••••••••••••'}
                    className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-600 tracking-wider"
                  />
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSecretKey('TELEGRAM_BOT_TOKEN');
                        setNewSecretValue('');
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs"
                    >
                      Rotate Token
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Default Chat ID</label>
                <input
                  type="text"
                  value={form.telegramDefaultChatId || ''}
                  onChange={(e) => setForm({ ...form, telegramDefaultChatId: e.target.value })}
                  placeholder="e.g. -100192837465"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reminder Interval (Minutes)</label>
                  <input
                    type="number"
                    value={form.telegramReminderIntervalMinutes ?? 10}
                    onChange={(e) => setForm({ ...form, telegramReminderIntervalMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Escalation Threshold (Minutes)</label>
                  <input
                    type="number"
                    value={form.telegramEscalationIntervalMinutes ?? 30}
                    onChange={(e) => setForm({ ...form, telegramEscalationIntervalMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Telegram Notifications Enabled</div>
                  <div className="text-[11px] text-slate-500">Dispatch alerts for HumanTasks, critical failures, and session halts</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(form.telegramNotificationsEnabled)}
                  onChange={(e) => setForm({ ...form, telegramNotificationsEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </div>

              {testResults['telegram'] && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    testResults['telegram'].error
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {testResults['telegram'].error
                    ? `Telegram test failed: ${testResults['telegram'].error}`
                    : `Telegram verified: ${testResults['telegram'].result?.message || 'Dispatched'}`}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                disabled={testResults['telegram']?.loading}
                onClick={() => runTest('telegram', api.testTelegramConnection)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Send className={`w-3.5 h-3.5 ${testResults['telegram']?.loading ? 'animate-spin' : ''}`} />
                Test Telegram
              </button>

              <button
                type="submit"
                disabled={!isSuperAdmin}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors disabled:opacity-40 shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: OUTLOOK / MICROSOFT */}
        {activeTab === 'outlook' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Microsoft 365 / Outlook Integration</h3>
              <p className="text-xs text-slate-500">Enterprise mailbox connection for verification emails and OTP delivery.</p>
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Human-in-the-Loop OTP Compliance Notice:</div>
                <div className="text-[11px] text-blue-800 mt-0.5">
                  The platform does not automatically harvest and bypass verification codes. Outlook remains strictly part of the supervised human operator verification flow.
                </div>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Azure Tenant ID</label>
                  <input
                    type="text"
                    value={form.azureTenantId || ''}
                    onChange={(e) => setForm({ ...form, azureTenantId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Azure Client ID</label>
                  <input
                    type="text"
                    value={form.azureClientId || ''}
                    onChange={(e) => setForm({ ...form, azureClientId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Azure Client Secret</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled
                    value={getSecretMetadata('AZURE_CLIENT_SECRET')?.maskedValue || '••••••••••••••••••••••••••••••'}
                    className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-600 tracking-wider"
                  />
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSecretKey('AZURE_CLIENT_SECRET');
                        setNewSecretValue('');
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs"
                    >
                      Rotate Secret
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Authorized Outlook Mailbox</label>
                <input
                  type="email"
                  value={form.authorizedOutlookMailbox || ''}
                  onChange={(e) => setForm({ ...form, authorizedOutlookMailbox: e.target.value })}
                  placeholder="operator.inbox@enterprise.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              {testResults['outlook'] && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    testResults['outlook'].error
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {testResults['outlook'].error
                    ? `Outlook test failed: ${testResults['outlook'].error}`
                    : `Graph API verified: ${testResults['outlook'].result?.message || 'Authenticated'}`}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                disabled={testResults['outlook']?.loading}
                onClick={() => runTest('outlook', api.testOutlookConnection)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Mail className={`w-3.5 h-3.5 ${testResults['outlook']?.loading ? 'animate-spin' : ''}`} />
                Test Connection
              </button>

              <button
                type="submit"
                disabled={!isSuperAdmin}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors disabled:opacity-40 shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* TAB 6: GOOGLE SHEETS */}
        {activeTab === 'sheets' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Google Sheets Bidirectional Synchronization</h3>
              <p className="text-xs text-slate-500">Sync Master Queue, Application Logs, and Session Registry to external spreadsheets.</p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Spreadsheet ID</label>
                <input
                  type="text"
                  value={form.googleSheetsSpreadsheetId || ''}
                  onChange={(e) => setForm({ ...form, googleSheetsSpreadsheetId: e.target.value })}
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service Account Email</label>
                <input
                  type="email"
                  value={form.googleServiceAccount || ''}
                  onChange={(e) => setForm({ ...form, googleServiceAccount: e.target.value })}
                  placeholder="sheets-worker@my-project.iam.gserviceaccount.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service Account Private Key</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled
                    value={getSecretMetadata('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')?.maskedValue || '••••••••••••••••••••••••••••••'}
                    className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-600 tracking-wider"
                  />
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSecretKey('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
                        setNewSecretValue('');
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs"
                    >
                      Rotate Key
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Master Queue Sheet</label>
                  <input
                    type="text"
                    value={form.masterQueueSheet || 'Master_Queue'}
                    onChange={(e) => setForm({ ...form, masterQueueSheet: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Applications Sheet</label>
                  <input
                    type="text"
                    value={form.applicationLogSheet || 'Applications_Log'}
                    onChange={(e) => setForm({ ...form, applicationLogSheet: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">System Settings Sheet</label>
                  <input
                    type="text"
                    value={form.systemSettingsSheet || 'System_Settings'}
                    onChange={(e) => setForm({ ...form, systemSettingsSheet: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              {testResults['sheets'] && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    testResults['sheets'].error
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {testResults['sheets'].error
                    ? `Sheets test failed: ${testResults['sheets'].error}`
                    : `Sheets verified: ${testResults['sheets'].result?.message || 'Access granted'}`}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={testResults['sheets']?.loading}
                  onClick={() => runTest('sheets', api.testSheetsConnection)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Table className={`w-3.5 h-3.5 ${testResults['sheets']?.loading ? 'animate-spin' : ''}`} />
                  Test Connection
                </button>
                <button
                  type="button"
                  onClick={() => api.syncSheets().then(() => showFeedback('success', 'Sheets synced!'))}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl transition-colors"
                >
                  Sync Now
                </button>
              </div>

              <button
                type="submit"
                disabled={!isSuperAdmin}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors disabled:opacity-40 shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* TAB 7: FIREBASE */}
        {activeTab === 'firebase' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Firebase Firestore & Cloud Storage</h3>
              <p className="text-xs text-slate-500">Persistent database cluster, index configurations, and security rule status.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Firebase Project ID</label>
                <input
                  type="text"
                  value={form.firebaseProjectId || 'ais-dev-project'}
                  onChange={(e) => setForm({ ...form, firebaseProjectId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Firestore Database ID</label>
                <input
                  type="text"
                  value={form.firestoreDatabaseId || '(default)'}
                  onChange={(e) => setForm({ ...form, firestoreDatabaseId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white font-mono"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Client Email (Service Account)</label>
                <input
                  type="email"
                  value={form.firebaseClientEmail || ''}
                  onChange={(e) => setForm({ ...form, firebaseClientEmail: e.target.value })}
                  placeholder="firebase-adminsdk@project.iam.gserviceaccount.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white font-mono"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Firebase Private Key (Secret)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled
                    value={getSecretMetadata('FIREBASE_PRIVATE_KEY')?.maskedValue || '••••••••••••••••••••••••••••••'}
                    className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-600 tracking-wider"
                  />
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSecretKey('FIREBASE_PRIVATE_KEY');
                        setNewSecretValue('');
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs"
                    >
                      Rotate Key
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={!isSuperAdmin}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors disabled:opacity-40 shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* TAB 8: SECURITY */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Security Policies & Authentication</h3>
              <p className="text-xs text-slate-500">JWT token signing, session lifetime, password complexity, and brute-force defenses.</p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">JWT Secret (Secret)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled
                    value={getSecretMetadata('JWT_SECRET')?.maskedValue || '••••••••••••••••••••••••••••••'}
                    className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-600 tracking-wider"
                  />
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSecretKey('JWT_SECRET');
                        setNewSecretValue('');
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs"
                    >
                      Rotate JWT Secret
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-900">Lockout Policy</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Accounts are automatically locked after 5 consecutive failed login attempts. Unlocking requires SUPERADMIN authorization.
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-900">Password Derivation</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Cryptographic scrypt hashing with per-user unique salt. Zero plaintext persistence across logs, queries, and state.
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={!isSuperAdmin}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors disabled:opacity-40 shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* TAB 9: SCHEDULER & NOTIFICATIONS */}
        {(activeTab === 'scheduler' || activeTab === 'notifications') && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {activeTab === 'scheduler' ? 'Worker Scheduling & Cron Jobs' : 'Notification Channels & Alerts'}
              </h3>
              <p className="text-xs text-slate-500">Autonomous loop intervals, health beacons, and event dispatch rules.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Queue Poll Interval (ms)</label>
                <input
                  type="number"
                  value={form.schedulerPollInterval ?? 5000}
                  onChange={(e) => setForm({ ...form, schedulerPollInterval: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Session Health Check (ms)</label>
                <input
                  type="number"
                  value={form.sessionHealthInterval ?? 15000}
                  onChange={(e) => setForm({ ...form, sessionHealthInterval: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={!isSuperAdmin}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors disabled:opacity-40 shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* TAB 10: VERSION HISTORY & ROLLBACK */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Configuration Version History</h3>
                <p className="text-xs text-slate-500">Immutable audit log of all configuration mutations with instant one-click rollback.</p>
              </div>
              <button
                type="button"
                onClick={loadData}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Reload History
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Ver #</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Changes Summary</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No historical configuration revisions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    history.map((h) => (
                      <tr key={h.versionId} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">v{h.version}</td>
                        <td className="py-2.5 px-3 text-slate-500">{new Date(h.changedAt).toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700">{h.changedBy}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                          <span className="font-semibold text-slate-700">{h.settingKey}:</span>{' '}
                          <span className="text-slate-400">{String(h.oldValue ?? 'null')}</span> →{' '}
                          <span className="text-emerald-700 font-medium">{String(h.newValue ?? 'null')}</span>
                          {h.changeType === 'ROLLBACK' && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 text-[10px] font-bold">
                              ROLLBACK
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => handleRollback(h.versionId)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded-lg text-[11px] border border-amber-200 transition-colors"
                            >
                              Rollback
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </form>
        </div>
      </div>

      {/* ROTATE / CONFIGURE SECRET MODAL */}
      {editingSecretKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Rotate Sensitive Secret</h3>
                <p className="text-xs text-slate-500 font-mono">{editingSecretKey}</p>
              </div>
            </div>

            <form onSubmit={handleSaveSecret} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Plaintext Secret Value</label>
                <input
                  type="password"
                  required
                  placeholder="Paste new secret token or key..."
                  value={newSecretValue}
                  onChange={(e) => setNewSecretValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 font-mono"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
                <strong>Zero Leakage Assurance:</strong> This secret is injected directly into Google Secret Manager / Secure Backend Runtime. It will NEVER be exposed in frontend bundles or returned in GET responses.
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleClearSecret(editingSecretKey)}
                  className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold"
                >
                  Clear Secret
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSecretKey(null)}
                    className="px-3 py-1.5 text-slate-600 hover:text-slate-900 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors shadow-xs"
                  >
                    Save & Encrypt
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
