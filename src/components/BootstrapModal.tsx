import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Key, User, Mail, AlertTriangle } from 'lucide-react';
import { api, setAuthToken } from '../services/api';
import { UserAccount } from '../types';

interface BootstrapModalProps {
  isOpen: boolean;
  onSuccess: (user: UserAccount) => void;
}

export const BootstrapModal: React.FC<BootstrapModalProps> = ({ isOpen, onSuccess }) => {
  const [name, setName] = useState('System Owner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.bootstrap({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        bootstrapSecret: bootstrapSecret.trim() || undefined,
      });

      if (res.token) {
        setAuthToken(res.token);
      }
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Bootstrap initialization failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-inner">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">Initialize Super Admin</h2>
            <p className="text-xs text-slate-400">One-time operational security bootstrap</p>
          </div>
        </div>

        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4 text-xs text-amber-200 leading-relaxed">
          No active Super Admin currently exists in this datastore. Complete this one-time bootstrap setup to claim full administrative ownership. Once initialized, this bootstrap endpoint will be permanently locked.
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. System Owner"
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@internal.domain"
                autoComplete="username"
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password</label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Bootstrap Secret <span className="text-[10px] font-normal text-slate-500">(Optional / if set in env)</span>
            </label>
            <input
              type="password"
              value={bootstrapSecret}
              onChange={(e) => setBootstrapSecret(e.target.value)}
              placeholder="Leave blank if not configured in environment"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={loading}
              id="btn-bootstrap-submit"
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {loading ? 'Initializing Super Admin...' : 'Claim Super Admin & Initialize'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
