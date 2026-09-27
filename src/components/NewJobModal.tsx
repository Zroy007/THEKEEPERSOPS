import React, { useState } from 'react';
import { X, PlusCircle, Shield, Globe, Tag, Sparkles } from 'lucide-react';
import { Job, JobPriority, JobRunMode } from '../types';

interface NewJobModalProps {
  onClose: () => void;
  onCreateJob: (data: Partial<Job>) => Promise<void>;
}

export const NewJobModal: React.FC<NewJobModalProps> = ({ onClose, onCreateJob }) => {
  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [passwordReference, setPasswordReference] = useState('');
  const [proxyReference, setProxyReference] = useState('proxy://us-residential.lum-pool.net:22225:node-auto');
  const [priority, setPriority] = useState<JobPriority>('NORMAL');
  const [runMode, setRunMode] = useState<JobRunMode>('AUTO');
  const [autoStart, setAutoStart] = useState(true);
  const [tags, setTags] = useState('us-east, new-merchant');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName || !email) return;

    setSubmitting(true);
    try {
      await onCreateJob({
        shopName,
        email,
        passwordReference: passwordReference || `sec://vault/passwords/${shopName.toLowerCase().replace(/\s+/g, '-')}`,
        proxyReference,
        priority,
        runMode,
        autoStart,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        notes,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillSample = () => {
    const randomId = Math.floor(100 + Math.random() * 900);
    setShopName(`Cascade Peak Outfitters #${randomId}`);
    setEmail(`cascade.${randomId}@outfit-mail.org`);
    setPasswordReference(`sec://vault/passwords/cascade-${randomId}`);
    setTags('outdoor, apparel, us-west');
    setNotes('Merchant onboarding queue entry with residential proxy.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        id="new-job-modal"
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Create Workflow Job</h3>
              <p className="text-xs text-slate-500">Initialize a new configurable browser workflow job</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleFillSample}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> Fill Sample Data
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Shop / Merchant Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. AuraCraft Studios"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Authorized Email Address *</label>
            <input
              type="email"
              required
              placeholder="e.g. auracraft.ops@outfit-mail.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Shield className="w-3 h-3 text-slate-400" /> Password Reference
              </label>
              <input
                type="text"
                placeholder="sec://vault/passwords/..."
                value={passwordReference}
                onChange={(e) => setPasswordReference(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Globe className="w-3 h-3 text-slate-400" /> Proxy Reference
              </label>
              <input
                type="text"
                placeholder="proxy://host:port:ref"
                value={proxyReference}
                onChange={(e) => setProxyReference(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as JobPriority)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Run Mode</label>
              <select
                value={runMode}
                onChange={(e) => setRunMode(e.target.value as JobRunMode)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="AUTO">Auto</option>
                <option value="SEMI_AUTO">Semi-Auto</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>

            <div className="space-y-1 flex flex-col justify-end">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoStart}
                  onChange={(e) => setAutoStart(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300"
                />
                Auto-Start
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Tag className="w-3 h-3 text-slate-400" /> Tags (comma separated)
            </label>
            <input
              type="text"
              placeholder="e.g. us-east, retail, priority-batch"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Initial Operator Notes</label>
            <textarea
              rows={2}
              placeholder="Optional notes or context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors"
            >
              {submitting ? 'Creating Job...' : 'En-Queue Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
