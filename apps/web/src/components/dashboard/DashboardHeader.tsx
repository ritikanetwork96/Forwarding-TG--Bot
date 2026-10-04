import React from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface DashboardHeaderProps {
  userName?: string;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  isFetching: boolean;
  onSync: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName = 'Admin',
  overallStatus,
  isFetching,
  onSync,
}) => {
  const statusConfig = {
    healthy: {
      label: 'Relay Engine Operational',
      variant: 'success' as const,
      icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />,
    },
    degraded: {
      label: 'Direct Relay Active',
      variant: 'brand' as const,
      icon: <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />,
    },
    critical: {
      label: 'Database Reconnecting',
      variant: 'warning' as const,
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
    },
  };

  const currentStatus = statusConfig[overallStatus] || statusConfig.healthy;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
            Mission Control{' '}
            <span className="text-xs font-mono font-normal text-violet-300 px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/25 ml-1">
              OPERATOR: {userName.toUpperCase()}
            </span>
          </h1>
          <Badge
            variant={currentStatus.variant}
            size="sm"
            dot
            className="hidden sm:inline-flex shadow-sm"
          >
            {currentStatus.label}
          </Badge>
        </div>
        <p className="text-xs text-slate-400 font-normal leading-relaxed">
          High-throughput Telegram Forwarding Engine &bull; Zero-Drop Autonomous Transmission
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Mobile status indicator */}
        <div className="sm:hidden">
          <Badge variant={currentStatus.variant} size="xs" dot>
            {currentStatus.label}
          </Badge>
        </div>

        {/* Sync telemetry button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onSync}
          disabled={isFetching}
          leftIcon={
            <RefreshCw
              className={`w-3.5 h-3.5 transition-transform ${isFetching ? 'animate-spin text-violet-400' : ''}`}
            />
          }
          title="Refresh dashboard telemetry from database and queues"
        >
          <span>{isFetching ? 'Syncing...' : 'Sync'}</span>
        </Button>

        {/* Secondary: Connect Channel CTA */}
        <Link to="/destinations">
          <Button variant="secondary" size="sm">
            <span>+ Connect Target</span>
          </Button>
        </Link>

        {/* Primary: New Forwarding Route CTA */}
        <Link to="/rules">
          <Button variant="primary" size="sm">
            <span>+ New Route</span>
          </Button>
        </Link>
      </div>
    </div>
  );
};
