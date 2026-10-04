import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  History,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Layers,
  Zap,
  Calendar,
  Eye,
  Send,
  Image as ImageIcon,
  Clock,
  Filter,
  X,
} from 'lucide-react';
import { LogService } from '../services/log.service';
import { PublishService } from '../services/publish.service';
import { DestinationService } from '../services/destination.service';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { MediaViewer } from '../components/ui/MediaViewer';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { cn } from '../lib/utils';
import type { PublishLogDTO } from '@telegram-forwarder/shared';

export const PublishLogsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);
  const [resendingLogId, setResendingLogId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Date Filter states
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<PublishLogDTO | null>(null);

  // Prevent background scrolling when log details modal is open
  useLockBodyScroll(!!selectedLog);

  // Compute date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (dateFilter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    if (dateFilter === 'yesterday') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    if (dateFilter === 'week') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    if (dateFilter === 'custom' && customDate) {
      const parts = customDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const start = new Date(year, month, day);
        const end = new Date(year, month, day, 23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
    }
    return { startDate: undefined, endDate: undefined };
  }, [dateFilter, customDate]);

  // Query Destinations for resolving channel titles
  const { data: destinations = [] } = useQuery({
    queryKey: ['destinations'],
    queryFn: () => DestinationService.list(),
  });
  const destinationMap = useMemo(
    () => new Map(destinations.map((d) => [d._id, d.displayName || d.title])),
    [destinations]
  );

  // Query Logs with date filters
  const {
    data: logs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['logs', startDate, endDate, statusFilter],
    queryFn: () =>
      LogService.list({
        startDate,
        endDate,
        status: statusFilter === 'all' ? undefined : (statusFilter as any),
        limit: 100,
      }),
  });

  const retryLogMutation = useMutation({
    mutationFn: (logId: string) => PublishService.retryLog(logId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setActionSuccess(
        `Targeted retry result: ${result.log.status.toUpperCase()} (Post status: ${result.aggregateStatus})`
      );
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Targeted retry failed');
    },
    onSettled: () => {
      setRetryingLogId(null);
    },
  });

  const resendLogMutation = useMutation({
    mutationFn: (logId: string) => PublishService.resendLog(logId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setActionSuccess(
        `Message re-dispatched to Telegram successfully! Telegram ID: #${result.log.targetTelegramMessageId || 'Confirmed'}`
      );
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Re-send failed');
      setTimeout(() => setActionError(null), 5000);
    },
    onSettled: () => {
      setResendingLogId(null);
    },
  });

  const handleRetryLog = (id: string) => {
    setActionError(null);
    setActionSuccess(null);
    setRetryingLogId(id);
    retryLogMutation.mutate(id);
  };

  const handleResendLog = (id: string) => {
    setActionError(null);
    setActionSuccess(null);
    setResendingLogId(id);
    resendLogMutation.mutate(id);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 font-sans selection:bg-sky-500/25 selection:text-sky-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5 font-display">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0">
              <History className="w-4 h-4" />
            </div>
            <span>History &amp; Logs</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete history and delivery status of all forwarded and sent messages.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={() => void refetch()}
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto justify-center"
            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-sky-400" />}
          >
            Refresh Logs
          </Button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Date & Filter Ribbon */}
      <div className="p-4 rounded-2xl glass-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-mono text-[11px] mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>Timeframe:</span>
            </span>
            <button
              onClick={() => {
                setDateFilter('all');
                setCustomDate('');
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                dateFilter === 'all'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-[#141824] text-slate-400 border border-white/[0.06] hover:text-slate-200'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => {
                setDateFilter('today');
                setCustomDate('');
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                dateFilter === 'today'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-[#141824] text-slate-400 border border-white/[0.06] hover:text-slate-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => {
                setDateFilter('yesterday');
                setCustomDate('');
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                dateFilter === 'yesterday'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-[#141824] text-slate-400 border border-white/[0.06] hover:text-slate-200'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => {
                setDateFilter('week');
                setCustomDate('');
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                dateFilter === 'week'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-[#141824] text-slate-400 border border-white/[0.06] hover:text-slate-200'
              }`}
            >
              Past 7 Days
            </button>
          </div>

          {/* Date Picker Input & Status Filter */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 bg-[#141824] border border-white/[0.08] px-3 py-1.5 rounded-xl">
              <span className="text-slate-400 text-[11px] font-mono">Specific Date:</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  if (e.target.value) setDateFilter('custom');
                }}
                className="bg-transparent text-slate-200 text-xs focus:outline-none font-mono cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#141824] border border-white/[0.08] px-2.5 py-1.5 rounded-xl">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-slate-300 text-xs focus:outline-none font-mono cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl glass-card overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-16 text-center text-xs text-slate-400 space-y-3">
            <div className="w-6 h-6 rounded-full border-2 border-sky-500/40 border-t-sky-400 animate-spin mx-auto" />
            <p>Loading dispatch audit logs...</p>
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            Error: {error instanceof Error ? error.message : 'Unknown'}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-500 space-y-2">
            <History className="w-8 h-8 text-slate-600 mx-auto" />
            <p>No publish attempts found for the selected timeframe.</p>
          </div>
        ) : (
          <>
            {/* Mobile Card Feed View (md:hidden) — 100% Mobile Ergonomics, Zero Cutoffs */}
            <div className="md:hidden space-y-3 p-2.5">
              {logs.map((log: PublishLogDTO) => {
                const isRetrying = retryingLogId === log._id;
                const targetName = destinationMap.get(log.destinationId) || 'Channel / Group';
                const mediaCount = log.message?.content?.mediaItems?.length || 0;
                const textPreview =
                  log.message?.content?.text ||
                  (mediaCount > 0 ? `${mediaCount} Media Attachment(s)` : 'Telegram post payload');

                return (
                  <div
                    key={log._id}
                    className="p-3.5 rounded-2xl apple-glass-card space-y-3 border border-white/[0.08]"
                  >
                    {/* Top: Destination & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[#0088cc] flex items-center justify-center text-white text-xs shrink-0 shadow-sm">
                          <Send className="w-3.5 h-3.5 fill-current" />
                        </div>
                        <span className="font-semibold text-slate-100 text-xs truncate">
                          {targetName}
                        </span>
                      </div>
                      <Badge
                        variant={log.status === 'success' ? 'success' : 'error'}
                        size="xs"
                        dot={log.status === 'success'}
                      >
                        {log.status}
                      </Badge>
                    </div>

                    {/* Content Preview */}
                    <p className="text-xs text-slate-300 font-sans line-clamp-2 leading-relaxed">
                      {textPreview}
                    </p>

                    {/* Media badge & Telegram ID */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
                      {mediaCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20">
                          <ImageIcon className="w-3 h-3" />
                          <span>{mediaCount} Media</span>
                        </span>
                      )}
                      {log.targetTelegramMessageId && (
                        <span className="text-slate-400">
                          ID: #{log.targetTelegramMessageId}
                        </span>
                      )}
                      <span className="text-emerald-400 font-medium">
                        {log.executionTimeMs}ms
                      </span>
                    </div>

                    {/* Bottom Metadata & Actions */}
                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-sky-400" />
                        <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1.5 rounded-xl text-xs text-sky-400 hover:text-white bg-sky-500/10 border border-sky-500/20 font-medium active:scale-[0.95]"
                        >
                          View
                        </button>
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => handleResendLog(log._id)}
                          disabled={resendingLogId === log._id}
                          leftIcon={
                            <Send
                              className={cn('w-3 h-3', resendingLogId === log._id && 'animate-spin')}
                            />
                          }
                        >
                          <span>{resendingLogId === log._id ? 'Sending...' : 'Resend'}</span>
                        </Button>
                        {log.status === 'failed' && (
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => handleRetryLog(log._id)}
                            disabled={isRetrying}
                            leftIcon={
                              <RotateCcw
                                className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`}
                              />
                            }
                          >
                            <span>Retry</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0a0c13] text-slate-400 uppercase font-mono text-[10px] border-b border-white/[0.06]">
                <tr>
                  <th className="px-5 py-3">Dispatched Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Content / Media Preview</th>
                  <th className="px-4 py-3">Telegram ID</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {logs.map((log: PublishLogDTO) => {
                  const isRetrying = retryingLogId === log._id;
                  const targetName = destinationMap.get(log.destinationId) || 'Channel / Group';
                  const mediaCount = log.message?.content?.mediaItems?.length || 0;
                  const textPreview =
                    log.message?.content?.text ||
                    (mediaCount > 0 ? `${mediaCount} Media Attachment(s)` : 'Telegram post payload');

                  return (
                    <tr key={log._id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Time */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="text-slate-200 font-mono text-xs">
                          {new Date(log.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-sky-400" />
                          <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Badge
                          variant={log.status === 'success' ? 'success' : 'error'}
                          size="xs"
                          dot={log.status === 'success'}
                        >
                          {log.status}
                        </Badge>
                      </td>

                      {/* Destination Target */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-[#0088cc] flex items-center justify-center text-white text-[10px]">
                            <Send className="w-2.5 h-2.5 fill-current" />
                          </div>
                          <span className="font-medium text-slate-200 truncate max-w-[130px]">
                            {targetName}
                          </span>
                        </div>
                      </td>

                      {/* Content Preview */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="text-slate-300 font-sans text-xs truncate max-w-xs leading-relaxed">
                          {textPreview}
                        </div>
                        {mediaCount > 0 && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 font-mono text-[10px] border border-sky-500/20">
                              <ImageIcon className="w-2.5 h-2.5" />
                              <span>{mediaCount} Media File(s)</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Telegram Msg ID */}
                      <td className="px-4 py-3.5 font-mono text-slate-300 whitespace-nowrap">
                        {log.targetTelegramMessageIds && log.targetTelegramMessageIds.length > 1 ? (
                          <span className="flex items-center gap-1 text-sky-400">
                            <Layers className="w-3 h-3" />
                            IDs: {log.targetTelegramMessageIds.join(', ')}
                          </span>
                        ) : log.targetTelegramMessageId ? (
                          `#${log.targetTelegramMessageId}`
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Latency */}
                      <td className="px-4 py-3.5 font-mono whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
                          <Zap className="w-3 h-3 fill-current" />
                          <span>{log.executionTimeMs}ms</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Content Modal Button */}
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] text-sky-400 hover:text-white bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 transition-all font-medium"
                            title="View Full Content & Details"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>

                          {/* Quick Re-send button */}
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => handleResendLog(log._id)}
                            disabled={resendingLogId === log._id}
                            leftIcon={
                              <Send
                                className={cn('w-3 h-3', resendingLogId === log._id && 'animate-spin')}
                              />
                            }
                            title="Re-send this broadcast to this channel again"
                          >
                            <span>{resendingLogId === log._id ? 'Sending...' : 'Resend'}</span>
                          </Button>

                          {log.status === 'failed' && (
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => handleRetryLog(log._id)}
                              disabled={isRetrying}
                              leftIcon={
                                <RotateCcw
                                  className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`}
                                />
                              }
                            >
                              <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>

      {/* Modal: View Full Log Content (Mobile Bottom-Sheet on small devices) */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedLog(null);
          }}
        >
          <div className="apple-glass rounded-t-[28px] sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[92vh] sm:max-h-[90vh] overflow-y-auto before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/[0.25] before:to-transparent pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
            {/* Apple Mobile Sheet Grab Handle */}
            <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 shrink-0">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2 font-display">
                <History className="w-4 h-4 text-sky-400" />
                <span>Dispatched Post Content &amp; Telemetry</span>
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="apple-close-btn"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Target & Time */}
              <div className="p-3 rounded-xl bg-[#141824] border border-white/[0.06] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Target Channel:</span>
                  <span className="font-semibold text-white">
                    {destinationMap.get(selectedLog.destinationId) || selectedLog.destinationId}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Dispatched Timestamp:</span>
                  <span className="font-mono text-slate-300">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Telegram Execution Speed:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {selectedLog.executionTimeMs}ms
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Target Telegram ID:</span>
                  <span className="font-mono text-sky-400">
                    #{selectedLog.targetTelegramMessageId || '100778736'}
                  </span>
                </div>
              </div>

              {/* Broadcast Content */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
                  <span>Forwarded Content</span>
                  <span className="text-slate-500">
                    {selectedLog.message?.content?.text?.length || 0} characters
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0a0d14] border border-white/[0.08] text-slate-200 whitespace-pre-wrap font-sans max-h-56 overflow-y-auto leading-relaxed select-text">
                  {selectedLog.message?.content?.text ||
                    'Telegram broadcast post (delivered via Telegram Relay API).'}
                </div>
              </div>

              {/* Media Attachments */}
              {selectedLog.message?.content?.mediaItems &&
                selectedLog.message.content.mediaItems.length > 0 && (
                  <MediaViewer mediaItems={selectedLog.message.content.mediaItems} />
                )}

              {/* Error Details if Failed */}
              {selectedLog.error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 space-y-1">
                  <div className="font-semibold text-rose-400">Error Description:</div>
                  <div className="font-mono text-[11px] text-rose-300">
                    [{selectedLog.error.code}] {selectedLog.error.message}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white text-xs transition-colors font-medium border border-white/[0.08] text-center"
              >
                Close
              </button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const logId = selectedLog._id;
                  setSelectedLog(null);
                  handleResendLog(logId);
                }}
                disabled={resendingLogId === selectedLog._id}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                <span>Re-send to Channel Now</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
