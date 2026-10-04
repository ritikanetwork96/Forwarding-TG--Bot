import React from 'react';
import { Send, ShieldCheck, Terminal, Layers } from 'lucide-react';
import { Badge } from './Badge';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased selection:bg-sky-500/20 selection:text-sky-300">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Send className="w-5 h-5 text-white -translate-x-0.5 translate-y-0.5" />
            </div>
            <div>
              <span className="font-bold text-white tracking-tight text-base sm:text-lg">
                Telegram Forwarder
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-mono text-slate-400">
                v0.1.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="brand" size="md">
              <Layers className="w-3.5 h-3.5" />
              Phase 0: Foundation
            </Badge>
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              TypeScript Strict
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-400" />
            <span>Production-Ready Telegram Content Forwarding & Publishing Platform</span>
          </div>
          <div>
            <span>Phase 0 Clean Foundation &bull; Monorepo Workspace</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
