import React, { useState } from 'react';
import {
  X,
  Mail,
  ShieldCheck,
  Camera,
  Fingerprint,
  Phone,
  AlertCircle,
  CheckCircle,
  Bell,
  ExternalLink,
} from 'lucide-react';
import { HumanTask, Operator } from '../types';

interface HumanTaskModalProps {
  task: HumanTask;
  operators: Operator[];
  onClose: () => void;
  onComplete: (taskId: string, notes?: string, payload?: Record<string, any>) => Promise<void>;
  onRemind: (taskId: string) => Promise<void>;
}

export const HumanTaskModal: React.FC<HumanTaskModalProps> = ({
  task,
  operators,
  onClose,
  onComplete,
  onRemind,
}) => {
  const [operatorNotes, setOperatorNotes] = useState('');
  const [confirmedManualEntry, setConfirmedManualEntry] = useState(false);
  const [otpCodeReference, setOtpCodeReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reminding, setReminding] = useState(false);

  const assignedOperator = operators.find((o) => o.operatorId === task.assignedOperatorId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmedManualEntry) return;

    setSubmitting(true);
    try {
      await onComplete(task.humanTaskId, operatorNotes, {
        confirmedManualEntry: true,
        verificationCodeRef: otpCodeReference ? 'manual-entered' : undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReminder = async () => {
    setReminding(true);
    try {
      await onRemind(task.humanTaskId);
    } finally {
      setReminding(false);
    }
  };

  const getTaskIcon = () => {
    switch (task.taskType) {
      case 'EMAIL_OTP':
        return <Mail className="w-5 h-5 text-blue-600" />;
      case 'IDENTITY_VERIFICATION':
        return <ShieldCheck className="w-5 h-5 text-indigo-600" />;
      case 'SELFIE':
        return <Camera className="w-5 h-5 text-purple-600" />;
      case 'BIOMETRIC':
        return <Fingerprint className="w-5 h-5 text-emerald-600" />;
      case 'PHONE_VERIFICATION':
        return <Phone className="w-5 h-5 text-amber-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        id="human-task-modal"
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white shadow-xs border border-slate-200/80">
              {getTaskIcon()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-slate-500">{task.humanTaskId}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                  {task.taskType.replace(/_/g, ' ')}
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-900">{task.title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Policy banner */}
          <div className="rounded-xl p-3.5 bg-blue-50/80 border border-blue-200/80 text-blue-900 text-xs space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Human Checkpoint Policy (Zero-Bypass Mandate)
            </div>
            <p className="text-blue-800 leading-relaxed">
              Authentication and identity verification remain strictly human-controlled. The operator must open the authorized mailbox or interface, inspect the verification requirement, and manually perform the action in the active browser session.
            </p>
          </div>

          {/* Description & Instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Operator Instructions</label>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 font-mono whitespace-pre-line leading-relaxed">
              {task.description}
            </div>
          </div>

          {/* Associated details */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-slate-500 block mb-1">Associated Job</span>
              <span className="font-mono font-medium text-slate-900">{task.jobId}</span>
            </div>
            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-slate-500 block mb-1">Assigned Operator</span>
              <span className="font-medium text-slate-900">{assignedOperator ? assignedOperator.name : 'Unassigned'}</span>
            </div>
          </div>

          {/* If EMAIL_OTP: helper check */}
          {task.taskType === 'EMAIL_OTP' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Manual OTP Code Entry Verification
              </label>
              <input
                type="text"
                placeholder="Enter 6-digit verification code"
                value={otpCodeReference}
                onChange={(e) => setOtpCodeReference(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Code entered here will be recorded as completed and verified directly in the active cloud browser.
              </p>
            </div>
          )}

          {/* Operator resolution notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Operator Notes & Resolution Log</label>
            <textarea
              rows={2}
              placeholder="e.g. Verified code via Outlook mailbox; submitted in browser and confirmed progression to next screen."
              value={operatorNotes}
              onChange={(e) => setOperatorNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Confirmation Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmedManualEntry}
                onChange={(e) => setConfirmedManualEntry(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300"
              />
              <span className="text-xs text-slate-800 leading-snug">
                I confirm that I have manually accessed the authorized credential/document source and completed this verification directly within the browser session without automated bypass.
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSendReminder}
              disabled={reminding}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              {reminding ? 'Sending Telegram...' : `Send Reminder (T+${(task.reminderCount + 1) * 15})`}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!confirmedManualEntry || submitting}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl text-white transition-all shadow-xs ${
                  confirmedManualEntry && !submitting
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                {submitting ? 'Advancing Workflow...' : 'Confirm & Resume Workflow'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
