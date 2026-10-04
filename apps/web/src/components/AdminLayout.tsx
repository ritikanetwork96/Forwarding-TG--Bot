import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut,
  Menu,
  X,
  Activity,
  Send,
  Server,
  Database,
  CheckCircle2,
  RefreshCw,
  Crown,
  Tag,
  LayoutDashboard,
  Share2,
  FolderTree,
  Clock,
  History,
  Plus,
  FileText,
  GitFork,
  Users,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { cn } from '../lib/utils';
import { PublishingStudioModal } from './composer/PublishingStudioModal';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isConnOpen, setIsConnOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const connRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // Prevent background scrolling when mobile menu drawer is open
  useLockBodyScroll(isMobileOpen);

  const {
    data: health,
    isLoading: isHealthLoading,
    isError: isHealthError,
    refetch: refetchHealth,
    isFetching: isHealthFetching,
  } = useHealthCheck(12000);

  // Close connection popup and more dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (connRef.current && !connRef.current.contains(e.target as Node)) {
        setIsConnOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const canAccessAdmins = user?.role === 'owner' || Boolean(user?.canManageAdmins);

  // Primary Horizontal Desktop Tabs (Always visible)
  const primaryNavItems = [
    { to: '/', label: 'Dashboard', shortLabel: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, end: true },
    { to: '/posts', label: 'Posts & Drafts', shortLabel: 'Posts', icon: <FileText className="w-4 h-4" /> },
    { to: '/destinations', label: 'Channels & Groups', shortLabel: 'Channels', icon: <Share2 className="w-4 h-4" /> },
    { to: '/categories', label: 'Categories', shortLabel: 'Categories', icon: <FolderTree className="w-4 h-4" /> },
  ];

  // Secondary items placed into the "More ▾" dropdown before Create Post
  const moreNavItems = [
    { to: '/rules', label: 'Forward Rules', shortLabel: 'Rules', icon: <GitFork className="w-4 h-4" />, description: 'Route & auto-forward messages' },
    { to: '/scheduled', label: 'Scheduled Posts', shortLabel: 'Scheduled', icon: <Clock className="w-4 h-4" />, description: 'Timed releases & calendar' },
    { to: '/logs', label: 'History & Logs', shortLabel: 'Logs', icon: <History className="w-4 h-4" />, description: 'Audit trails & delivery status' },
    ...(canAccessAdmins
      ? [{ to: '/admins', label: 'Admins', shortLabel: 'Admins', icon: <Users className="w-4 h-4" />, description: 'Roles & team permissions' }]
      : []),
  ];

  const allNavItems = [...primaryNavItems, ...moreNavItems];

  const activeMoreItem = moreNavItems.find((item) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  );
  const isMoreActive = Boolean(activeMoreItem);

  const isConnected = !isHealthLoading && !isHealthError && health?.status === 'ok';

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-100 flex flex-col font-sans antialiased selection:bg-sky-500/25 selection:text-sky-300">
      {/* Top Stealth Navigation Bar with Glass Effect */}
      <header className="admin-sticky-header sticky top-0 z-40 w-full bg-[#08090d]/85 backdrop-blur-xl border-b border-white/[0.08] px-3 sm:px-6 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 h-14">
          {/* Left: Mobile Menu Trigger + Brand Identity + Desktop Tabs */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-1.5 -ml-1 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] border border-transparent hover:border-white/[0.1] transition-all shrink-0"
              aria-label="Open sidebar menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <NavLink to="/" className="flex items-center gap-2 group py-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 group-hover:bg-sky-500/30 transition-all shadow-[0_0_15px_rgba(14,165,233,0.3)] shrink-0">
                <Send className="w-3.5 h-3.5 fill-current" />
              </div>
              <span className="font-bold text-white text-xs sm:text-sm tracking-tight font-display whitespace-nowrap">
                <span className="hidden sm:inline">FORWARD BOT</span>
                <span className="sm:hidden">FWD BOT</span>
              </span>
            </NavLink>

            {/* Horizontal Navigation Tabs (Desktop) with clean primary links + More Dropdown */}
            <nav className="hidden lg:flex items-center space-x-1">
              {primaryNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={item.label}
                  className={({ isActive }) =>
                    cn(
                      'relative py-1.5 px-2.5 xl:px-3 text-xs font-medium transition-all select-none flex items-center gap-1.5 whitespace-nowrap rounded-xl',
                      isActive
                        ? 'text-white font-semibold bg-white/[0.08]'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span>{item.label}</span>
                      {isActive && (
                        <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-sky-400 to-cyan-300 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.8)] transition-all" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}

              {/* More Dropdown (Contains Rules, Scheduled, Logs, Admins) */}
              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  className={cn(
                    'relative py-1.5 px-2.5 xl:px-3 text-xs font-medium transition-all select-none flex items-center gap-1.5 whitespace-nowrap rounded-xl cursor-pointer',
                    isMoreActive
                      ? 'text-white font-semibold bg-white/[0.08]'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  )}
                  title="More Navigation Options"
                >
                  <span>{activeMoreItem ? activeMoreItem.shortLabel : 'More'}</span>
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 transition-transform duration-200 opacity-70',
                      isMoreOpen && 'rotate-180 opacity-100 text-sky-400'
                    )}
                  />
                  {isMoreActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-sky-400 to-cyan-300 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.8)] transition-all" />
                  )}
                </button>

                {/* Apple Frosted Glass Dropdown Menu */}
                {isMoreOpen && (
                  <div className="absolute left-0 mt-2 w-60 rounded-2xl apple-glass border border-white/[0.12] p-1.5 shadow-2xl z-50 animate-fade-in space-y-0.5">
                    {moreNavItems.map((item) => {
                      const isActive =
                        item.to === '/'
                          ? location.pathname === '/'
                          : location.pathname.startsWith(item.to);
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setIsMoreOpen(false)}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all select-none',
                            isActive
                              ? 'bg-sky-500/15 text-sky-300 font-semibold border border-sky-500/30'
                              : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                          )}
                        >
                          <div
                            className={cn(
                              'p-1.5 rounded-lg border shrink-0',
                              isActive
                                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                                : 'bg-white/[0.04] border-white/[0.06] text-slate-400'
                            )}
                          >
                            {item.icon}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate">{item.label}</span>
                            {item.description && (
                              <span className="text-[10px] text-slate-400 font-normal truncate">
                                {item.description}
                              </span>
                            )}
                          </div>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Right: Primary Create Post Button + Status + User Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Primary Action: + Create Post Button (Desktop & Mobile) */}
            <button
              onClick={() => setIsComposerOpen(true)}
              className="glass-btn-primary flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
              title="Create New Broadcast Post"
            >
              <Plus className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
              <span className="hidden sm:inline">Create Post</span>
              <span className="sm:hidden">Post</span>
            </button>

            {/* Interactive Connection Section */}
            <div className="relative" ref={connRef}>
              <button
                type="button"
                onClick={() => setIsConnOpen(!isConnOpen)}
                className={cn(
                  'flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border text-[11px] sm:text-xs font-mono transition-all cursor-pointer select-none backdrop-blur-md',
                  isConnected
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                    : isHealthLoading
                    ? 'border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
                    : 'border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15'
                )}
                title="System Connection Status"
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    isConnected
                      ? 'bg-emerald-400 animate-pulse'
                      : isHealthLoading
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-500'
                  )}
                />
                <span className="font-semibold hidden md:inline">
                  {isConnected
                    ? 'Connected'
                    : isHealthLoading
                    ? 'Connecting...'
                    : 'Disconnected'}
                </span>
              </button>

              {/* Connection Telemetry Popover Dropdown */}
              {isConnOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#0f121a]/95 backdrop-blur-xl border border-white/[0.12] p-4 shadow-2xl z-50 space-y-3 animate-fade-in text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                    <div className="flex items-center gap-1.5 font-semibold text-white font-mono">
                      <Activity className="w-4 h-4 text-sky-400" />
                      <span>System Telemetry</span>
                    </div>
                    <button
                      onClick={() => void refetchHealth()}
                      disabled={isHealthFetching}
                      className="p-1 rounded text-slate-400 hover:text-white transition-colors"
                      title="Ping server"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isHealthFetching ? 'animate-spin text-sky-400' : ''}`}
                      />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {/* Node Server API */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#141824] border border-white/[0.06]">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Server className="w-3.5 h-3.5 text-sky-400" />
                        <span>API Server</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Online (Port 5000)</span>
                      </div>
                    </div>

                    {/* Database */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#141824] border border-white/[0.06]">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Database className="w-3.5 h-3.5 text-emerald-400" />
                        <span>MongoDB Atlas</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{health?.database?.status || 'Connected'}</span>
                      </div>
                    </div>

                    {/* Telegram Bot */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#141824] border border-white/[0.06]">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Send className="w-3.5 h-3.5 text-sky-400" />
                        <span>Telegram Bot</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Polling Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile & Operational Tag (Desktop) */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/[0.08]">
                <div className="w-7 h-7 rounded-lg bg-[#131722] border border-white/[0.1] flex items-center justify-center text-xs font-bold text-slate-200 font-mono shadow-sm">
                  {user.name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-200 font-semibold truncate max-w-[110px]">
                    {user.name || user.username}
                  </span>
                  <div className="flex items-center gap-1">
                    {user.tag ? (
                      <span className="text-[10px] font-mono text-sky-400 flex items-center gap-0.5">
                        <Tag className="w-2.5 h-2.5" />
                        {user.tag}
                      </span>
                    ) : user.role === 'owner' ? (
                      <span className="text-[10px] font-mono text-amber-400 flex items-center gap-0.5 font-medium">
                        <Crown className="w-2.5 h-2.5" />
                        Owner
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400">Staff</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Logout (Desktop) */}
            <button
              onClick={handleLogout}
              title="Logout"
              className="hidden sm:flex p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Sliding Left Sidebar Drawer (Mobile) — Rendered OUTSIDE header with high z-index */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden animate-fade-in">
          {/* Solid Darkened Backdrop with Blur */}
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Slide-out Sidebar Panel with Full Glass Effect */}
          <aside className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-[#0c0e18]/95 backdrop-blur-2xl border-r border-white/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.8)] z-[101] flex flex-col p-4 animate-in slide-in-from-left duration-200">
            {/* Drawer Top Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-md">
                  <Send className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <span className="font-bold text-white text-sm tracking-tight font-display block">
                    FORWARD BOT
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Control Panel</span>
                </div>
              </div>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="apple-close-btn"
                aria-label="Close menu"
                title="Close Menu"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* User Identity Chip */}
            {user && (
              <div className="my-3.5 p-3 rounded-xl bg-[#141824]/90 border border-white/[0.08] flex items-center gap-3 backdrop-blur-md">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sm font-bold text-sky-400 font-mono shadow-sm">
                  {user.name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white truncate">
                    {user.name || user.username}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-mono text-sky-400 font-medium">
                      {user.tag || (user.role === 'owner' ? '👑 Owner' : user.canManageAdmins ? '🛡️ Co-Owner' : 'Staff')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Primary Action Button: + Create New Post */}
            <button
              onClick={() => {
                setIsMobileOpen(false);
                setIsComposerOpen(true);
              }}
              className="w-full mb-3 glass-btn-primary py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Create New Post</span>
            </button>

            {/* Navigation Items (Showing ALL Menu Options) */}
            <div className="text-[10px] uppercase font-mono font-semibold text-slate-400 px-2 mb-1.5">
              Menu Navigation
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
              {allNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item ? Boolean(item.end) : undefined}
                  onClick={() => setIsMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all select-none',
                      isActive
                        ? 'bg-sky-500/20 text-white font-semibold border border-sky-500/40 shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-2.5">
                        <span className={cn(isActive ? 'text-sky-400' : 'text-slate-400')}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Bottom Actions & Sign Out */}
            <div className="pt-3 border-t border-white/[0.08] space-y-2 mt-auto">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Viewport Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-[var(--mobile-bottom-nav-clearance)] lg:pb-8">
        {children}
      </main>

      {/* Fixed Mobile Bottom Navigation Bar with Glass Effect */}
      <nav className="admin-mobile-bottom-nav fixed bottom-0 inset-x-0 z-30 lg:hidden bg-[#090c15]/85 backdrop-blur-xl border-t border-white/[0.1] px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_25px_rgba(0,0,0,0.6)] safe-area-bottom">
        {/* 1. Dashboard */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium transition-all select-none min-w-[52px]',
              isActive ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className={cn('p-1 rounded-lg transition-colors', isActive ? 'bg-sky-500/15 text-sky-400' : 'text-slate-400')}>
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <span className="mt-0.5 tracking-tight">Dashboard</span>
            </>
          )}
        </NavLink>

        {/* 2. Posts & Drafts */}
        <NavLink
          to="/posts"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium transition-all select-none min-w-[52px]',
              isActive ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className={cn('p-1 rounded-lg transition-colors', isActive ? 'bg-sky-500/15 text-sky-400' : 'text-slate-400')}>
                <FileText className="w-4 h-4" />
              </div>
              <span className="mt-0.5 tracking-tight">Posts</span>
            </>
          )}
        </NavLink>

        {/* 3. Center Action: + Create Post (Glowing Glass Button) */}
        <button
          onClick={() => setIsComposerOpen(true)}
          className="glass-btn-primary -mt-4 p-2.5 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-sky-500/30 active:scale-90 transition-transform"
          title="Create New Post"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span className="text-[9px] font-bold mt-0.5 uppercase tracking-wider">Post</span>
        </button>

        {/* 4. Channels & Groups */}
        <NavLink
          to="/destinations"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium transition-all select-none min-w-[52px]',
              isActive ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className={cn('p-1 rounded-lg transition-colors', isActive ? 'bg-sky-500/15 text-sky-400' : 'text-slate-400')}>
                <Share2 className="w-4 h-4" />
              </div>
              <span className="mt-0.5 tracking-tight">Channels</span>
            </>
          )}
        </NavLink>

        {/* 5. Menu (Opens Drawer with ALL Options) */}
        <button
          onClick={() => setIsMobileOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium text-slate-400 hover:text-slate-200 transition-all select-none min-w-[52px]"
          title="Open All Menu Options"
        >
          <div className="p-1 rounded-lg text-slate-400 hover:bg-white/[0.08]">
            <Menu className="w-4 h-4" />
          </div>
          <span className="mt-0.5 tracking-tight">Menu</span>
        </button>
      </nav>

      {/* Global Publishing Studio Composer Modal */}
      <PublishingStudioModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
      />

      {/* Minimalist Developer Footer (Desktop only) */}
      <footer className="hidden lg:block border-t border-white/[0.06] bg-[#08090d]/60 backdrop-blur-md py-3.5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Telegram Autonomous Distribution Engine &bull; Zero Message Loss</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>GrammY Polling Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
