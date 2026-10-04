import React from 'react';
import { Link } from 'react-router-dom';
import type { DashboardStatsDTO } from '@telegram-forwarder/shared';
import { History, ArrowRight, CheckCircle2, AlertCircle, Radio } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

export interface RecentActivityFeedProps {
  activities: DashboardStatsDTO['recentActivity'];
}

function getRelativeTimestamp(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({ activities }) => {
  return (
    <Card
      variant="default"
      className="flex flex-col h-full bg-[#111420] border-white/[0.07] shadow-xl shadow-black/40 rounded-xl relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-violet-500/40 before:to-transparent"
    >
      <CardHeader className="flex flex-row items-center justify-between pb-3.5 border-b border-white/[0.06] px-5 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/25 flex items-center justify-center shrink-0 shadow-sm">
            <History className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <CardTitle className="text-sm font-semibold text-white tracking-tight">
            Recent Publishing Activity
          </CardTitle>
        </div>
        <Link
          to="/logs"
          className="text-xs text-violet-400 hover:text-violet-300 font-medium inline-flex items-center gap-1 transition-colors"
        >
          <span>View all logs</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="p-0 flex-1">
        {activities.length === 0 ? (
          <EmptyState
            icon={<Radio className="w-6 h-6 text-slate-400" />}
            title="No Recent Activity"
            description="No forward or publish events recorded yet."
            className="border-none bg-transparent p-6 sm:p-8"
          />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {activities.map((item) => (
              <div
                key={item.id}
                className="p-3.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.status === 'success' ? (
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0 shadow-sm">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {item.destinationName}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-slate-300">
                        {item.publishMode}
                      </span>
                    </div>
                    {item.previewText ? (
                      <p className="text-xs text-slate-400 truncate max-w-sm">{item.previewText}</p>
                    ) : (
                      <p className="text-[11px] text-slate-400 font-mono">
                        Direct forward dispatch
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <Badge
                    variant={item.status === 'success' ? 'success' : 'error'}
                    size="xs"
                    className="capitalize mb-1 shadow-sm"
                  >
                    {item.status}
                  </Badge>
                  <p className="text-[10px] text-slate-400 font-mono tabular-nums">
                    {item.executionTimeMs > 0 ? `${item.executionTimeMs}ms • ` : ''}
                    {getRelativeTimestamp(item.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
