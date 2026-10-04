import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ScheduleService } from '../services/schedule.service';
import {
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export const ScheduleStatusCard: React.FC = () => {
  const {
    data: stats,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['scheduleStats'],
    queryFn: () => ScheduleService.getStats(),
    refetchInterval: 5000,
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Schedule Health &amp; Dispatch Status
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Engine:{' '}
              <span className="text-slate-300">BullMQ Delayed Jobs + Mongo Source of Truth</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh Schedule Metrics"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin text-amber-400' : ''}`} />
            <span className="text-[11px]">Sync</span>
          </button>
          <Link
            to="/scheduled"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors"
          >
            <span>Manage</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="py-6 flex flex-col items-center justify-center text-slate-400 text-xs">
          <RefreshCw className="w-5 h-5 animate-spin text-amber-400 mb-1.5" />
          <span>Loading schedule metrics...</span>
        </div>
      ) : isError ? (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <p className="font-medium">Could not reach Schedule status API</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-amber-400 font-medium mb-1">
              <span>🕒</span>
              <span>Scheduled</span>
            </div>
            <div className="text-xl font-bold text-white font-mono">{stats?.scheduled ?? 0}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Pending execution</div>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-sky-400 font-medium mb-1">
              <Zap className="w-3 h-3" />
              <span>Due Today</span>
            </div>
            <div className="text-xl font-bold text-white font-mono">{stats?.todayDue ?? 0}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Next 24h</div>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-blue-400 font-medium mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Processing</span>
            </div>
            <div className="text-xl font-bold text-white font-mono">{stats?.processing ?? 0}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Active locked</div>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-400 font-medium mb-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Published</span>
            </div>
            <div className="text-xl font-bold text-emerald-400 font-mono">
              {stats?.published ?? 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Fully delivered</div>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-rose-400 font-medium mb-1">
              <AlertTriangle className="w-3 h-3" />
              <span>Failed</span>
            </div>
            <div className="text-xl font-bold text-rose-400 font-mono">{stats?.failed ?? 0}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Requires retry</div>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 font-medium mb-1">
              <XCircle className="w-3 h-3" />
              <span>Cancelled</span>
            </div>
            <div className="text-xl font-bold text-slate-400 font-mono">
              {stats?.cancelled ?? 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">User revoked</div>
          </div>
        </div>
      )}
    </div>
  );
};
