import React from 'react';

export interface MetricTileProps {
  label: string;
  value: string | number;
  sublabel?: string;
  contextIndicator?: string;
  indicatorVariant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export const MetricTile: React.FC<MetricTileProps> = ({
  label,
  value,
  sublabel,
  contextIndicator,
  indicatorVariant = 'neutral',
  icon,
  active = false,
  onClick,
  className = '',
}) => {
  const indicatorColors = {
    neutral: 'text-slate-500 bg-slate-100',
    success: 'text-emerald-700 bg-emerald-50 border border-emerald-200/60',
    warning: 'text-amber-800 bg-amber-50 border border-amber-200/60 font-semibold',
    danger: 'text-rose-700 bg-rose-50 border border-rose-200/60',
    info: 'text-blue-700 bg-blue-50 border border-blue-200/60',
  };

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs transition-all ${
        onClick
          ? 'cursor-pointer hover:border-slate-300 hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20'
          : ''
      } ${active ? 'ring-2 ring-blue-600/30 border-blue-400' : ''} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
          {label}
        </span>
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight leading-none">
          {value}
        </div>
        {contextIndicator && (
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${indicatorColors[indicatorVariant]}`}
          >
            {contextIndicator}
          </span>
        )}
      </div>

      {sublabel && (
        <div className="text-[11px] text-slate-400 mt-1.5 truncate">
          {sublabel}
        </div>
      )}
    </div>
  );
};
