import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { ScheduleService } from '../services/schedule.service';
import { CategoryService } from '../services/category.service';
import { DestinationService } from '../services/destination.service';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { MediaViewer } from '../components/ui/MediaViewer';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import type { ScheduledPostDTO, ScheduledPostStatus } from '@telegram-forwarder/shared';

export const ScheduledPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduledPostDTO | null>(null);
  const [scheduleToCancel, setScheduleToCancel] = useState<string | null>(null);
  const [scheduleToPublishNow, setScheduleToPublishNow] = useState<string | null>(null);

  // Prevent background scrolling when schedule modal is open
  useLockBodyScroll(!!selectedSchedule);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => CategoryService.list(),
  });

  const { data: destinations = [] } = useQuery({
    queryKey: ['destinations'],
    queryFn: () => DestinationService.list(),
  });

  const categoryMap = new Map(categories.map((c) => [c._id, c]));
  const destinationMap = new Map(destinations.map((d) => [d._id, d]));

  const {
    data: schedulesData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['schedules', selectedStatus, selectedCategory, search],
    queryFn: () =>
      ScheduleService.list({
        status: selectedStatus === 'all' ? undefined : (selectedStatus as ScheduledPostStatus),
        categoryId: selectedCategory === 'all' ? undefined : selectedCategory,
        search: search || undefined,
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ['schedule-stats'],
    queryFn: () => ScheduleService.getStats(),
    refetchInterval: 15000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => ScheduleService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-stats'] });
      setActionSuccess('Scheduled broadcast cancelled successfully.');
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel schedule');
    },
  });

  const publishNowMutation = useMutation({
    mutationFn: (id: string) => ScheduleService.publishNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-stats'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setActionSuccess('Post published immediately.');
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Publish now failed');
    },
  });

  const handleCancel = (id: string) => {
    setActionError(null);
    setActionSuccess(null);
    setScheduleToCancel(id);
  };

  const handlePublishNow = (id: string) => {
    setActionError(null);
    setActionSuccess(null);
    setScheduleToPublishNow(id);
  };

  const schedules = schedulesData?.items || [];

  const getStatusBadge = (status: ScheduledPostStatus) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/25">
            <Clock className="w-3 h-3" />
            Scheduled
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-spin" />
            Processing
          </span>
        );
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <CheckCircle2 className="w-3 h-3" />
            Published
          </span>
        );
      case 'partially_published':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/25">
            <AlertCircle className="w-3 h-3" />
            Partial
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/25">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-400 border border-white/[0.08]">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5 font-display">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <span>Scheduled Posts</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Messages and broadcasts scheduled for future delivery.
          </p>
        </div>

        <Button
          onClick={() => refetch()}
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="w-3.5 h-3.5 text-sky-400" />}
        >
          Refresh Queue
        </Button>
      </div>

      {/* Stats Counter Ribbon */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="glass-card p-3.5 rounded-2xl">
            <div className="text-[10px] uppercase font-mono text-slate-400">Total</div>
            <div className="text-xl font-bold font-mono text-white mt-1">{stats.total}</div>
          </div>
          <div className="glass-card p-3.5 rounded-2xl">
            <div className="text-[10px] uppercase font-mono text-amber-400">Scheduled</div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">{stats.scheduled}</div>
          </div>
          <div className="glass-card p-3.5 rounded-2xl">
            <div className="text-[10px] uppercase font-mono text-sky-400">Due Today</div>
            <div className="text-xl font-bold font-mono text-sky-300 mt-1">{stats.dueToday}</div>
          </div>
          <div className="glass-card p-3.5 rounded-2xl">
            <div className="text-[10px] uppercase font-mono text-emerald-400">Published</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {stats.published}
            </div>
          </div>
          <div className="glass-card p-3.5 rounded-2xl">
            <div className="text-[10px] uppercase font-mono text-rose-400">Failed</div>
            <div className="text-xl font-bold font-mono text-rose-400 mt-1">{stats.failed}</div>
          </div>
          <div className="glass-card p-3.5 rounded-2xl">
            <div className="text-[10px] uppercase font-mono text-slate-500">Cancelled</div>
            <div className="text-xl font-bold font-mono text-slate-400 mt-1">{stats.cancelled}</div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {actionSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="glass-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl">
        <div className="flex items-center gap-2 flex-1 max-w-sm bg-[#131722]/80 px-3.5 py-1.5 rounded-xl border border-white/[0.08] text-xs">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search content or target..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#131722] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500/80 transition-colors font-mono"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="processing">Processing</option>
              <option value="published">Published</option>
              <option value="partially_published">Partially Published</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#131722] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500/80 transition-colors"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.iconEmoji || '📁'} {c.displayName || c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Container (Mobile Cards + Desktop Table) */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading scheduled posts...</div>
        ) : isError ? (
          <div className="p-8 text-center text-xs text-rose-400">
            Error: {error instanceof Error ? error.message : 'Unknown'}
          </div>
        ) : schedules.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No scheduled broadcasts found.
          </div>
        ) : (
          <>
            {/* Mobile View: Vertical Cards */}
            <div className="md:hidden divide-y divide-white/[0.06]">
              {schedules.map((item) => {
                const scheduledDate = new Date(item.scheduledFor);
                const textPreview =
                  item.message?.content?.text ||
                  (item.message?.content?.mediaItems?.length
                    ? `${item.message?.content?.mediaItems?.length} media item(s)`
                    : 'Post Payload');

                const catId = item.categoryId || item.message?.categoryId;
                const itemCat = catId ? categoryMap.get(catId) : null;

                return (
                  <div key={item._id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-200 font-medium">
                          <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span>
                            {scheduledDate.toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              timeZone: item.timezone,
                            })}{' '}
                            at{' '}
                            {scheduledDate.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: item.timezone,
                            })}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Timezone: {item.timezone}
                        </div>
                      </div>
                      <div className="shrink-0">{getStatusBadge(item.status)}</div>
                    </div>

                    <div className="text-slate-200 text-xs bg-black/20 p-2.5 rounded-xl border border-white/[0.04] line-clamp-3 leading-relaxed">
                      {textPreview}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {item.message?.content?.mediaItems && item.message.content.mediaItems.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 font-mono text-[10px] border border-sky-500/20">
                          <ImageIcon className="w-2.5 h-2.5" />
                          <span>{item.message.content.mediaItems.length} Media</span>
                        </span>
                      )}
                      {itemCat && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[10px] font-medium border border-sky-500/20">
                          {itemCat.iconEmoji || '📁'} {itemCat.displayName || itemCat.name}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-[#131722] text-slate-300 border border-white/[0.06] font-mono text-[10px]">
                        {item.destinationIds.length} target(s)
                      </span>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">
                        Mode: {item.publishMode}
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() => handlePublishNow(item._id)}
                              title="Publish Immediately"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20"
                            >
                              <Play className="w-3 h-3" />
                              <span>Fire</span>
                            </button>
                            <button
                              onClick={() => handleCancel(item._id)}
                              title="Cancel Schedule"
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Cancel</span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedSchedule(item)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-sky-400 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 font-medium"
                          title="View Full Post"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Full Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0a0c13]/60 text-slate-400 uppercase font-mono text-[10px] border-b border-white/[0.06]">
                  <tr>
                    <th className="px-4 py-3">Scheduled For</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Content Preview</th>
                    <th className="px-4 py-3">Targets</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] font-sans">
                  {schedules.map((item) => {
                    const scheduledDate = new Date(item.scheduledFor);
                    const textPreview =
                      item.message?.content?.text ||
                      (item.message?.content?.mediaItems?.length
                        ? `${item.message?.content?.mediaItems?.length} media item(s)`
                        : 'Post Payload');

                    const catId = item.categoryId || item.message?.categoryId;
                    const itemCat = catId ? categoryMap.get(catId) : null;

                    return (
                      <tr key={item._id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-medium text-slate-200">
                            {scheduledDate.toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              timeZone: item.timezone,
                            })}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                            <Clock className="w-3 h-3 text-sky-400" />
                            <span>
                              {scheduledDate.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: item.timezone,
                              })}
                            </span>
                            <span className="text-[10px] text-slate-500">({item.timezone})</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {getStatusBadge(item.status)}
                        </td>

                        <td className="px-4 py-3.5 max-w-xs">
                          <div className="text-slate-200 font-sans text-xs line-clamp-2 leading-relaxed">
                            {textPreview}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-500 font-mono">
                              ID: <code className="text-slate-400">{item.messageId.slice(-6)}</code>
                            </span>
                            {item.message?.content?.mediaItems && item.message.content.mediaItems.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 font-mono text-[10px] border border-sky-500/20">
                                <ImageIcon className="w-2.5 h-2.5" />
                                <span>{item.message.content.mediaItems.length} Media</span>
                              </span>
                            )}
                            {itemCat && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 text-[10px] font-medium border border-sky-500/20">
                                {itemCat.iconEmoji || '📁'} {itemCat.displayName || itemCat.name}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                            <span className="px-2 py-0.5 rounded bg-[#131722] text-slate-300 border border-white/[0.06] font-mono text-[11px]">
                              {item.destinationIds.length} target(s)
                            </span>
                            {item.destinationIds.slice(0, 2).map((did) => {
                              const dest = destinationMap.get(did);
                              return dest ? (
                                <span
                                  key={did}
                                  className="px-1.5 py-0.5 rounded bg-[#131722] text-slate-400 border border-white/[0.06] text-[10px] truncate max-w-[100px]"
                                >
                                  {dest.title}
                                </span>
                              ) : null;
                            })}
                            {item.destinationIds.length > 2 && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                +{item.destinationIds.length - 2} more
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap uppercase font-mono text-[11px]">
                          {item.publishMode}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.status === 'scheduled' && (
                              <>
                                <button
                                  onClick={() => handlePublishNow(item._id)}
                                  title="Publish Immediately"
                                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>Fire Now</span>
                                </button>
                                <button
                                  onClick={() => handleCancel(item._id)}
                                  title="Cancel Schedule"
                                  className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Cancel</span>
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setSelectedSchedule(item)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] text-sky-400 hover:text-white bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 transition-colors font-medium"
                              title="View Full Post & Attachments"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Post</span>
                            </button>
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

      {/* Details Modal (Mobile Bottom-Sheet on small devices) */}
      {selectedSchedule && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSchedule(null);
          }}
        >
          <div className="apple-glass rounded-t-[28px] sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[92vh] sm:max-h-[90vh] overflow-y-auto before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/[0.25] before:to-transparent pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
            {/* Apple Mobile Sheet Grab Handle */}
            <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 shrink-0">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2 font-display">
                <Clock className="w-4 h-4 text-sky-400" />
                <span>Schedule Details</span>
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedSchedule(null)}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSchedule(null)}
                  className="apple-close-btn"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span>{getStatusBadge(selectedSchedule.status)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Scheduled Time:</span>
                <span className="font-mono text-slate-200">
                  {new Date(selectedSchedule.scheduledFor).toLocaleString([], {
                    timeZone: selectedSchedule.timezone,
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Timezone:</span>
                <span className="font-mono text-sky-400">{selectedSchedule.timezone}</span>
              </div>
              {(() => {
                const catId = selectedSchedule.categoryId || selectedSchedule.message?.categoryId;
                const cat = catId ? categoryMap.get(catId) : null;
                return cat ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Category:</span>
                    <span className="text-sky-400 font-medium">
                      {cat.iconEmoji || '📁'} {cat.displayName || cat.name}
                    </span>
                  </div>
                ) : null;
              })()}
              <div className="flex justify-between">
                <span className="text-slate-500">Publish Mode:</span>
                <span className="font-mono uppercase">{selectedSchedule.publishMode}</span>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Destinations:</span>
                  <span className="font-mono text-slate-300">
                    {selectedSchedule.destinationIds.length} target(s)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-[#131722] border border-white/[0.06] max-h-24 overflow-y-auto">
                  {selectedSchedule.destinationIds.map((did) => {
                    const dest = destinationMap.get(did);
                    return (
                      <span
                        key={did}
                        className="px-2 py-0.5 rounded text-[11px] bg-[#0e1017] text-slate-300 border border-white/[0.08]"
                      >
                        {dest ? dest.title : did}
                      </span>
                    );
                  })}
                </div>
              </div>

              {selectedSchedule.failureReason && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <div className="font-semibold">Failure Reason:</div>
                  <div className="mt-0.5">{selectedSchedule.failureReason}</div>
                </div>
              )}

              {selectedSchedule.message && (
                <div className="p-3.5 rounded-xl bg-[#0a0d14] border border-white/[0.08] space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] uppercase font-mono text-slate-400">
                    <span>Full Broadcast Content</span>
                    <span className="text-slate-500">
                      {selectedSchedule.message.content?.text?.length || 0} chars
                    </span>
                  </div>
                  <div className="text-slate-200 whitespace-pre-wrap font-sans text-xs max-h-56 overflow-y-auto leading-relaxed select-text p-2 rounded-lg bg-[#141824]/50 border border-white/[0.04]">
                    {selectedSchedule.message.content?.text || 'No text content'}
                  </div>
                  {selectedSchedule.message.content?.mediaItems && selectedSchedule.message.content.mediaItems.length > 0 && (
                    <MediaViewer mediaItems={selectedSchedule.message.content.mediaItems} />
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
              {selectedSchedule.status === 'scheduled' && (
                <>
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={() => {
                      const id = selectedSchedule._id;
                      setSelectedSchedule(null);
                      handlePublishNow(id);
                    }}
                  >
                    Publish Now
                  </Button>
                  <Button
                    variant="danger"
                    size="xs"
                    onClick={() => {
                      const id = selectedSchedule._id;
                      setSelectedSchedule(null);
                      handleCancel(id);
                    }}
                  >
                    Cancel Schedule
                  </Button>
                </>
              )}
              <Button variant="ghost" size="xs" onClick={() => setSelectedSchedule(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={!!scheduleToCancel}
        onClose={() => setScheduleToCancel(null)}
        onConfirm={() => {
          if (scheduleToCancel) {
            cancelMutation.mutate(scheduleToCancel);
            setScheduleToCancel(null);
          }
        }}
        title="Cancel Scheduled Broadcast?"
        description="Are you sure you want to cancel this scheduled release? The delayed job in BullMQ will be removed."
        confirmText="Cancel Broadcast"
        variant="danger"
        isLoading={cancelMutation.isPending}
      />

      {/* Publish Now Confirmation Modal */}
      <ConfirmModal
        isOpen={!!scheduleToPublishNow}
        onClose={() => setScheduleToPublishNow(null)}
        onConfirm={() => {
          if (scheduleToPublishNow) {
            publishNowMutation.mutate(scheduleToPublishNow);
            setScheduleToPublishNow(null);
          }
        }}
        title="Publish Post Immediately?"
        description="This scheduled post will bypass its queue timer and publish to all target destinations right now."
        confirmText="Publish Now"
        variant="primary"
        isLoading={publishNowMutation.isPending}
      />
    </div>
  );
};
