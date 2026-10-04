import React from 'react';
import { cn } from '../../lib/utils';
import { Badge } from './Badge';
import { CheckCircle2, Clock, XCircle, FileEdit } from 'lucide-react';

export type StatusType =
  | 'published'
  | 'scheduled'
  | 'draft'
  | 'pending'
  | 'failed'
  | 'active'
  | 'paused'
  | 'disabled'
  | 'verified'
  | 'unverified'
  | 'connected'
  | 'disconnected'
  | 'processing';

export interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  showIcon?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  dot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  showIcon = false,
  size = 'sm',
  dot = true,
  className,
}) => {
  const normalized = (status || '').toLowerCase();

  let variant: 'success' | 'warning' | 'error' | 'brand' | 'neutral' = 'neutral';
  let defaultLabel = status;
  let IconComponent: React.ComponentType<{ className?: string }> | null = null;

  switch (normalized) {
    case 'published':
    case 'success':
    case 'active':
    case 'verified':
    case 'connected':
      variant = 'success';
      defaultLabel =
        normalized === 'active' ? 'Active' : normalized === 'verified' ? 'Verified' : 'Published';
      IconComponent = CheckCircle2;
      break;

    case 'scheduled':
    case 'pending':
    case 'paused':
    case 'warning':
    case 'degraded':
      variant = 'warning';
      defaultLabel =
        normalized === 'scheduled' ? 'Scheduled' : normalized === 'paused' ? 'Paused' : 'Pending';
      IconComponent = Clock;
      break;

    case 'failed':
    case 'error':
    case 'danger':
    case 'disconnected':
    case 'disabled':
      variant = 'error';
      defaultLabel = normalized === 'disabled' ? 'Disabled' : 'Failed';
      IconComponent = XCircle;
      break;

    case 'draft':
    case 'info':
    case 'processing':
    case 'inbound':
      variant = 'brand';
      defaultLabel = normalized === 'draft' ? 'Draft' : 'Processing';
      IconComponent = FileEdit;
      break;

    default:
      variant = 'neutral';
      defaultLabel = status;
      break;
  }

  const displayLabel = label || defaultLabel;

  return (
    <Badge
      variant={variant}
      size={size}
      dot={dot && !showIcon}
      className={cn('capitalize tracking-normal', className)}
    >
      {showIcon && IconComponent && <IconComponent className="w-3.5 h-3.5 shrink-0" />}
      <span>{displayLabel}</span>
    </Badge>
  );
};
