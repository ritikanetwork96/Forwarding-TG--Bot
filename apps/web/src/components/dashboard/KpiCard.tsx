import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Badge, type BadgeProps } from '../ui/Badge';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
  iconColorClass?: string;
  iconBgClass?: string;
  badgeText?: string;
  badgeVariant?: BadgeProps['variant'];
  to?: string;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtext,
  icon,
  iconColorClass = 'text-sky-400',
  iconBgClass = 'bg-sky-500/10 border-sky-500/20',
  badgeText,
  badgeVariant = 'neutral',
  to,
  className,
}) => {
  const content = (
    <Card
      variant="interactive"
      className={cn(
        'p-4 sm:p-5 flex flex-col justify-between h-full group relative overflow-hidden bg-[#111420] hover:bg-[#161a29] border-white/[0.07] hover:border-violet-500/40 shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-200',
        'before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-violet-500/40 before:to-transparent',
        className
      )}
    >
      <div>
        {/* Top icon and label row */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                'w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-sm',
                iconBgClass,
                iconColorClass
              )}
            >
              {icon}
            </div>
            <span className="text-xs font-semibold text-slate-400 truncate tracking-wide">
              {title}
            </span>
          </div>

          {to && (
            <div className="text-slate-500 group-hover:text-violet-400 transition-colors p-1 shrink-0">
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          )}
        </div>

        {/* Metric Value */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight tabular-nums">
            {value}
          </span>
          {badgeText && (
            <Badge variant={badgeVariant} size="xs">
              {badgeText}
            </Badge>
          )}
        </div>
      </div>

      {/* Subtitle / Supporting Detail */}
      <p className="text-[11px] text-slate-400 mt-2.5 truncate font-normal leading-relaxed">
        {subtext}
      </p>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full focus-ring rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
};
