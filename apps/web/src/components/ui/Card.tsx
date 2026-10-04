import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'interactive';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default:
        'bg-[#0e121e]/85 backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.14] shadow-xl shadow-black/40',
      elevated:
        'bg-[#121626]/90 backdrop-blur-2xl border border-white/[0.12] shadow-2xl shadow-black/60',
      glass:
        'apple-glass-card shadow-2xl',
      interactive:
        'bg-[#0e121e]/85 backdrop-blur-xl border border-white/[0.08] hover:border-sky-500/40 hover:bg-[#131828]/95 cursor-pointer shadow-xl transition-all duration-200 active:scale-[0.99]',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-2xl overflow-hidden relative transition-all duration-200', variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-5 py-4 border-b border-white/[0.06] flex flex-col space-y-1 bg-white/[0.01]', className)}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('font-bold text-white text-sm sm:text-base tracking-tight font-display leading-snug', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-xs text-slate-300 font-normal leading-relaxed', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-5', className)} {...props} />
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'px-5 py-3 bg-[#0a0c13] border-t border-white/[0.06] flex items-center justify-between gap-3',
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';
