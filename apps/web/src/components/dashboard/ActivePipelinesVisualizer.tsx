import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitFork,
  ArrowRight,
  Power,
  Radio,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { RuleService } from '../../services/rule.service';
import { SourceService } from '../../services/source.service';
import { CategoryService } from '../../services/category.service';
import { DestinationService } from '../../services/destination.service';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { ForwardingRuleDTO } from '@telegram-forwarder/shared';

export const ActivePipelinesVisualizer: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading: isLoadingRules } = useQuery({
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

  const { data: destinations = [] } = useQuery({
    queryKey: ['destinations'],
    queryFn: () => DestinationService.list(),
  });

  const sourceMap = React.useMemo(() => new Map(sources.map((s) => [s._id, s])), [sources]);
  const catMap = React.useMemo(() => new Map(categories.map((c) => [c._id, c])), [categories]);
  const destMap = React.useMemo(() => new Map(destinations.map((d) => [d._id, d])), [destinations]);

  const toggleMutation = useMutation({
    mutationFn: (rule: ForwardingRuleDTO) =>
      RuleService.update(rule._id, { isActive: !rule.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  // Limit to top 4 active or prominent rules for mission control strip
  const displayedRules = rules.slice(0, 4);

  return (
    <Card
      variant="default"
      className="p-5 sm:p-6 bg-[#0b0d14] border-white/[0.07] shadow-xl relative overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-sm shadow-violet-500/15">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Live Forward Rules</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25">
                {rules.filter((r) => r.isActive).length} Active
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Automatic message forwarding from sources to target channels
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/rules">
            <Button variant="ghost" size="xs" rightIcon={<ExternalLink className="w-3 h-3" />}>
              <span>All Rules ({rules.length})</span>
            </Button>
          </Link>
          <Link to="/rules">
            <Button variant="primary" size="xs" leftIcon={<Plus className="w-3 h-3" />}>
              <span>+ New Rule</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Visual Pipeline Cards */}
      <div className="pt-4">
        {isLoadingRules ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Loading active forward rules...
          </div>
        ) : displayedRules.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-xs text-slate-400">No forward rules configured yet.</p>
            <Link to="/rules">
              <Button variant="primary" size="xs">
                + Create First Forward Rule
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {displayedRules.map((rule) => {
              const src = rule.sourceId ? sourceMap.get(rule.sourceId) : null;
              const cat = rule.categoryId ? catMap.get(rule.categoryId) : null;
              const isCopy = rule.publishMode === 'copy';

              // Target summary
              let targetLabel = 'Unassigned';
              let targetIcon = '📢';

              if (cat) {
                targetLabel = `${cat.iconEmoji || '📁'} ${cat.name} (${cat.destinationIds?.length || 0} Targets)`;
                targetIcon = '📁';
              } else if (rule.destinationIds && rule.destinationIds.length > 0) {
                const first = destMap.get(rule.destinationIds[0]);
                const count = rule.destinationIds.length;
                targetLabel =
                  count === 1
                    ? first?.displayName || first?.title || 'Target Channel'
                    : `${first?.displayName || first?.title || 'Channel'} +${count - 1} more`;
                targetIcon = first?.type === 'channel' ? '📢' : '👥';
              }

              return (
                <div
                  key={rule._id}
                  className={`p-3.5 rounded-xl border transition-all relative overflow-hidden group ${
                    rule.isActive
                      ? 'bg-[#111420] border-white/[0.08] hover:border-violet-500/35'
                      : 'bg-[#0e1017] border-white/[0.04] opacity-70'
                  }`}
                >
                  {/* Top Bar of Card */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-xs font-bold text-white truncate group-hover:text-violet-300 transition-colors">
                      {rule.name}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#161a29] text-slate-400 border border-white/[0.06]">
                        P{rule.priority}
                      </span>
                      <button
                        onClick={() => toggleMutation.mutate(rule)}
                        disabled={toggleMutation.isPending}
                        title={rule.isActive ? 'Pause Rule' : 'Resume Rule'}
                        className={`p-1 rounded-lg border transition-colors ${
                          rule.isActive
                            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30'
                            : 'text-slate-500 border-white/[0.08] bg-[#161a29] hover:text-emerald-400 hover:border-emerald-500/30'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Flow Diagram: Source -> Mode Engine -> Destination */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-[#080a10] border border-white/[0.05]">
                    {/* Source Pill */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 px-2 py-1 rounded bg-[#111420] border border-white/[0.07]">
                      <Radio className="w-3 h-3 text-sky-400 shrink-0" />
                      <span className="text-[11px] font-medium text-slate-200 truncate">
                        {src ? src.title : 'Any Source'}
                      </span>
                    </div>

                    {/* Mode Arrow */}
                    <div className="flex flex-col items-center shrink-0 px-1">
                      <ArrowRight className="w-3 h-3 text-violet-400" />
                      <span className="text-[8px] font-mono font-bold uppercase text-violet-300 tracking-wider">
                        {isCopy ? 'COPY' : 'FWD'}
                      </span>
                    </div>

                    {/* Destination Pill */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 px-2 py-1 rounded bg-[#111420] border border-white/[0.07]">
                      <span className="text-xs shrink-0">{targetIcon}</span>
                      <span className="text-[11px] font-medium text-slate-200 truncate">
                        {targetLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};
