import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, helperText, error, options, children, id, disabled, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-medium text-slate-300 flex items-center justify-between"
          >
            <span>{label}</span>
          </label>
        )}
        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full appearance-none rounded-lg bg-[#0d1526] border text-slate-100 text-sm py-2 pl-3.5 pr-9 transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]',
              'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
              error
                ? 'border-rose-500/80 focus-visible:ring-rose-500 bg-rose-500/5'
                : 'border-white/[0.10] focus:border-sky-500/50 hover:border-white/[0.18]',
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="bg-[#0d1526] text-slate-100"
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="absolute right-3 text-slate-400 pointer-events-none flex items-center justify-center">
            <ChevronDown className="w-4 h-4" />
          </div>
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

Select.displayName = 'Select';
