import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  UserPlus,
  Crown,
  Tag,
  CheckCircle2,
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

  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserDTO | null>(null);

  // Form states for Add Member
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
    tag: 'Manager',
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
      setAddForm({
        name: '',
        username: '',
        password: '',
        role: 'admin',
        status: 'active',
        tag: 'Manager',
        canManageAdmins: false,
        telegramUserId: '',
      });
      toast.success('Admin Created', `Account for @${newUser.username || newUser.name} is now active.`);
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

  // Filter users by search
  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      u.email.toLowerCase().includes(q) ||
      (u.tag && u.tag.toLowerCase().includes(q))
    );
  });

  const tagPresets = ['Manager', 'Co-Admin', 'Operator', 'Moderator', 'Editor', 'VIP Dispatcher'];

  if (!canManage) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-2xl bg-[#0f121a] border border-white/[0.08] text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white font-display">Access Restricted</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Only the primary Owner or designated Co-Owners with administrative management rights can access the Team &amp; Access Control console.
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans selection:bg-sky-500/25 selection:text-sky-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5 font-display">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span>Team &amp; Access Control</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Provision logins, assign operational tags (Manager, Co-Admin), and manage team permissions.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-sky-600/20 cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Admin / Manager</span>
        </button>
      </div>

      {/* Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0f121a] border border-white/[0.08] shadow-md space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Total Team</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{users.length}</div>
        </div>

        <div className="p-4 rounded-2xl glass-card space-y-1">
          <div className="flex items-center justify-between text-xs text-amber-400 font-medium">
            <span>Owners</span>
            <Crown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {users.filter((u) => u.role === 'owner').length || 1}
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-card space-y-1">
          <div className="flex items-center justify-between text-xs text-sky-400 font-medium">
            <span>Co-Owners &amp; Staff</span>
            <Tag className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-400 font-mono">
            {users.filter((u) => u.canManageAdmins || u.role === 'admin').length}
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-card space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
            <span>Active Status</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {users.filter((u) => u.status === 'active').length}
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3 glass-card p-3 rounded-2xl">
        <div className="flex items-center gap-2 flex-1 bg-[#141824] px-3.5 py-2 rounded-xl border border-white/[0.06] text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, username, or role tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none text-xs"
          />
        </div>
      </div>

      {/* Team Members Table */}
      <div className="rounded-2xl glass-card overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-16 text-center text-xs text-slate-400 space-y-3">
            <div className="w-6 h-6 rounded-full border-2 border-sky-500/40 border-t-sky-400 animate-spin mx-auto" />
            <p>Loading team accounts...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-xs text-rose-400">
            Error: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-500 space-y-2">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p>No team members matching your search.</p>
          </div>
        ) : (
          <>
            {/* Mobile View: Vertical Member Cards (md:hidden) */}
            <div className="md:hidden divide-y divide-white/[0.06]">
          {filteredUsers.map((member) => {
            const isCurrent = member._id === currentUser?._id;
            const isOwner = member.role === 'owner';

            return (
              <div key={member._id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#141824] border border-white/[0.1] flex items-center justify-center text-sm font-bold text-slate-200 font-mono shrink-0 shadow-sm">
                      {member.name?.[0]?.toUpperCase() || member.username?.[0]?.toUpperCase() || 'U'}
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

                {/* Role and Tag Strip */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {isOwner ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      <Crown className="w-3 h-3 text-amber-400" />
                      Owner
                    </span>
                  ) : member.canManageAdmins ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/30">
                      <ShieldCheck className="w-3 h-3 text-sky-400" />
                      Co-Owner
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#141824] text-slate-300 border border-white/[0.08]">
                      <Users className="w-3 h-3 text-slate-400" />
                      Admin
                    </span>
                  )}

                  {member.tag && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#141824] text-slate-200 border border-white/[0.1] font-mono">
                      <Tag className="w-2.5 h-2.5 text-sky-400" />
                      {member.tag}
                    </span>
                  )}

                  {member.telegramUserId && (
                    <span className="text-[10px] font-mono text-slate-400">
                      TG: {member.telegramUserId}
                    </span>
                  )}
                </div>

                {/* Mobile Actions */}
                <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(member.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {!isCurrent && (
                      <button
                        onClick={() => handleToggleStatus(member)}
                        className="px-2.5 py-1 rounded-lg bg-[#141824] text-[11px] font-medium text-slate-300 border border-white/[0.08]"
                        title={member.status === 'active' ? 'Disable' : 'Enable'}
                      >
                        <Power className="w-3 h-3 inline mr-1" />
                        <span>{member.status === 'active' ? 'Disable' : 'Enable'}</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEdit(member)}
                      className="px-2.5 py-1 rounded-lg bg-[#141824] text-[11px] font-medium text-sky-400 border border-white/[0.08]"
                      title="Edit"
                    >
                      <Edit2 className="w-3 h-3 inline mr-1" />
                      <span>Edit</span>
                    </button>
                    {!isCurrent && (
                      <button
                        onClick={() => setUserToDelete(member)}
                        className="p-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        title="Delete"
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
            <thead className="bg-[#0a0c13] text-slate-400 uppercase font-mono text-[10px] border-b border-white/[0.06]">
              <tr>
                <th className="px-5 py-3">Member</th>
                <th className="px-4 py-3">System Role</th>
                <th className="px-4 py-3">Custom Tag</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Telegram ID</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredUsers.map((member) => {
                const isCurrent = member._id === currentUser?._id;
                const isOwner = member.role === 'owner';

                return (
                  <tr key={member._id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Member Info */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#141824] border border-white/[0.1] flex items-center justify-center text-xs font-bold text-slate-200 font-mono shrink-0 shadow-sm">
                          {member.name?.[0]?.toUpperCase() || member.username?.[0]?.toUpperCase() || 'U'}
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

                    {/* System Role */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {isOwner ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          <Crown className="w-3 h-3 text-amber-400" />
                          Owner
                        </span>
                      ) : member.canManageAdmins ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/30">
                          <ShieldCheck className="w-3 h-3 text-sky-400" />
                          Co-Owner
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#141824] text-slate-300 border border-white/[0.08]">
                          <Users className="w-3 h-3 text-slate-400" />
                          Admin
                        </span>
                      )}
                    </td>

                    {/* Custom Operational Tag */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {member.tag ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-[#141824] text-slate-200 border border-white/[0.1] font-mono">
                          <Tag className="w-3 h-3 text-sky-400" />
                          {member.tag}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {member.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/25">
                          <XCircle className="w-3 h-3" />
                          Disabled
                        </span>
                      )}
                    </td>

                    {/* Telegram ID */}
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {member.telegramUserId || '—'}
                    </td>

                    {/* Created Date */}
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(member.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Toggle Status */}
                        {!isCurrent && (
                          <button
                            onClick={() => handleToggleStatus(member)}
                            title={member.status === 'active' ? 'Disable Account' : 'Activate Account'}
                            className="p-1.5 rounded-lg bg-[#141824] hover:bg-[#1c2233] text-slate-400 hover:text-white border border-white/[0.08] transition-colors"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Edit Details & Tag */}
                        <button
                          onClick={() => handleOpenEdit(member)}
                          title="Edit Permissions & Tag"
                          className="p-1.5 rounded-lg bg-[#141824] hover:bg-[#1c2233] text-slate-400 hover:text-sky-400 border border-white/[0.08] transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Account */}
                        {!isCurrent && (
                          <button
                            onClick={() => setUserToDelete(member)}
                            title="Delete Member"
                            className="p-1.5 rounded-lg bg-[#141824] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/[0.08] transition-colors"
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

      {/* Modal 1: Add Admin / Manager Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-sky-400" />
            <span>Create Admin / Manager Account</span>
          </div>
        }
        description="Add a new administrator to manage Forward Bot"
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
                placeholder="e.g. rahul or ops_admin"
                value={addForm.username}
                onChange={(e) => setAddForm({ ...addForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
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
              placeholder="e.g. Manager, Co-Admin, Content Lead"
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
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono border transition-colors ${
                    addForm.tag === preset
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : 'bg-[#141824] text-slate-400 border-white/[0.06] hover:text-slate-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Role Select */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              <span>System Authority</span>
            </label>
            <select
              value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value as UserRole })}
              className="w-full bg-[#141824] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500 transition-colors"
            >
              <option value="admin">Admin / Staff</option>
              <option value="owner">Full Owner</option>
            </select>
          </div>

          {/* Co-Owner / Team Management Authority Checkbox */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-[#141824] border border-white/[0.08] cursor-pointer hover:border-sky-500/30 transition-colors">
            <input
              type="checkbox"
              checked={addForm.canManageAdmins}
              onChange={(e) => setAddForm({ ...addForm, canManageAdmins: e.target.checked })}
              className="mt-0.5 rounded border-white/20 bg-black/40 text-sky-500 focus:ring-0"
            />
            <div className="space-y-0.5 select-none">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                Grant Co-Owner / Team Management Authority
              </span>
              <p className="text-[11px] text-slate-400">
                Allows this member to access the Admin Console and create or configure other admins.
              </p>
            </div>
          </label>

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
              Create Member
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Edit Member Modal */}
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
            <label className="text-slate-300 font-medium">Role Tag (Manager, Co-Admin, etc.)</label>
            <input
              type="text"
              value={editForm.tag}
              onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })}
              placeholder="e.g. Manager"
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
                Grant Co-Owner / Team Management Authority
              </span>
              <p className="text-[11px] text-slate-400">
                Allows this member to access the Admin Console and create or configure other admins.
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

      {/* Confirmation Modal: Delete User */}
      <ConfirmModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={() => {
          if (userToDelete) {
            deleteMutation.mutate(userToDelete._id);
          }
        }}
        title="Revoke Admin Access?"
        description={`Are you sure you want to permanently delete account for ${userToDelete?.name} (${userToDelete?.email})? They will no longer be able to log in or manage bot configurations.`}
        confirmText="Revoke Access"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
