import React, { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  showCancelButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body and html scroll strictly while open
  useLockBodyScroll(isOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden animate-fade-in">
      {/* Frosted Apple Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-xl transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog with Apple Glass styling & iOS bottom-sheet feel on mobile */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full rounded-t-[28px] sm:rounded-3xl apple-glass shadow-2xl shadow-black/90',
          'flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden z-10 animate-scale-in',
          'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/[0.25] before:to-transparent',
          sizeStyles[size],
          className
        )}
      >
        {/* Apple Mobile Sheet Grab Handle */}
        <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        {(title || description) && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.08] flex items-center justify-between gap-3 shrink-0 bg-white/[0.02]">
            <div className="min-w-0 pr-2">
              {title && (
                <h3 className="text-sm sm:text-lg font-bold text-white tracking-tight font-display truncate">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                  {description}
                </p>
              )}
            </div>

            {/* Apple Circular Close Button + Cancel Label */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="apple-close-btn"
                aria-label="Close dialog"
                title="Close (Esc)"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* Content with internal scroll locking */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-5 overflow-y-auto flex-1 text-xs sm:text-sm text-slate-200 space-y-4 overscroll-contain">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-[#080d1a]/85 border-t border-white/[0.08] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 shrink-0 safe-area-bottom sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
