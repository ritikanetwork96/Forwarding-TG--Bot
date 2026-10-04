import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DashboardStatsDTO } from '@telegram-forwarder/shared';
import { Share2, GitFork, Clock, FolderTree, CheckCircle2 } from 'lucide-react';
import { RuleService } from '../../services/rule.service';
import { CategoryService } from '../../services/category.service';
import { KpiCard } from './KpiCard';

export interface KpiGridProps {
  kpis: DashboardStatsDTO['kpis'];
}

export const KpiGrid: React.FC<KpiGridProps> = ({ kpis }) => {
  const { data: rules = [] } = useQuery({
    queryKey: ['rules'],
    queryFn: () => RuleService.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => CategoryService.list(),
  });

  const activeRules = rules.filter((r) => r.isActive).length;
  const activeCategories = categories.filter((c) => c.status === 'active').length;

  const deliverySubtext =
    kpis.delivery24h.total > 0
      ? `${kpis.delivery24h.success} success of ${kpis.delivery24h.total} in 24h`
      : 'Ready for incoming dispatches';

  const deliveryBadgeVariant =
    kpis.delivery24h.failed > 0 ? 'error' : kpis.delivery24h.total > 0 ? 'success' : 'neutral';

  const deliveryBadgeText =
    kpis.delivery24h.failed > 0
      ? `${kpis.delivery24h.failed} failed`
      : kpis.delivery24h.total > 0
      ? '100% clean'
      : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
      {/* 1. Target Channels & Groups */}
      <KpiCard
        title="Broadcast Targets"
        value={`${kpis.destinations.verified} / ${kpis.destinations.total}`}
        subtext={`${kpis.destinations.disabled} disabled • verified channels & GCs`}
        icon={<Share2 className="w-4 h-4" />}
        iconColorClass="text-emerald-400"
        iconBgClass="bg-emerald-500/10 border-emerald-500/20"
        to="/destinations"
      />

      {/* 2. Forward Rules (Automated Rules) */}
      <KpiCard
        title="Forward Rules"
        value={`${activeRules} / ${rules.length}`}
        subtext={`${activeRules} active forward rules`}
        icon={<GitFork className="w-4 h-4" />}
        iconColorClass="text-violet-400"
        iconBgClass="bg-violet-500/10 border-violet-500/25 shadow-sm shadow-violet-500/10"
        badgeText={activeRules > 0 ? `${activeRules} active` : 'Ready'}
        badgeVariant="brand"
        to="/rules"
      />

      {/* 3. Categories */}
      <KpiCard
        title="Categories"
        value={activeCategories}
        subtext={`${categories.length} total categories`}
        icon={<FolderTree className="w-4 h-4" />}
        iconColorClass="text-indigo-400"
        iconBgClass="bg-indigo-500/10 border-indigo-500/20"
        badgeText={activeCategories > 0 ? `${activeCategories} live` : undefined}
        badgeVariant="neutral"
        to="/categories"
      />

      {/* 4. Scheduled Timed Queue */}
      <KpiCard
        title="Scheduled Queue"
        value={kpis.scheduled.total}
        subtext={`${kpis.scheduled.todayDue} due for release today`}
        icon={<Clock className="w-4 h-4" />}
        iconColorClass="text-amber-400"
        iconBgClass="bg-amber-500/10 border-amber-500/20"
        badgeText={kpis.scheduled.todayDue > 0 ? `${kpis.scheduled.todayDue} today` : undefined}
        badgeVariant="warning"
        to="/scheduled"
      />

      {/* 5. 24h Relay Success Rate */}
      <KpiCard
        title="24h Success Rate"
        value={kpis.delivery24h.displayRate}
        subtext={deliverySubtext}
        icon={<CheckCircle2 className="w-4 h-4" />}
        iconColorClass={kpis.delivery24h.failed > 0 ? 'text-rose-400' : 'text-emerald-400'}
        iconBgClass={
          kpis.delivery24h.failed > 0
            ? 'bg-rose-500/10 border-rose-500/20'
            : 'bg-emerald-500/10 border-emerald-500/20'
        }
        badgeText={deliveryBadgeText}
        badgeVariant={deliveryBadgeVariant}
        to="/logs"
      />
    </div>
  );
};
