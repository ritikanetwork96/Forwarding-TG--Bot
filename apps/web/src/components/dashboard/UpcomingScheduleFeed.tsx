import React from 'react';
import { Link } from 'react-router-dom';
import type { DashboardStatsDTO } from '@telegram-forwarder/shared';
import { Clock, ArrowRight, Calendar, Target } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

export interface UpcomingScheduleFeedProps {
  schedules: DashboardStatsDTO['upcomingSchedules'];
}

function getRelativeTimeLabel(dateString: string): string {
  const target = new Date(dateString);
  const now = new Date();
  const diffMinutes = Math.round((target.getTime() - now.getTime()) / 60000);

  if (diffMinutes <= 0) return 'Due now';
  if (diffMinutes === 1) return 'In 1 minute';
  if (diffMinutes < 60) return `In ${diffMinutes} minutes`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours === 1) return 'In 1 hour';
  if (diffHours < 24) return `In ${diffHours} hours`;

  const diffDays = Math.round(diffHours / 24);
  return `In ${diffDays} days`;
}

function formatExactTime(dateString: string): string {
  const target = new Date(dateString);
  return target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const UpcomingScheduleFeed: React.FC<UpcomingScheduleFeedProps> = ({ schedules }) => {
  return (
    <Card
      variant="default"
      className="flex flex-col h-full bg-[#111420] border-white/[0.07] shadow-xl shadow-black/40 rounded-xl relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-amber-500/40 before:to-transparent"
    >
      <CardHeader className="flex flex-row items-center justify-between pb-3.5 border-b border-white/[0.06] px-5 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-sm">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <CardTitle className="text-sm font-semibold text-white tracking-tight">
            Upcoming Releases
          </CardTitle>
        </div>
        <Link
          to="/scheduled"
          className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 transition-colors"
        >
          <span>View all</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="p-0 flex-1">
        {schedules.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-6 h-6 text-slate-400" />}
            title="No Scheduled Relays"
            description="Broadcasts queued via your Telegram Bot or routing rules will appear here."
            className="border-none bg-transparent p-6 sm:p-8"
          />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {schedules.map((item) => (
              <Link
                key={item.id}
                to="/scheduled"
                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors group block"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge variant="warning" size="xs">
                      {getRelativeTimeLabel(item.scheduledFor)}
                    </Badge>
                    {item.categoryName && (
                      <Badge variant="neutral" size="xs">
                        {item.categoryName}
                      </Badge>
                    )}
                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Target className="w-3 h-3 text-slate-400" />
                      <span>
                        {item.destinationCount} {item.destinationCount === 1 ? 'target' : 'targets'}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-200 truncate group-hover:text-sky-300 transition-colors">
                    {item.previewText}
                  </p>
                </div>

                <div className="sm:text-right shrink-0">
                  <p className="text-xs font-mono text-slate-200 tabular-nums">
                    {formatExactTime(item.scheduledFor)}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase font-mono">{item.timezone}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
