import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { QueueService } from '../services/queue.service';
import { Layers, RefreshCw, Cpu, Database } from 'lucide-react';

export const QueueStatusCard: React.FC = () => {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['queueStatus'],
    queryFn: () => QueueService.getStatus(),
    refetchInterval: 5000, // Poll every 5s
  });

  const isRedisConnected = data?.redis?.status === 'connected';
  const isWorkerRunning = data?.worker?.status === 'running';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">
              BullMQ Publish Queue &amp; Worker
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Queue: <span className="text-slate-300">{data?.queue?.name || 'publish-queue'}</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh Queue Metrics"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin text-sky-400' : ''}`} />
          <span className="text-[11px]">Sync</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-6 flex flex-col items-center justify-center text-slate-400 text-xs">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-400 mb-1.5" />
          <span>Querying BullMQ engine...</span>
        </div>
      ) : isError ? (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <p className="font-medium">Could not reach Queue status API</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Services Health Badges */}
          <div className="grid grid-cols-2 gap-3">
            {/* Redis Status */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-rose-400" />
                <div>
                  <div className="text-[11px] font-medium text-slate-400">Redis</div>
                  <div className="text-xs font-bold text-white capitalize font-mono">
                    {data?.redis?.status || 'Unknown'}
                  </div>
                </div>
              </div>
              {isRedisConnected ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Disconnected
                </span>
              )}
            </div>

            {/* Worker Status */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-400" />
                <div>
                  <div className="text-[11px] font-medium text-slate-400">Publish Worker</div>
                  <div className="text-xs font-bold text-white font-mono">
                    Concurrency: {data?.worker?.concurrency || 5}
                  </div>
                </div>
              </div>
              {isWorkerRunning ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Running
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Stopped
                </span>
              )}
            </div>
          </div>

          {/* Job Counts Grid */}
          <div className="grid grid-cols-5 gap-2">
            <div className="p-2.5 bg-slate-950/40 border border-slate-800/80 rounded-lg text-center">
              <div className="text-[10px] text-slate-400 font-medium">Waiting</div>
              <div className="text-base font-bold text-sky-400 font-mono mt-0.5">
                {data?.queue?.counts?.waiting ?? 0}
              </div>
            </div>

            <div className="p-2.5 bg-slate-950/40 border border-slate-800/80 rounded-lg text-center">
              <div className="text-[10px] text-slate-400 font-medium">Active</div>
              <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
                {data?.queue?.counts?.active ?? 0}
              </div>
            </div>

            <div className="p-2.5 bg-slate-950/40 border border-slate-800/80 rounded-lg text-center">
              <div className="text-[10px] text-slate-400 font-medium">Completed</div>
              <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                {data?.queue?.counts?.completed ?? 0}
              </div>
            </div>

            <div className="p-2.5 bg-slate-950/40 border border-slate-800/80 rounded-lg text-center">
              <div className="text-[10px] text-slate-400 font-medium">Failed</div>
              <div className="text-base font-bold text-rose-400 font-mono mt-0.5">
                {data?.queue?.counts?.failed ?? 0}
              </div>
            </div>

            <div className="p-2.5 bg-slate-950/40 border border-slate-800/80 rounded-lg text-center">
              <div className="text-[10px] text-slate-400 font-medium">Delayed</div>
              <div className="text-base font-bold text-purple-400 font-mono mt-0.5">
                {data?.queue?.counts?.delayed ?? 0}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
