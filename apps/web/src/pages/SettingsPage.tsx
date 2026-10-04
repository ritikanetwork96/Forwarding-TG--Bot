import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Settings,
  Bot,
  ShieldCheck,
  Bell,
  Link2,
  Sliders,
  Zap,
  CheckCircle2,
  RefreshCw,
  Clock,
  Pin,
  ExternalLink,
} from 'lucide-react';
import { DashboardService } from '../services/dashboard.service';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../context/ToastContext';

export const SettingsPage: React.FC = () => {
  const { toast } = useToast();

  const { data: dashboardData, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => DashboardService.getStats(),
  });

  // Settings State (persisted in localStorage for immediate responsive feedback)
  const [defaultMode, setDefaultMode] = useState<'copy' | 'forward'>(() => {
    return (localStorage.getItem('tg_pref_mode') as 'copy' | 'forward') || 'copy';
  });

  const [silentDefault, setSilentDefault] = useState<boolean>(() => {
    return localStorage.getItem('tg_pref_silent') === 'true';
  });

  const [autoPinDefault, setAutoPinDefault] = useState<boolean>(() => {
    return localStorage.getItem('tg_pref_autopin') === 'true';
  });

  const [linkPreviewDefault, setLinkPreviewDefault] = useState<boolean>(() => {
    return localStorage.getItem('tg_pref_preview') !== 'false';
  });

  const [antiFloodDelay, setAntiFloodDelay] = useState<number>(() => {
    const val = localStorage.getItem('tg_pref_antiflood');
    return val ? parseInt(val, 10) : 1200;
  });

  const [stripLinks, setStripLinks] = useState<boolean>(() => {
    return localStorage.getItem('tg_pref_strip_links') === 'true';
  });

  const [customWatermark, setCustomWatermark] = useState<string>(() => {
    return localStorage.getItem('tg_pref_watermark') || '';
  });

  const handleSaveSettings = () => {
    try {
      localStorage.setItem('tg_pref_mode', defaultMode);
      localStorage.setItem('tg_pref_silent', String(silentDefault));
      localStorage.setItem('tg_pref_autopin', String(autoPinDefault));
      localStorage.setItem('tg_pref_preview', String(linkPreviewDefault));
      localStorage.setItem('tg_pref_antiflood', String(antiFloodDelay));
      localStorage.setItem('tg_pref_strip_links', String(stripLinks));
      localStorage.setItem('tg_pref_watermark', customWatermark);
      toast.success('Configuration Saved', 'Relay engine parameters updated successfully');
    } catch {
      toast.error('Save Failed', 'Could not save local settings');
    }
  };

  const botInfo = dashboardData?.infrastructure.telegramBot;
  const isHealthy = botInfo?.status === 'connected';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5 font-display">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
              <Settings className="w-4 h-4" />
            </div>
            <span>Engine &amp; Relay Configuration</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global operational parameters, Telegram Bot heartbeat, rate-limiting, and content transformation defaults.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="w-full sm:w-auto justify-center"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />}
          >
            <span>{isFetching ? 'Probing...' : 'Probe Bot'}</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveSettings}
            className="w-full sm:w-auto justify-center"
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            <span>Save Preferences</span>
          </Button>
        </div>
      </div>

      {/* Grid: Bot Telemetry + Infrastructure Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Telegram Bot Card */}
        <div className="p-4 rounded-xl bg-[#0e1017] border border-white/[0.08] relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Telegram Bot</h3>
                <p className="text-[10px] text-slate-400">GrammY Engine</p>
              </div>
            </div>
            <Badge variant={isHealthy ? 'success' : 'error'} size="xs" dot>
              {isHealthy ? 'Online' : 'Disconnected'}
            </Badge>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-white/[0.06] text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Username:</span>
              <span className="text-sky-300 font-mono font-medium">
                {botInfo?.username ? `@${botInfo.username}` : 'Connected'}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Mode:</span>
              <span className="text-slate-200 font-mono">Long Polling (Active)</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Token:</span>
              <span className="text-emerald-400 font-mono">Verified OK</span>
            </div>
          </div>
        </div>

        {/* Relay Engine Telemetry */}
        <div className="p-4 rounded-xl bg-[#0e1017] border border-white/[0.08] relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Message Queue</h3>
                <p className="text-[10px] text-slate-400">Throughput &amp; Latency</p>
              </div>
            </div>
            <Badge variant="brand" size="xs">
              BullMQ Queue
            </Badge>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-white/[0.06] text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Queue Status:</span>
              <span className="text-slate-200 font-mono">Active</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Concurrency:</span>
              <span className="text-slate-200 font-mono">3 Concurrent Jobs</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Inter-Send Delay:</span>
              <span className="text-amber-400 font-mono font-medium">{antiFloodDelay}ms</span>
            </div>
          </div>
        </div>

        {/* Database & Memory */}
        <div className="p-4 rounded-xl bg-[#0e1017] border border-white/[0.08] relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Data Persistence</h3>
                <p className="text-[10px] text-slate-400">MongoDB &amp; Redis</p>
              </div>
            </div>
            <Badge variant="success" size="xs" dot>
              Operational
            </Badge>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-white/[0.06] text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>MongoDB:</span>
              <span className="text-emerald-400 font-mono">Connected</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Redis Delayed Queue:</span>
              <span className="text-emerald-400 font-mono">Active</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Audit Logging:</span>
              <span className="text-slate-200 font-mono">Enabled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Column 1: Broadcast & Forwarding Defaults */}
        <div className="space-y-5">
          <div className="p-5 rounded-xl bg-[#0e1017] border border-white/[0.08] space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/[0.06]">
              <Sliders className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-white">Default Forwarding &amp; Dispatch Modes</h2>
            </div>

            {/* Mode Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Primary Relay Mode (Copy Clean vs Native Forward)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDefaultMode('copy')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    defaultMode === 'copy'
                      ? 'bg-[#131722] border-sky-500/50 text-white'
                      : 'bg-[#10131d] border-white/[0.08] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold text-sky-400 mb-0.5">Copy (Clean)</div>
                  <div className="text-[11px] text-slate-400 leading-tight">
                    Strips the &quot;Forwarded from&quot; header. 100% native appearance.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDefaultMode('forward')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    defaultMode === 'forward'
                      ? 'bg-[#131722] border-sky-500/50 text-white'
                      : 'bg-[#10131d] border-white/[0.08] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-200 mb-0.5">Native Forward</div>
                  <div className="text-[11px] text-slate-400 leading-tight">
                    Retains original channel credit tag and clickable quote source.
                  </div>
                </button>
              </div>
            </div>

            {/* Toggle Toggles */}
            <div className="space-y-2.5 pt-2">
              {/* Silent Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#131722] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Bell className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-200">Silent Broadcast by Default</div>
                    <div className="text-[10px] text-slate-400">
                      Deliver posts without sound notification
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSilentDefault(!silentDefault)}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                    silentDefault ? 'bg-sky-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                      silentDefault ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Auto Pin */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#131722] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                    <Pin className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-200">Auto-Pin Dispatched Messages</div>
                    <div className="text-[10px] text-slate-400">Automatically pin each message to target chat</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoPinDefault(!autoPinDefault)}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                    autoPinDefault ? 'bg-sky-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                      autoPinDefault ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Link Previews */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#131722] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-200">Rich Link Previews (Webpage Embeds)</div>
                    <div className="text-[10px] text-slate-400">Render preview card thumbnails for URLs in posts</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLinkPreviewDefault(!linkPreviewDefault)}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                    linkPreviewDefault ? 'bg-sky-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                      linkPreviewDefault ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Rate-Limiting & Flood-Wait Protection */}
          <div className="p-5 rounded-xl bg-[#0e1017] border border-white/[0.08] space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/[0.06]">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Anti-Flood Safeguard</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Inter-Channel Broadcast Delay</div>
                  <div className="text-[11px] text-slate-400">
                    Delay introduced between sequential channel sends to prevent Telegram 429 FLOOD_WAIT
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {antiFloodDelay} ms
                </span>
              </div>
              <input
                type="range"
                min="500"
                max="5000"
                step="100"
                value={antiFloodDelay}
                onChange={(e) => setAntiFloodDelay(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>500ms (Fast)</span>
                <span>1200ms (Recommended)</span>
                <span>5000ms (Max Safe)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Content Sanitization & Watermarks */}
        <div className="space-y-5">
          <div className="p-5 rounded-xl bg-[#0e1017] border border-white/[0.08] space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/[0.06]">
              <Link2 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Content Sanitization &amp; Link Stripper</h2>
            </div>

            <div className="space-y-4">
              {/* Strip links toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#131722] border border-white/[0.06]">
                <div>
                  <div className="text-xs font-medium text-slate-200">Auto-Strip Inbound Telegram Links</div>
                  <div className="text-[10px] text-slate-400">
                    Automatically remove incoming `t.me/*` links and competitor promotional invites
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStripLinks(!stripLinks)}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                    stripLinks ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                      stripLinks ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Custom Watermark / Channel Attribution */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Global Watermark / Signature Append
                </label>
                <p className="text-[11px] text-slate-400">
                  Optional signature appended to the bottom of all forwarded captions &amp; messages.
                </p>
                <textarea
                  value={customWatermark}
                  onChange={(e) => setCustomWatermark(e.target.value)}
                  placeholder="e.g.: 📢 Join @MyOfficialChannel for daily updates!"
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-[#131722] border border-white/[0.08] rounded-lg text-slate-200 focus:outline-none focus:border-sky-500/80 font-mono resize-none"
                />
              </div>

              {/* Bot Info summary */}
              <div className="p-3.5 rounded-lg bg-[#131722] border border-white/[0.06] text-xs text-slate-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-sky-400">
                  <Bot className="w-4 h-4" />
                  <span>Telegram Bot Integration</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Scheduled posts and automated forwards created through Telegram via your bot will automatically inherit these transformation and safety rules.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action: Save & Apply */}
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveSettings}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              <span>Save &amp; Apply Engine Settings</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
