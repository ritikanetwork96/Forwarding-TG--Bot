import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-white/[0.10] bg-[#0d1526]/50',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#111c33] border border-white/[0.08] flex items-center justify-center text-slate-400 mb-4 shadow-sm">
        {icon}
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-slate-100 mb-1.5 tracking-tight">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
        {description}
      </p>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {secondaryAction && (
            <Button variant="outline" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
          {primaryAction && (
            <Button
              variant="primary"
              size="sm"
              onClick={primaryAction.onClick}
              leftIcon={primaryAction.icon}
            >
              {primaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
