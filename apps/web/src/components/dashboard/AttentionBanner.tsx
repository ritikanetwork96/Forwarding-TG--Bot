import React from 'react';
import { Link } from 'react-router-dom';
import type { DashboardStatsDTO } from '@telegram-forwarder/shared';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface AttentionBannerProps {
  attention: DashboardStatsDTO['attention'];
}

export const AttentionBanner: React.FC<AttentionBannerProps> = ({ attention }) => {
  if (!attention.hasFailures || attention.failedItems.length === 0) {
    return null;
  }

  const latestFailure = attention.failedItems[0];

  return (
    <div className="relative overflow-hidden rounded-xl border border-rose-500/30 bg-gradient-to-r from-rose-950/40 via-rose-900/15 to-[#0d1526] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in shadow-xl shadow-rose-950/20 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-rose-500/50 before:via-rose-400/20 before:to-transparent">
      <div className="flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-rose-100 tracking-tight">
              Attention Required: {attention.failureCount} Delivery{' '}
              {attention.failureCount === 1 ? 'Failure' : 'Failures'} in 24h
            </h3>
            <Badge variant="error" size="xs">
              Action Needed
            </Badge>
          </div>
          <p className="text-xs text-rose-300/80 mt-1 leading-relaxed">
            Latest failure in{' '}
            <span className="font-semibold text-rose-200">{latestFailure.destinationName}</span>:{' '}
            {latestFailure.error}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:self-center shrink-0">
        <Link to="/logs">
          <Button variant="danger" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
            <span>Review Failed Logs</span>
          </Button>
        </Link>
      </div>
    </div>
  );
};
