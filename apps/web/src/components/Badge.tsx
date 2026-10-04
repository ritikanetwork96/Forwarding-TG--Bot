import React from 'react';
import { cn } from '../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'default' | 'info' | 'purple';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-[#131722] text-slate-300 border-white/[0.08]',
    neutral: 'bg-[#131722] text-slate-300 border-white/[0.08]',
    brand: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
    info: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    warning: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    error: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
    purple: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25',
  };

  const dotStyles = {
    default: 'bg-slate-400',
    neutral: 'bg-slate-400',
    brand: 'bg-sky-400',
    info: 'bg-sky-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    error: 'bg-rose-400',
    purple: 'bg-indigo-400',
  };

  const sizeStyles = {
    xs: 'text-[10px] px-1.5 py-0.5 rounded font-mono',
    sm: 'text-xs px-2 py-0.5 rounded-full font-medium',
    md: 'text-xs font-medium px-2.5 py-1 rounded-full',
    lg: 'text-sm font-medium px-3 py-1.5 rounded-full',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border select-none transition-colors duration-150',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotStyles[variant])} />}
      {children}
    </span>
  );
};
