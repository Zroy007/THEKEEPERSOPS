import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'sm',
      loading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    // Base operational button classes
    const base =
      'inline-flex items-center justify-center font-medium transition-colors select-none focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap active:scale-[0.99]';

    // Variant mapping
    const variants = {
      primary:
        'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 focus:ring-slate-900 border border-transparent shadow-xs',
      secondary:
        'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 focus:ring-blue-500 shadow-xs',
      outline:
        'bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-300 focus:ring-slate-400',
      ghost:
        'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent focus:ring-slate-400',
      danger:
        'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus:ring-rose-500 border border-transparent shadow-xs',
      success:
        'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 focus:ring-emerald-500 border border-transparent shadow-xs',
    };

    // Size mapping (compact operations scale)
    const sizes = {
      xs: 'px-2 py-1 text-[11px] rounded-md gap-1',
      sm: 'px-2.5 py-1.5 text-xs rounded-lg gap-1.5',
      md: 'px-3 py-2 text-xs rounded-lg gap-2',
      lg: 'px-4 py-2 text-sm rounded-lg gap-2',
      icon: 'p-1.5 text-xs rounded-lg',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
