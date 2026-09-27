import React from 'react';

export interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple' | 'cyan';
  size?: 'xs' | 'sm' | 'md';
  icon?: React.ReactNode;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
  icon,
  dot = false,
  children,
  className = '',
  title,
}) => {
  const variants = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-200/90 font-medium',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    purple: 'bg-purple-50 text-purple-800 border-purple-200',
    cyan: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  };

  const dots = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-blue-500',
    neutral: 'bg-slate-400',
    purple: 'bg-purple-500',
    cyan: 'bg-cyan-500',
  };

  const sizes = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1 rounded-sm',
    sm: 'px-2 py-0.5 text-[11px] gap-1.2 rounded-md',
    md: 'px-2.5 py-1 text-xs gap-1.5 rounded-md font-medium',
  };

  return (
    <span
      title={title}
      className={`inline-flex items-center font-medium border leading-none select-none tracking-tight ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dots[variant]}`} />}
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
};
