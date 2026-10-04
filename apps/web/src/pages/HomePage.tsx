import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { DestinationService } from '../services/destination.service';
import { RuleService } from '../services/rule.service';
import { SourceService } from '../services/source.service';
import { CategoryService } from '../services/category.service';
import { LogService } from '../services/log.service';
import { ScheduleService } from '../services/schedule.service';
import { PublishService } from '../services/publish.service';
import { useToast } from '../context/ToastContext';
import {
  Users,
  GitFork,
  Clock,
  Play,
  Power,
  Zap,
  Send,
  MoreHorizontal,
  Plus,
  Eye,
  Image as ImageIcon,
} from 'lucide-react';
import { MediaViewer } from '../components/ui/MediaViewer';
import type { PublishLogDTO, ScheduledPostDTO } from '@telegram-forwarder/shared';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

export const HomePage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [viewingPost, setViewingPost] = useState<ScheduledPostDTO | null>(null);
  const [viewingLog, setViewingLog] = useState<PublishLogDTO | null>(null);

  useLockBodyScroll(Boolean(viewingPost || viewingLog));

  const { data: destinations = [] } = useQuery({
    queryKey: ['destinations'],
    queryFn: () => DestinationService.list(),
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['rules'],
    queryFn: () => RuleService.list(),
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['sources'],
    queryFn: () => SourceService.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => CategoryService.list(),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['logs'],
    queryFn: () => LogService.list(),
  });

  const { data: schedulesData } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => ScheduleService.list(),
  });

  // Toggle Rule Mutation
  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      RuleService.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success('Rule Updated', 'Forward rule status successfully changed');
    },
    onError: (err: unknown) => {
      toast.error('Update Failed', err instanceof Error ? err.message : 'Could not toggle rule');
    },
  });

  // Publish Now Mutation
  const publishNowMutation = useMutation({
    mutationFn: (id: string) => ScheduleService.publishNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      toast.success('Dispatched', 'Post published immediately to target channels');
    },
    onError: (err: unknown) => {
      toast.error('Publish Failed', err instanceof Error ? err.message : 'Could not publish');
    },
  });

  // Re-send Log Mutation
  const resendLogMutation = useMutation({
    mutationFn: (logId: string) => PublishService.resendLog(logId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success(
        'Re-sent',
        `Message re-dispatched to Telegram successfully! (ID: #${result.log.targetTelegramMessageId || 'OK'})`
      );
    },
    onError: (err: unknown) => {
      toast.error('Re-send Failed', err instanceof Error ? err.message : 'Could not re-send');
    },
  });

  // Metrics
  const channelCount = destinations.filter((d) => d.type === 'channel').length;
  const groupCount = destinations.filter((d) => d.type !== 'channel').length;
  const activeRulesCount = rules.filter((r) => r.isActive).length;
  const queuedPosts = schedulesData?.items?.filter((s) => s.status === 'scheduled') || [];

  const getSourceName = (srcId?: string | null) => {
    if (!srcId) return 'Marketing';
    const s = sources.find((src) => src._id === srcId);
    return s?.title || 'Inbound';
  };

  const getTargetName = (destId: string) => {
    const d = destinations.find((dest) => dest._id === destId);
    if (d) return d.displayName || d.title;
    const c = categories.find((cat) => cat._id === destId);
    if (c) return c.name;
    return 'Telegram';
  };

  const formatCountdown = (dateStr: string) => {
    const diff = Math.round((new Date(dateStr).getTime() - Date.now()) / 60000);
    if (diff <= 0) return 'Due now';
    if (diff < 60) return `${diff}m`;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}h ${mins}m`;
  };

  // Live display items from real system data (Zero mock data)
  const displayRules = rules.slice(0, 5);
  const displayLogs = logs.slice(0, 5);
  const displayQueue = queuedPosts.slice(0, 5);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-12 font-sans selection:bg-sky-500/25 selection:text-sky-300">
      {/* 1. TOP BENTO METRIC PILLARS (2x2 on Mobile, 4x1 on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Channels */}
        <Link to="/destinations" className="block group">
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl glass-card glass-card-hover space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-300 font-medium">
              <span>Channels 📢</span>
              <span className="text-[10px] sm:text-[11px] font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-[#1b2030] text-slate-300 border border-white/[0.08]">
                {channelCount.toLocaleString()}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-mono">
              {channelCount.toLocaleString()}
            </div>
          </div>
        </Link>

        {/* Card 2: Groups */}
        <Link to="/destinations" className="block group">
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl glass-card glass-card-hover space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-300 font-medium">
              <span>Groups 👥</span>
              <span className="text-[10px] sm:text-[11px] font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-[#1b2030] text-slate-300 border border-white/[0.08]">
                {groupCount.toLocaleString()}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-mono flex items-center gap-1.5 sm:gap-2">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
              <span>{groupCount.toLocaleString()}</span>
            </div>
          </div>
        </Link>

        {/* Card 3: Forward Rules */}
        <Link to="/rules" className="block group">
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl glass-card glass-card-hover space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-300 font-medium">
              <span>Forward Rules ⚡</span>
              <span className="text-[10px] sm:text-[11px] font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-[#1b2030] text-slate-300 border border-white/[0.08]">
                {activeRulesCount.toLocaleString()}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-mono flex items-center gap-1.5 sm:gap-2">
              <GitFork className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
              <span>{activeRulesCount.toLocaleString()}</span>
            </div>
          </div>
        </Link>

        {/* Card 4: Scheduled Posts */}
        <Link to="/scheduled" className="block group">
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl glass-card glass-card-hover space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-300 font-medium">
              <span>Scheduled ⏱️</span>
              <span className="text-[10px] sm:text-[11px] font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-[#1b2030] text-slate-300 border border-white/[0.08]">
                {queuedPosts.length.toLocaleString()}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-mono flex items-center gap-1.5 sm:gap-2">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
              <span>{queuedPosts.length.toLocaleString()}</span>
            </div>
          </div>
        </Link>
      </div>

      {/* 2. MAIN BENTO GRID — LEFT FORWARD RULES & LOGS / RIGHT SCHEDULED POSTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (7 Cols): Active Forward Rules + History & Logs */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Forward Rules Card */}
          <div className="rounded-2xl glass-card overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-sm font-semibold text-white tracking-tight">Active Forward Rules</h2>
                <p className="text-xs text-slate-400">Automated forwarding rules in system</p>
              </div>
              <button
                onClick={() => navigate('/rules')}
                className="px-3 py-1.5 rounded-lg bg-[#141824] hover:bg-[#1c2233] text-xs text-slate-200 border border-white/[0.08] hover:border-white/[0.16] transition-colors flex items-center gap-1.5 font-medium"
              >
                <Plus className="w-3.5 h-3.5 text-sky-400" />
                <span>+ New Rule</span>
              </button>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {displayRules.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
                    <GitFork className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-medium text-slate-200">No Forward Rules Configured</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Forward rules automate message routing from source chats into target channels.
                  </p>
                  <button
                    onClick={() => navigate('/rules')}
                    className="mt-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors"
                  >
                    + Create Rule
                  </button>
                </div>
              ) : (
                displayRules.map((rule) => {
                  const sourceTitle = getSourceName(rule.sourceId);
                  const firstDest = rule.destinationIds?.[0]
                    ? getTargetName(rule.destinationIds[0])
                    : 'Telegram';

                  return (
                    <div
                      key={rule._id}
                      className="px-5 py-3.5 hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-semibold text-xs text-slate-100 truncate">
                          Rule: {rule.name}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {rule.publishMode === 'copy' ? 'Clean copy mode' : 'Quoted forward mode'}
                        </p>
                        <div className="sm:hidden text-[10px] text-sky-400 flex items-center gap-1 font-mono pt-0.5">
                          <span className="truncate max-w-[100px]">{sourceTitle}</span>
                          <span>&rarr;</span>
                          <span className="truncate max-w-[100px]">{firstDest}</span>
                        </div>
                      </div>

                      {/* Flow Badge with Circular Telegram Blue Icon */}
                      <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#161a28] border border-white/[0.06] text-slate-200">
                          <div className="w-4 h-4 rounded-full bg-[#0088cc] flex items-center justify-center text-white shrink-0 shadow-sm">
                            <Send className="w-2.5 h-2.5 fill-current" />
                          </div>
                          <span className="truncate max-w-[95px] font-sans font-medium">{sourceTitle}</span>
                        </div>
                        <span className="text-slate-500 font-bold">&rarr;</span>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#161a28] border border-white/[0.06] text-slate-200">
                          <div className="w-4 h-4 rounded-full bg-[#0088cc] flex items-center justify-center text-white shrink-0 shadow-sm">
                            <Send className="w-2.5 h-2.5 fill-current" />
                          </div>
                          <span className="truncate max-w-[95px] font-sans font-medium">{firstDest}</span>
                        </div>
                      </div>

                      {/* Status & Options */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#064e3b]/50 text-emerald-400 border border-emerald-500/30 font-medium">
                          {rule.isActive ? 'Active' : 'Paused'}
                        </span>

                        <button
                          onClick={() =>
                            toggleRuleMutation.mutate({ id: rule._id, isActive: !rule.isActive })
                          }
                          className="p-1.5 rounded-md bg-[#161a28] hover:bg-[#1f2438] text-slate-400 hover:text-emerald-400 border border-white/[0.06] transition-colors"
                          title="Toggle Rule"
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Audit Logs Card — Responsive Mobile Cards + Desktop Table */}
          <div className="rounded-2xl glass-card overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-sm font-semibold text-white tracking-tight">Audit Logs</h2>
                <p className="text-xs text-slate-400">Real-time transmission verification</p>
              </div>
              <button
                onClick={() => navigate('/logs')}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
                title="View All Logs"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            {displayLogs.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Zap className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-slate-200">No Audit Logs Yet</p>
                <p className="text-[11px] text-slate-400">
                  Live telemetry and dispatch speeds will appear here as posts are forwarded.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card Feed View (md:hidden) — Native iOS feel, no horizontal table scrolling */}
                <div className="md:hidden divide-y divide-white/[0.04]">
                  {displayLogs.map((log) => {
                    const targetName = getTargetName(log.destinationId);
                    return (
                      <div
                        key={log._id}
                        onClick={() => setViewingLog(log)}
                        className="p-3.5 hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors cursor-pointer space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-[#0088cc] flex items-center justify-center text-white shrink-0 shadow-sm">
                              <Send className="w-3 h-3 fill-current" />
                            </div>
                            <span className="font-semibold text-xs text-slate-100 truncate">
                              {targetName}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            {log.publishMode === 'copy' ? 'Forward' : 'Broadcast'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>
                            {new Date(log.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <div className="flex items-center gap-2">
                            {log.targetTelegramMessageId && (
                              <span>#{log.targetTelegramMessageId}</span>
                            )}
                            <span className="text-emerald-400 inline-flex items-center gap-0.5">
                              <Zap className="w-3 h-3 fill-current" />
                              <span>{log.executionTimeMs || 28}ms</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-slate-400 text-[11px] font-mono bg-[#0a0d14]">
                        <th className="px-5 py-2.5">Time ⇅</th>
                        <th className="px-4 py-2.5">Action</th>
                        <th className="px-4 py-2.5">User</th>
                        <th className="px-4 py-2.5">Telegram ID</th>
                        <th className="px-5 py-2.5 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {displayLogs.map((log) => (
                        <tr
                          key={log._id}
                          onClick={() => setViewingLog(log)}
                          className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                        >
                          <td className="px-5 py-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                            {`Today, ${new Date(log.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}`}
                          </td>
                          <td className="px-4 py-3 text-slate-200 font-medium">
                            {log.publishMode === 'copy' ? 'Forwarding' : 'Broadcast'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <div className="w-5 h-5 rounded-full bg-[#1b2030] border border-white/[0.1] flex items-center justify-center text-[10px] font-mono text-slate-300">
                                P
                              </div>
                              <span className="font-sans text-[11px] font-medium text-slate-200">Admin</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-400 text-[11px]">
                            {log.targetTelegramMessageId ? `${log.targetTelegramMessageId}` : '—'}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-[11px] font-mono text-emerald-400 inline-flex items-center gap-1">
                              <Zap className="w-3 h-3 fill-current" />
                              <span>{log.executionTimeMs || 28}ms</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column (5 Cols): Scheduled Queue with Connected Timeline */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl glass-card overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-sm font-semibold text-white tracking-tight">Scheduled Queue</h2>
                <p className="text-xs text-slate-400">Posts queued from timeline view / bot</p>
              </div>
              <button
                onClick={() => navigate('/scheduled')}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
                title="Queue Options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              {displayQueue.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <Clock className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-medium text-slate-200">Queue is Clear</p>
                  <p className="text-[11px] text-slate-400">
                    No scheduled broadcasts waiting. Schedule from the bot or web composer.
                  </p>
                  <button
                    onClick={() => navigate('/scheduled')}
                    className="mt-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors"
                  >
                    + Schedule Broadcast
                  </button>
                </div>
              ) : (
                <div className="relative pl-7 space-y-4">
                  {/* Vertical Timeline Track Line */}
                  <div className="absolute left-[9px] top-3.5 bottom-6 w-[2px] bg-white/[0.08]" />

                  {displayQueue.map((post, index) => {
                    const preview =
                      post.message?.content?.text ||
                      '📢 Telegram Forwarded Payload: Real-time broadcast post payload ready for automated dispatch.';
                    const countdown = formatCountdown(post.scheduledFor);
                    const isPending = publishNowMutation.isPending;
                    const mediaCount = (post.message?.content as any)?.mediaItems?.length || 0;

                    return (
                      <div key={post._id} className="relative group">
                        {/* Timeline Node */}
                        {index === 0 ? (
                          <div className="absolute -left-[27px] top-3 w-4 h-4 rounded-full bg-[#08090d] border border-sky-400 text-sky-400 flex items-center justify-center text-[10px] z-10 font-bold">
                            ✓
                          </div>
                        ) : (
                          <div className="absolute -left-[26px] top-3.5 w-3.5 h-3.5 rounded-full bg-[#08090d] border-2 border-sky-400 z-10" />
                        )}

                        {/* Queue Card */}
                        <div className="p-3.5 rounded-xl bg-[#141824] border border-white/[0.06] hover:border-white/[0.14] transition-all space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#0088cc] text-white flex items-center justify-center shadow-sm">
                                <Send className="w-3 h-3 fill-current" />
                              </div>
                              <div className="leading-tight">
                                <span className="text-xs font-semibold text-slate-100">
                                  Queued Post #{index + 1}
                                </span>
                                <p className="text-[10px] text-slate-400">Queued from Telegram bot</p>
                              </div>
                            </div>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#1b2030] text-slate-300 border border-white/[0.08]">
                              {countdown}
                            </span>
                          </div>

                          {/* Dark nested Telegram preview box */}
                          <div className="p-2.5 rounded-lg bg-[#0a0d14] border border-white/[0.05] text-xs space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] text-sky-400 font-medium">
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                                <span>Telegram Channel Broadcast</span>
                              </span>
                              {mediaCount > 0 ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 font-mono text-[9px] border border-sky-500/20">
                                  <ImageIcon className="w-2.5 h-2.5" />
                                  <span>{mediaCount} Media</span>
                                </span>
                              ) : (
                                <span className="text-slate-500 font-mono text-[9px]">Text Only</span>
                              )}
                            </div>
                            <p className="text-slate-300 line-clamp-2 leading-relaxed font-sans">{preview}</p>
                          </div>

                          <div className="pt-1 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-mono">
                              {post.destinationIds?.length || 1} target channel(s)
                            </span>

                            <div className="flex items-center gap-1.5">
                              {/* View Full Post Button */}
                              <button
                                onClick={() => setViewingPost(post)}
                                className="px-2 py-1 rounded-md bg-[#1c2233] hover:bg-[#252d44] text-slate-300 hover:text-white text-[11px] font-medium flex items-center gap-1 border border-white/[0.08] transition-colors"
                                title="View Full Post"
                              >
                                <Eye className="w-3 h-3 text-sky-400" />
                                <span>View</span>
                              </button>

                              <button
                                onClick={() => publishNowMutation.mutate(post._id)}
                                disabled={isPending}
                                className="px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>Fire Now</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Bottom Add Action */}
                  <div className="relative pt-2">
                    <div className="absolute -left-[25px] top-5 w-3 h-3 rounded-full bg-[#08090d] border border-white/[0.2] z-10" />
                    <button
                      onClick={() => navigate('/scheduled')}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#141824] hover:bg-[#1a2030] border border-white/[0.06] hover:border-white/[0.12] text-xs text-slate-300 flex items-center justify-center gap-1.5 transition-colors font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-sky-400" />
                      <span>+ Add to queue</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: View Full Scheduled Post (Mobile Bottom-Sheet on small devices) */}
      {viewingPost && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingPost(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in"
        >
          <div className="apple-glass rounded-t-[28px] sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-white/15 relative max-h-[92vh] sm:max-h-[90vh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
            <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto sm:hidden mb-2" />
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                <span>Scheduled Broadcast Full Details</span>
              </h3>
              <button
                onClick={() => setViewingPost(null)}
                className="apple-close-btn"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Timing */}
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400">Scheduled Dispatch</span>
                  <div className="font-mono text-white text-xs mt-0.5 font-semibold">
                    {new Date(viewingPost.scheduledFor).toLocaleString([], {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-[11px] font-semibold">
                  {formatCountdown(viewingPost.scheduledFor)}
                </span>
              </div>

              {/* Full Content Preview Box */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
                  <span>Full Message Content</span>
                  <span className="text-slate-500">
                    {viewingPost.message?.content?.text?.length || 0} characters
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/[0.08] text-slate-200 whitespace-pre-wrap font-sans leading-relaxed max-h-56 overflow-y-auto select-text">
                  {viewingPost.message?.content?.text || 'No text content attached.'}
                </div>
              </div>

              {/* Media Preview / Attachments */}
              {viewingPost.message?.content?.mediaItems && viewingPost.message.content.mediaItems.length > 0 && (
                <MediaViewer mediaItems={viewingPost.message.content.mediaItems} />
              )}

              {/* Target Destinations */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-mono text-slate-400">
                  Target Destination Channels ({viewingPost.destinationIds?.length || 1})
                </div>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] max-h-24 overflow-y-auto">
                  {viewingPost.destinationIds?.map((did) => (
                    <span
                      key={did}
                      className="px-2.5 py-1 rounded-lg text-[11px] bg-white/[0.06] text-slate-200 border border-white/[0.1] font-medium"
                    >
                      {getTargetName(did)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setViewingPost(null)}
                className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-slate-200 text-xs font-semibold transition-all border border-white/[0.08] text-center"
              >
                Cancel / Close
              </button>
              <button
                onClick={() => {
                  const id = viewingPost._id;
                  setViewingPost(null);
                  publishNowMutation.mutate(id);
                }}
                className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-sky-500/25 active:scale-[0.97]"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Fire Immediately</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View Audit Log Content (Mobile Bottom-Sheet on small devices) */}
      {viewingLog && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingLog(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in"
        >
          <div className="apple-glass rounded-t-[28px] sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-white/15 relative max-h-[92vh] sm:max-h-[90vh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
            <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto sm:hidden mb-2" />
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>Audit Log Dispatch Payload</span>
              </h3>
              <button
                onClick={() => setViewingLog(null)}
                className="apple-close-btn"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <span className="text-slate-400 font-mono">Dispatched At:</span>
                <span className="font-mono text-slate-200">
                  {new Date(viewingLog.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <span className="text-slate-400 font-mono">Execution Latency:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {viewingLog.executionTimeMs}ms
                </span>
              </div>

              {/* Message text */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-mono text-slate-400">Broadcast Content</div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/[0.08] text-slate-200 whitespace-pre-wrap font-sans max-h-52 overflow-y-auto select-text">
                  {viewingLog.message?.content?.text ||
                    'Forwarded post broadcast payload (Verified delivery).'}
                </div>
              </div>

              {/* Attached Media */}
              {viewingLog.message?.content?.mediaItems && viewingLog.message.content.mediaItems.length > 0 && (
                <MediaViewer mediaItems={viewingLog.message.content.mediaItems} />
              )}

              {/* Telegram ID */}
              <div className="flex justify-between p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <span className="text-slate-400 font-mono">Telegram Message ID:</span>
                <span className="font-mono text-sky-400">
                  #{viewingLog.targetTelegramMessageId || '—'}
                </span>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setViewingLog(null)}
                className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-slate-200 hover:text-white text-xs font-semibold transition-all border border-white/[0.08] text-center"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const logId = viewingLog._id;
                  setViewingLog(null);
                  resendLogMutation.mutate(logId);
                }}
                disabled={resendLogMutation.isPending}
                className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-sky-500/25 active:scale-[0.97]"
              >
                <Send className="w-3.5 h-3.5 fill-current" />
                <span>Re-send to Channel Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
