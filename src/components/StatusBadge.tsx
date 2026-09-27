import React from 'react';
import {
  Clock,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  PauseCircle,
  RotateCcw,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { JobStatus } from '../types';

interface StatusBadgeProps {
  status: JobStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let Icon = Clock;
  let label = status.replace(/_/g, ' ');

  switch (status) {
    case 'QUEUED':
    case 'PREPARING':
    case 'PROXY_CHECKING':
    case 'PROXY_READY':
    case 'BROWSER_STARTING':
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      Icon = Clock;
      break;

    case 'BROWSER_READY':
    case 'SIGNUP_STARTED':
    case 'REGISTRATION_CONTINUING':
    case 'SHOP_INFORMATION':
    case 'READY_FOR_SUBMISSION':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      Icon = PlayCircle;
      break;

    case 'WAITING_FOR_EMAIL_OTP':
    case 'HUMAN_IDENTITY_VERIFICATION':
    case 'HUMAN_SELFIE_REQUIRED':
    case 'HUMAN_BIOMETRIC_REQUIRED':
    case 'PHONE_VERIFICATION':
      colorClasses = 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse';
      Icon = AlertTriangle;
      break;

    case 'HUMAN_ACTION_COMPLETED':
      colorClasses = 'bg-teal-50 text-teal-700 border-teal-200';
      Icon = UserCheck;
      break;

    case 'SUBMITTED':
    case 'WAITING_FOR_REVIEW':
      colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      Icon = Clock;
      break;

    case 'APPROVED':
    case 'COMPLETED':
      colorClasses = 'bg-green-50 text-green-700 border-green-200';
      Icon = CheckCircle2;
      break;

    case 'REJECTED':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
      Icon = XCircle;
      break;

    case 'ERROR':
      colorClasses = 'bg-red-50 text-red-700 border-red-200';
      Icon = AlertTriangle;
      break;

    case 'PAUSED':
      colorClasses = 'bg-stone-100 text-stone-700 border-stone-200';
      Icon = PauseCircle;
      break;

    case 'RETRY_PENDING':
      colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
      Icon = RotateCcw;
      break;

    case 'MANUAL_REVIEW':
      colorClasses = 'bg-orange-50 text-orange-800 border-orange-200';
      Icon = ShieldAlert;
      break;
  }

  const sizeClass =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : size === 'lg'
      ? 'px-3.5 py-1.5 text-sm font-semibold'
      : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      id={`badge-${status.toLowerCase().replace(/_/g, '-')}`}
      className={`inline-flex items-center gap-1.5 rounded-md border ${sizeClass} ${colorClasses} whitespace-nowrap tracking-wide`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{label}</span>
    </span>
  );
};
