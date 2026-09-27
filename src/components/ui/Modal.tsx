import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerIcon?: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  headerIcon,
  className = '',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
    full: 'max-w-[96vw] h-[92vh]',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="fixed inset-0"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        className={`relative z-10 w-full bg-white rounded-xl shadow-xl border border-slate-200/90 flex flex-col overflow-hidden max-h-[90vh] ${sizeClasses[size]} ${className}`}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between px-5 py-3.5 border-b border-slate-100 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            {headerIcon && <div className="text-slate-700 shrink-0">{headerIcon}</div>}
            <div>
              <h3 id="modal-title" className="text-sm font-bold text-slate-900 leading-snug">
                {title}
              </h3>
              {description && (
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">{description}</p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors -mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>

        {/* Modal Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
