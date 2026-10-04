import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'brand-outline';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold transition-all duration-150 select-none active:scale-[0.97] touch-manipulation disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090d] cursor-pointer';

    const variantStyles = {
      primary:
        'bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white font-semibold shadow-lg shadow-sky-500/25 border border-sky-300/25',
      secondary:
        'bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.16] text-white border border-white/[0.10] shadow-sm',
      outline:
        'bg-transparent hover:bg-white/[0.08] active:bg-white/[0.12] text-slate-200 hover:text-white border border-white/[0.15]',
      ghost: 'bg-transparent hover:bg-white/[0.06] active:bg-white/[0.10] text-slate-300 hover:text-white',
      danger:
        'bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/30 text-rose-200 border border-rose-500/30 shadow-sm',
      'brand-outline':
        'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm',
    };

    const sizeStyles = {
      xs: 'text-xs px-2.5 py-1 rounded-lg gap-1.5',
      sm: 'text-xs px-3 py-1.5 rounded-xl gap-1.5',
      md: 'text-xs sm:text-sm px-4 py-2 rounded-xl gap-2 font-medium',
      lg: 'text-sm sm:text-base px-5 py-2.5 rounded-2xl gap-2.5 font-semibold',
      icon: 'p-2 rounded-xl min-h-[36px] min-w-[36px]',
      'icon-sm': 'p-1.5 rounded-lg min-h-[30px] min-w-[30px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
