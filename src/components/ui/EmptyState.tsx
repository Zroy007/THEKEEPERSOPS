import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/80 p-8 sm:p-12 text-center max-w-xl mx-auto my-4 shadow-2xs ${className}`}
    >
      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mx-auto mb-3.5 shadow-2xs">
        <Icon className="w-5 h-5 text-slate-600" />
      </div>

      <h3 className="text-sm font-semibold text-slate-900 tracking-tight mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">{description}</p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center justify-center gap-2">
          {actionLabel && onAction && (
            <Button variant="primary" size="sm" onClick={onAction} leftIcon={actionIcon}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="secondary" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
