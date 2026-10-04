import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  UserPlus,
  Crown,
  Tag,
  XCircle,
  Trash2,
  Edit2,
  Users,
  KeyRound,
  User,
  Power,
  Search,
  ShieldAlert,
  AtSign,
  Send,
  Sparkles,
} from 'lucide-react';
import { UserService, type CreateUserData, type UpdateUserData } from '../services/user.service';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Modal } from '../components/ui/Modal';
import type { UserDTO, UserRole, UserStatus } from '@telegram-forwarder/shared';

export const AdminsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'all' | 'owner' | 'delegated'>('all');
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserDTO | null>(null);

  // Quick Add State for Delegated Admin / Editor by ID
  const [quickAdd, setQuickAdd] = useState<{
    telegramUserId: string;
    name: string;
    roleType: 'admin' | 'editor';
    password: string;
  }>({
    telegramUserId: '',
    name: '',
    roleType: 'editor',
    password: '',
  });

  // Modal Form states for Add Member
  const [addForm, setAddForm] = useState<{
    name: string;
    username: string;
    password: string;
    role: UserRole;
    status: UserStatus;
    tag: string;
    canManageAdmins: boolean;
    telegramUserId: string;
  }>({
    name: '',
    username: '',
    password: '',
    role: 'admin',
    status: 'active',
    tag: 'Editor',
    canManageAdmins: false,
    telegramUserId: '',
  });

  // Form states for Edit Member
  const [editForm, setEditForm] = useState<{
    name: string;
    role: UserRole;
    status: UserStatus;
    tag: string;
    canManageAdmins: boolean;
    newPassword?: string;
  }>({
    name: '',
    role: 'admin',
    status: 'active',
    tag: '',
    canManageAdmins: false,
    newPassword: '',
  });

  const canManage = currentUser?.role === 'owner' || Boolean(currentUser?.canManageAdmins);

  const { data: users = [], isLoading, isError, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => UserService.list(),
    enabled: Boolean(canManage),
  });

  // Create User Mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateUserData) => UserService.create(data),
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsAddModalOpen(false);
      setQuickAdd({
        telegramUserId: '',
        name: '',
        roleType: 'editor',
        password: '',
      });
      setAddForm({
        name: '',
        username: '',
        password: '',
        role: 'admin',
        status: 'active',
        tag: 'Editor',
        canManageAdmins: false,
        telegramUserId: '',
      });
      toast.success(
        'Team Member Added',
        `${newUser.name} is now registered as ${newUser.tag || newUser.role.toUpperCase()}`
      );
    },
    onError: (err: unknown) => {
      toast.error('Creation Failed', err instanceof Error ? err.message : 'Could not create user');
    },
  });

  // Update User Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserData }) =>
      UserService.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
      toast.success('Access Updated', `Profile & permissions updated for ${updated.name}`);
    },
    onError: (err: unknown) => {
      toast.error('Update Failed', err instanceof Error ? err.message : 'Could not update user');
    },
  });

  // Delete User Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => UserService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setUserToDelete(null);
      toast.success('Access Revoked', 'User account permanently removed.');
    },
    onError: (err: unknown) => {
      toast.error('Delete Failed', err instanceof Error ? err.message : 'Could not delete user');
    },
  });

  const handleOpenEdit = (user: UserDTO) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      role: user.role,
      status: user.status,
      tag: user.tag || '',
      canManageAdmins: Boolean(user.canManageAdmins),
      newPassword: '',
    });
  };

  const handleToggleStatus = (targetUser: UserDTO) => {
    if (targetUser._id === currentUser?._id) {
      toast.warning('Notice', 'You cannot disable your own active session.');
      return;
    }
    const nextStatus: UserStatus = targetUser.status === 'active' ? 'disabled' : 'active';
    updateMutation.mutate({
      id: targetUser._id,
      data: { status: nextStatus },
    });
  };

  // Submit Quick Add Form
  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawId = quickAdd.telegramUserId.trim();
    const name = quickAdd.name.trim();

    if (!rawId) {
      toast.error('Validation Error', 'Please enter a Telegram ID or Username');
      return;
    }
    if (!name) {
      toast.error('Validation Error', 'Please enter the member name');
      return;
    }

    const cleanUsername = rawId.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '') || `user_${Date.now().toString().slice(-4)}`;
    const generatedPassword = quickAdd.password.trim() || `TgAdmin@${Math.floor(1000 + Math.random() * 9000)}`;

    const isEditor = quickAdd.roleType === 'editor';
    const tag = isEditor ? 'Editor' : 'Admin';
    const canManageAdmins = !isEditor;

    createMutation.mutate({
      name,
      username: cleanUsername,
      email: `${cleanUsername}@relay.local`,
      password: generatedPassword,
      role: 'admin',
      status: 'active',
      tag,
      canManageAdmins,
      telegramUserId: rawId,
    });
  };

  // Separate Owner and Delegated Members
  const ownerUser = users.find((u) => u.role === 'owner') || currentUser;
  const delegatedUsers = users.filter((u) => u.role !== 'owner');

  // Filter users by search query
  const filteredDelegatedUsers = delegatedUsers.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.telegramUserId && u.telegramUserId.toLowerCase().includes(q)) ||
      (u.tag && u.tag.toLowerCase().includes(q))
    );
  });

  const tagPresets = ['Editor', 'Admin', 'Manager', 'Co-Admin', 'Moderator', 'VIP Dispatcher'];

  if (!canManage) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-[#0d1019]/90 border border-white/[0.08] text-center space-y-4 shadow-2xl backdrop-blur-xl">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white font-display">Access Restricted</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Only the primary Owner or designated administrators with management privileges can access the Admin Console.
        </p>
        <div className="pt-2">
          <Button variant="primary" size="sm" onClick={() => navigate('/')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-16 font-sans selection:bg-sky-500/25 selection:text-sky-300">
      {/* Top Header with Apple Pro Styling */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-sky-500/10 text-sky-400 border border-sky-500/25 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-sky-400" />
              Access Control Console
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5 font-display tracking-tight">
            <span>Admin &amp; Team Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Manage the primary panel owner credentials or delegate permissions to team members as Admins or Editors using their Telegram ID or username.
          </p>
        </div>

        {/* View Selection Pill Controls (Apple Style) */}
        <div className="flex items-center gap-1.5 bg-[#0d1019]/90 border border-white/[0.08] p-1 rounded-2xl backdrop-blur-xl self-start sm:self-auto shadow-inner">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-white/[0.12] text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            All Access
          </button>
          <button
            onClick={() => setActiveTab('owner')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeTab === 'owner'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                : 'text-slate-400 hover:text-amber-300 hover:bg-white/[0.04]'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Panel Admin</span>
          </button>
          <button
            onClick={() => setActiveTab('delegated')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeTab === 'delegated'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold'
                : 'text-slate-400 hover:text-sky-300 hover:bg-white/[0.04]'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>Admins &amp; Editors</span>
          </button>
        </div>
      </div>

      {/* OPTION 1: PRIMARY PANEL ADMIN (SYSTEM OWNER CARD) */}
      {(activeTab === 'all' || activeTab === 'owner') && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#121624] via-[#0d101b] to-[#090b12] border border-amber-500/25 p-6 sm:p-7 shadow-2xl backdrop-blur-2xl">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            {/* Left: Identity Details */}
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
                <Crown className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold text-white tracking-tight">
                    {ownerUser?.name || 'Primary Panel Administrator'}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm">
                    <Crown className="w-3 h-3 text-amber-400" />
                    Root Panel Admin
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online &amp; Active
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                  <span className="font-mono text-slate-300">
                    Email: <span className="text-white font-semibold">{ownerUser?.email || 'botforword@gmail.com'}</span>
                  </span>
                  <span>•</span>
                  <span className="font-mono text-slate-300">
                    Username: <span className="text-sky-400">@{ownerUser?.username || 'botadmin'}</span>
                  </span>
                  {ownerUser?.telegramUserId && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-amber-300 flex items-center gap-1">
                        <Send className="w-3 h-3 text-sky-400" />
                        TG ID: {ownerUser.telegramUserId}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-400/90 pt-1">
                  Master controller account with root credentials. Has permanent authority to provision delegated roles, modify system architecture, and dispatch across all channels.
                </p>
              </div>
            </div>

            {/* Right: Quick Action / Status Chip */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-right space-y-0.5 hidden sm:block">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Console Authority</div>
                <div className="text-xs font-semibold text-amber-400 font-mono">Super Admin (L1)</div>
              </div>
              {ownerUser && (
                <button
                  onClick={() => handleOpenEdit(ownerUser)}
                  className="px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-medium transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Owner Profile</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OPTION 2: DELEGATED ADMINS & EDITORS SECTION */}
      {(activeTab === 'all' || activeTab === 'delegated') && (
        <div className="space-y-6">
          {/* Quick-Add by Telegram ID / Username Form Card */}
          <div className="rounded-3xl bg-[#0d1019]/90 border border-white/[0.08] p-6 shadow-xl backdrop-blur-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <span>Add Delegated Admin or Editor</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter someone's Telegram ID or username and assign them as an Admin or Content Editor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 self-start sm:self-auto cursor-pointer"
              >
                <span>Advanced Form Options</span>
                <span className="text-slate-500">&rarr;</span>
              </button>
            </div>

            {/* Inline Fast Add Form */}
            <form onSubmit={handleQuickAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Telegram ID or Username */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                    <Send className="w-3 h-3 text-sky-400" />
                    <span>Telegram User ID or Username</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. 123456789 or @username"
                      value={quickAdd.telegramUserId}
                      onChange={(e) => setQuickAdd({ ...quickAdd, telegramUserId: e.target.value })}
                      className="w-full bg-[#141824] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors font-mono"
                    />
                  </div>
                </div>

                {/* Member Name */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                    <User className="w-3 h-3 text-sky-400" />
                    <span>Full Name</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={quickAdd.name}
                    onChange={(e) => setQuickAdd({ ...quickAdd, name: e.target.value })}
                    className="w-full bg-[#141824] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>

                {/* Role Selector: Admin vs Editor */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-sky-400" />
                    <span>Assigned Role</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-[#141824] p-1 rounded-xl border border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setQuickAdd({ ...quickAdd, roleType: 'admin' })}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        quickAdd.roleType === 'admin'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/35 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🛡️ Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickAdd({ ...quickAdd, roleType: 'editor' })}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        quickAdd.roleType === 'editor'
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/35 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ✏️ Editor
                    </button>
                  </div>
                </div>

                {/* Password / Quick Submit */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-sky-400" />
                    <span>Password (Optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Auto-generated if blank"
                      value={quickAdd.password}
                      onChange={(e) => setQuickAdd({ ...quickAdd, password: e.target.value })}
                      className="w-full bg-[#141824] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors font-mono"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={createMutation.isPending}
                      className="shrink-0 px-4 rounded-xl font-semibold"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              {/* Role Explanatory Subtitle */}
              <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <strong>Admin:</strong> Can configure rules, sources, destinations, and schedules.
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                  <strong>Editor:</strong> Can compose posts, edit captions, and schedule publications.
                </span>
              </div>
            </form>
          </div>

          {/* Currently Added Members Table Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Active Delegated Members</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-300 border border-white/[0.08]">
                  {delegatedUsers.length} added
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                All team members currently registered with name, Telegram ID, role, and operational tag.
              </p>
            </div>

            {/* Search Filter */}
            <div className="flex items-center gap-2 bg-[#0d1019] px-3.5 py-2 rounded-xl border border-white/[0.08] text-xs w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by name, ID, or tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none text-xs"
              />
            </div>
          </div>

          {/* Members List Container */}
          <div className="rounded-3xl bg-[#0d1019]/90 border border-white/[0.08] overflow-hidden shadow-xl backdrop-blur-xl">
            {isLoading ? (
              <div className="p-16 text-center text-xs text-slate-400 space-y-3">
                <div className="w-6 h-6 rounded-full border-2 border-sky-500/40 border-t-sky-400 animate-spin mx-auto" />
                <p>Loading member directory...</p>
              </div>
            ) : isError ? (
              <div className="p-8 text-center text-xs text-rose-400">
                Error: {error instanceof Error ? error.message : 'Unknown error'}
              </div>
            ) : filteredDelegatedUsers.length === 0 ? (
              <div className="p-16 text-center text-xs text-slate-400 space-y-3">
                <Users className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No delegated members found</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Use the quick form above to add an Admin or Editor using their Telegram ID or username.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Cards View (md:hidden) */}
                <div className="md:hidden divide-y divide-white/[0.06]">
                  {filteredDelegatedUsers.map((member) => {
                    const isCurrent = member._id === currentUser?._id;
                    const isEditor = (member.tag || '').toLowerCase().includes('editor');

                    return (
                      <div key={member._id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-[#141824] border border-white/[0.1] flex items-center justify-center text-sm font-bold text-slate-200 font-mono shrink-0 shadow-sm">
                              {member.name?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-100 flex items-center gap-1.5 truncate text-xs">
                                <span>{member.name}</span>
                                {isCurrent && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/25">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono truncate">
                                @{member.username || member.email?.split('@')[0]}
                              </div>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0">
                            {member.status === 'active' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/25">
                                <XCircle className="w-3 h-3" />
                                Disabled
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Role, Tag, and Telegram ID Details */}
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          {isEditor ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                              ✏️ Editor
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                              🛡️ Admin
                            </span>
                          )}

                          {member.tag && member.tag !== 'Editor' && member.tag !== 'Admin' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#141824] text-slate-200 border border-white/[0.1] font-mono">
                              <Tag className="w-2.5 h-2.5 text-sky-400" />
                              {member.tag}
                            </span>
                          )}

                          {member.telegramUserId ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-sky-500/10 text-sky-300 border border-sky-500/20">
                              <Send className="w-2.5 h-2.5 text-sky-400" />
                              ID: {member.telegramUserId}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-500">No TG linked</span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-slate-500">
                            Added: {new Date(member.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {!isCurrent && (
                              <button
                                onClick={() => handleToggleStatus(member)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                                  member.status === 'active'
                                    ? 'bg-[#141824] text-slate-300 border-white/[0.08] hover:text-white'
                                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                                }`}
                              >
                                <Power className="w-3 h-3 inline mr-1" />
                                <span>{member.status === 'active' ? 'Disable' : 'Enable'}</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenEdit(member)}
                              className="px-2.5 py-1 rounded-lg bg-[#141824] hover:bg-[#1c2233] text-[11px] font-medium text-sky-400 border border-white/[0.08]"
                            >
                              <Edit2 className="w-3 h-3 inline mr-1" />
                              <span>Edit</span>
                            </button>
                            {!isCurrent && (
                              <button
                                onClick={() => setUserToDelete(member)}
                                className="p-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#080a10] text-slate-400 uppercase font-mono text-[10px] border-b border-white/[0.06]">
                      <tr>
                        <th className="px-5 py-3.5">Member Name</th>
                        <th className="px-4 py-3.5">Telegram ID / User</th>
                        <th className="px-4 py-3.5">Role</th>
                        <th className="px-4 py-3.5">Display Tag</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Date Added</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {filteredDelegatedUsers.map((member) => {
                        const isCurrent = member._id === currentUser?._id;
                        const isEditor = (member.tag || '').toLowerCase().includes('editor');

                        return (
                          <tr key={member._id} className="hover:bg-white/[0.02] transition-colors">
                            {/* Member Name */}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-2xl bg-[#141824] border border-white/[0.1] flex items-center justify-center text-xs font-bold text-slate-200 font-mono shrink-0 shadow-sm">
                                  {member.name?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-100 flex items-center gap-1.5 truncate">
                                    <span>{member.name}</span>
                                    {isCurrent && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/25">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono truncate">
                                    @{member.username || member.email?.split('@')[0]}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Telegram ID */}
                            <td className="px-4 py-4 font-mono text-[11px]">
                              {member.telegramUserId ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-500/10 text-sky-300 border border-sky-500/20 font-mono">
                                  <Send className="w-3 h-3 text-sky-400" />
                                  <span>{member.telegramUserId}</span>
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>

                            {/* Role */}
                            <td className="px-4 py-4">
                              {isEditor ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                                  ✏️ Editor
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                  🛡️ Admin
                                </span>
                              )}
                            </td>

                            {/* Tag */}
                            <td className="px-4 py-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono bg-[#141824] text-slate-200 border border-white/[0.08]">
                                <Tag className="w-2.5 h-2.5 text-sky-400" />
                                {member.tag || (isEditor ? 'Editor' : 'Admin')}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-4">
                              {member.status === 'active' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/25">
                                  <XCircle className="w-3 h-3" />
                                  Disabled
                                </span>
                              )}
                            </td>

                            {/* Date */}
                            <td className="px-4 py-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                              {new Date(member.createdAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>

                            {/* Actions */}
                            <td className="px-5 py-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {!isCurrent && (
                                  <button
                                    onClick={() => handleToggleStatus(member)}
                                    title={member.status === 'active' ? 'Disable Account' : 'Activate Account'}
                                    className="p-1.5 rounded-xl bg-[#141824] hover:bg-[#1c2233] text-slate-400 hover:text-white border border-white/[0.08] transition-colors"
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <button
                                  onClick={() => handleOpenEdit(member)}
                                  title="Edit Permissions & Tag"
                                  className="p-1.5 rounded-xl bg-[#141824] hover:bg-[#1c2233] text-slate-400 hover:text-sky-400 border border-white/[0.08] transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {!isCurrent && (
                                  <button
                                    onClick={() => setUserToDelete(member)}
                                    title="Delete Member"
                                    className="p-1.5 rounded-xl bg-[#141824] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/[0.08] transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
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
        </div>
      )}

      {/* MODAL 1: ADD ADMIN / EDITOR (DETAILED FORM) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-sky-400" />
            <span>Create Admin / Editor Account</span>
          </div>
        }
        description="Add a new administrator or editor with custom permissions"
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const cleanUser = addForm.username.trim().toLowerCase().replace(/^@/, '');
            if (!cleanUser) {
              toast.error('Validation Error', 'Please enter a valid username');
              return;
            }
            createMutation.mutate({
              name: addForm.name.trim(),
              username: cleanUser,
              email: `${cleanUser}@relay.local`,
              password: addForm.password,
              role: addForm.role,
              status: addForm.status,
              tag: addForm.tag.trim() || undefined,
              canManageAdmins: addForm.canManageAdmins,
              telegramUserId: addForm.telegramUserId.trim() || undefined,
            });
          }}
          className="space-y-4 text-xs"
        >
          {/* Telegram User ID */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-sky-400" />
              <span>Telegram User ID (Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 123456789 or @username"
              value={addForm.telegramUserId}
              onChange={(e) => setAddForm({ ...addForm, telegramUserId: e.target.value })}
              className="w-full bg-[#141824] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors font-mono"
            />
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-sky-400" />
              <span>Full Name</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              className="w-full bg-[#141824] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5 text-sky-400" />
              <span>Username</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">@</span>
              <input
                type="text"
                required
                placeholder="e.g. rahul_editor"
                value={addForm.username}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                  })
                }
                className="w-full bg-[#141824] border border-white/[0.1] rounded-xl pl-8 pr-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors font-mono"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-sky-400" />
              <span>Login Password</span>
            </label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              className="w-full bg-[#141824] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* Operational Tag */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-sky-400" />
              <span>Role Tag (Display Badge)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Editor, Admin, Manager"
              value={addForm.tag || ''}
              onChange={(e) => setAddForm({ ...addForm, tag: e.target.value })}
              className="w-full bg-[#141824] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
            {/* Tag Quick Select */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tagPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAddForm({ ...addForm, tag: preset })}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-colors ${
                    addForm.tag === preset
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-semibold'
                      : 'bg-[#141824] text-slate-400 border-white/[0.06] hover:text-slate-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
              className="w-full sm:w-auto justify-center"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createMutation.isPending}
              className="w-full sm:w-auto justify-center"
            >
              Create Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT MEMBER MODAL */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={
          <div className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-sky-400" />
            <span>Edit Access: {editingUser?.name}</span>
          </div>
        }
        description="Update role, permissions, and operational tags"
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editingUser) return;
            const payload: UpdateUserData = {
              name: editForm.name,
              role: editForm.role,
              status: editForm.status,
              tag: editForm.tag || undefined,
              canManageAdmins: editForm.canManageAdmins,
            };
            if (editForm.newPassword) {
              payload.password = editForm.newPassword;
            }
            updateMutation.mutate({ id: editingUser._id, data: payload });
          }}
          className="space-y-4 text-xs"
        >
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Name</label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full bg-[#141824] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Role Tag (Editor, Admin, Manager, etc.)</label>
            <input
              type="text"
              value={editForm.tag}
              onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })}
              placeholder="e.g. Editor"
              className="w-full bg-[#141824] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tagPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEditForm({ ...editForm, tag: preset })}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono border transition-colors ${
                    editForm.tag === preset
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : 'bg-[#141824] text-slate-400 border-white/[0.06] hover:text-slate-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">System Role</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                className="w-full bg-[#141824] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none"
              >
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Account Status</label>
              <select
                value={editForm.status}
                onChange={(e) =>
                  setEditForm({ ...editForm, status: e.target.value as UserStatus })
                }
                className="w-full bg-[#141824] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>

          {/* Co-Owner / Team Management Authority Checkbox */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-[#141824] border border-white/[0.08] cursor-pointer hover:border-sky-500/30 transition-colors">
            <input
              type="checkbox"
              checked={editForm.canManageAdmins}
              onChange={(e) => setEditForm({ ...editForm, canManageAdmins: e.target.checked })}
              className="mt-0.5 rounded border-white/20 bg-black/40 text-sky-500 focus:ring-0"
            />
            <div className="space-y-0.5 select-none">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                Allow Managing Admins &amp; Team
              </span>
              <p className="text-[11px] text-slate-400">
                Grants permission to access the team console and create/edit other admins or editors.
              </p>
            </div>
          </label>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Reset Password (Optional)</label>
            <input
              type="password"
              placeholder="Leave blank to keep current password"
              value={editForm.newPassword || ''}
              onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
              className="w-full bg-[#141824] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditingUser(null)}
              className="w-full sm:w-auto justify-center"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={updateMutation.isPending}
              className="w-full sm:w-auto justify-center"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRMATION MODAL: DELETE USER */}
      <ConfirmModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={() => {
          if (userToDelete) {
            deleteMutation.mutate(userToDelete._id);
          }
        }}
        title="Revoke Access?"
        description={`Are you sure you want to permanently delete the account for ${userToDelete?.name} (@${userToDelete?.username || userToDelete?.email})? They will no longer be able to log in or dispatch posts.`}
        confirmText="Revoke Access"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
