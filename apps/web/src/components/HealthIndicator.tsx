import React from 'react';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { Badge } from './Badge';
import { Activity, RefreshCw, CheckCircle2, XCircle, Clock, Server, Database } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

export const HealthIndicator: React.FC = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useHealthCheck();

  const formatUptime = (seconds?: number): string => {
    if (!seconds && seconds !== 0) return 'N/A';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
  };

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-2xl relative overflow-hidden">
      {/* Decorative gradient glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-500/10 rounded-xl border border-sky-500/20 text-sky-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              API Connectivity Status
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Target: <span className="text-slate-300">{API_BASE_URL}/health</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isLoading ? (
            <Badge variant="warning">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Connecting...
            </Badge>
          ) : isError ? (
            <Badge variant="error">
              <XCircle className="w-3.5 h-3.5" />
              API Disconnected
            </Badge>
          ) : (
            <Badge variant="success">
              <CheckCircle2 className="w-3.5 h-3.5" />
              API Online ({data?.status})
            </Badge>
          )}

          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh Health Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-sky-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-sky-400 mb-2" />
            <p className="text-sm">Querying backend health endpoint...</p>
          </div>
        ) : isError ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
            <p className="font-medium">Failed to reach the API server:</p>
            <p className="text-xs text-rose-400 mt-1 font-mono">
              {error?.message || 'Network error'}
            </p>
            <p className="text-xs text-slate-400 mt-3">
              Ensure the backend is running via{' '}
              <code className="bg-slate-900 px-1.5 py-0.5 rounded text-sky-300">
                npm run dev:api
              </code>
              .
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                <Server className="w-3.5 h-3.5 text-sky-400" />
                Service Name
              </div>
              <p className="text-sm font-semibold text-white font-mono">{data?.service}</p>
              <span className="text-[11px] text-slate-500">Env: {data?.environment}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Uptime
              </div>
              <p className="text-sm font-semibold text-white font-mono">
                {formatUptime(data?.uptime)}
              </p>
              <span className="text-[11px] text-slate-500">Node runtime</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                Database Driver
              </div>
              <p className="text-sm font-semibold text-white font-mono capitalize">
                {data?.database?.status || 'Ready'}
              </p>
              <span className="text-[11px] text-slate-500">Mongoose Architecture</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                Last Checked
              </div>
              <p
                className="text-xs font-medium text-slate-300 font-mono truncate"
                title={data?.timestamp}
              >
                {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'N/A'}
              </p>
              <span className="text-[11px] text-slate-500">Auto-polling (15s)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
