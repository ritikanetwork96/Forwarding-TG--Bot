import React from 'react';
import { cn } from '../../lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  statusBadge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon,
  statusBadge,
  actions,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-white/[0.08]',
        className
      )}
    >
      <div className="flex items-start gap-3.5 min-w-0">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#111c33] to-[#0d1526] border border-white/[0.10] flex items-center justify-center text-sky-400 shadow-sm shrink-0 mt-0.5">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight leading-tight">
              {title}
            </h1>
            {statusBadge && <div className="shrink-0">{statusBadge}</div>}
          </div>
          {description && (
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed max-w-3xl">
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-center">
          {actions}
        </div>
      )}
    </div>
  );
};
