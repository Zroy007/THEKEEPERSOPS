import React, { useState } from 'react';
import { ShieldAlert, KeyRound, CheckCircle, AlertTriangle } from 'lucide-react';
import { api, setAuthToken } from '../services/api';

interface PasswordChangeModalProps {
  isOpen: boolean;
  userEmail: string;
  isMandatory?: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
}

export const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({
  isOpen,
  userEmail,
  isMandatory = false,
  onSuccess,
  onCancel,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const validateStrength = (pwd: string) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd)) return 'Password must contain uppercase and lowercase letters.';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number.';
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) return 'Password must contain at least one special character.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    const strengthErr = validateStrength(newPassword);
    if (strengthErr) {
      setError(strengthErr);
      return;
    }

    setLoading(true);
    try {
      const res = await api.changePassword({
        currentPassword: currentPassword || undefined,
        newPassword,
      });

      if (res.token) {
        setAuthToken(res.token);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-amber-500/40 rounded-xl shadow-2xl max-w-md w-full p-6 text-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {isMandatory ? 'Mandatory Password Setup' : 'Change Password'}
            </h3>
            <p className="text-xs text-slate-400">{userEmail}</p>
          </div>
        </div>

        {isMandatory && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/90 leading-relaxed">
              <strong>Initial Bootstrap Credential Detected:</strong> For system security, you must replace your temporary initial password with a permanent secure password before accessing application functions.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Current / Temporary Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current or temporary password"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              New Permanent Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 chars, uppercase, number & symbol"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-type new permanent password"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            {!isMandatory && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? 'Securing Credential...' : 'Set Permanent Password'}
              <CheckCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
