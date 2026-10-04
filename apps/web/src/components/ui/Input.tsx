import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, leftIcon, rightIcon, id, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-slate-300 flex items-center justify-between"
          >
            <span>{label}</span>
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full rounded-lg bg-[#0d1526] border text-slate-100 text-sm placeholder:text-slate-500 py-2 transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              leftIcon ? 'pl-9.5' : 'pl-3.5',
              rightIcon ? 'pr-9.5' : 'pr-3.5',
              error
                ? 'border-rose-500/80 focus-visible:ring-rose-500 bg-rose-500/5'
                : 'border-white/[0.10] focus:border-sky-500/50 hover:border-white/[0.18]',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-slate-400 flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-rose-400 flex items-center gap-1 mt-0.5">
            <span>{error}</span>
          </p>
        )}
        {!error && helperText && <p className="text-xs text-slate-400 mt-0.5">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
