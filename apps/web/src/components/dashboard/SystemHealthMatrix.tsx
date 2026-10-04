import React from 'react';
import type { DashboardStatsDTO } from '@telegram-forwarder/shared';
import { Database, Server, Cpu, Bot, Activity, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';

export interface SystemHealthMatrixProps {
  infrastructure: DashboardStatsDTO['infrastructure'];
}

export const SystemHealthMatrix: React.FC<SystemHealthMatrixProps> = ({ infrastructure }) => {
  const services = [
    {
      name: 'MongoDB Atlas',
      category: 'Primary Database',
      icon: <Database className="w-4 h-4 text-emerald-400" />,
      status: infrastructure.mongo.status,
      detail: infrastructure.mongo.status === 'connected' ? 'Replica Set Live' : 'Connection Error',
      isHealthy: infrastructure.mongo.status === 'connected',
    },
    {
      name: 'Redis Cluster',
      category: 'BullMQ State & Cache',
      icon: <Server className="w-4 h-4 text-rose-400" />,
      status: infrastructure.redis.status,
      detail: infrastructure.redis.status === 'connected' ? 'In-Memory Pipeline' : 'Unreachable',
      isHealthy: infrastructure.redis.status === 'connected',
    },
    {
      name: 'BullMQ Worker',
      category: 'Async Publish Engine',
      icon: <Cpu className="w-4 h-4 text-indigo-400" />,
      status: infrastructure.worker.status,
      detail: `Concurrency ${infrastructure.worker.concurrency} • Dedicated Worker`,
      isHealthy: infrastructure.worker.status !== 'stopped',
    },
    {
      name: 'Telegram Bot API',
      category: 'grammY Inbound & Outbound',
      icon: <Bot className="w-4 h-4 text-violet-400" />,
      status: infrastructure.telegramBot.status,
      detail: infrastructure.telegramBot.username
        ? `@${infrastructure.telegramBot.username}`
        : 'Bot Connected',
      isHealthy: infrastructure.telegramBot.status === 'connected',
    },
  ];

  return (
    <Card
      variant="default"
      className="bg-[#111420] border-white/[0.07] shadow-xl shadow-black/40 rounded-xl relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-emerald-500/40 before:to-transparent"
    >
      <CardHeader className="flex flex-row items-center justify-between pb-3.5 border-b border-white/[0.06] px-5 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <CardTitle className="text-sm font-semibold text-white tracking-tight">
            Infrastructure Matrix
          </CardTitle>
        </div>
        <Badge
          variant={infrastructure.overallStatus === 'healthy' ? 'success' : 'warning'}
          size="xs"
          dot
          className="shadow-sm"
        >
          {infrastructure.overallStatus === 'healthy' ? 'Cluster Healthy' : 'Degraded State'}
        </Badge>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {services.map((srv) => (
            <div
              key={srv.name}
              className="p-3.5 rounded-xl bg-[#0e1019]/90 border border-white/[0.06] hover:border-violet-500/30 transition-all flex items-center justify-between gap-2.5 shadow-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#161a29] border border-white/[0.08] flex items-center justify-center shrink-0 shadow-sm">
                  {srv.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-slate-200 truncate">{srv.name}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">{srv.detail}</p>
                </div>
              </div>

              <div className="shrink-0">
                {srv.isHealthy ? (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <ShieldCheck className="w-3 h-3" />
                    <span>OK</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                    <AlertTriangle className="w-3 h-3" />
                    <span>ERR</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
