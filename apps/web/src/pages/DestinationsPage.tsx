import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Share2,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Edit2,
  Power,
  Users,
  Search,
  Send,
  X,
} from 'lucide-react';
import { DestinationService } from '../services/destination.service';
import { DestinationGroupService } from '../services/destination-group.service';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import type {
  DestinationDTO,
  ChatType,
  DestinationGroupDTO,
  DestinationGroupStatus,
} from '@telegram-forwarder/shared';

export const DestinationsPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Top Tab State: 'individual' | 'groups'
  const [activeTab, setActiveTab] = useState<'individual' | 'groups'>('individual');

  // Destination Modals & Form State
  const [isDestModalOpen, setIsDestModalOpen] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [type, setType] = useState<ChatType>('channel');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [destToDelete, setDestToDelete] = useState<DestinationDTO | null>(null);

  // Group Modals & Form State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DestinationGroupDTO | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<DestinationGroupDTO | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);

  // Strictly prevent background page scrolling when modals are open
  useLockBodyScroll(isDestModalOpen || isGroupModalOpen);

  // Alerts
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Queries
  const {
    data: destinations = [],
    isLoading: isLoadingDestinations,
    isError: isDestError,
    error: destError,
  } = useQuery({
    queryKey: ['destinations'],
    queryFn: () => DestinationService.list(),
  });

  const { data: destinationGroups = [], isLoading: isLoadingGroups } = useQuery({
    queryKey: ['destination-groups'],
    queryFn: () => DestinationGroupService.list(),
  });

  // Search & Type Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [chatTypeFilter, setChatTypeFilter] = useState<'all' | 'channel' | 'group' | 'private'>('all');

  const filteredDestinations = React.useMemo(() => {
    return destinations.filter((dest) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        dest.title.toLowerCase().includes(q) ||
        (dest.displayName && dest.displayName.toLowerCase().includes(q)) ||
        dest.telegramChatId.includes(q) ||
        (dest.username && dest.username.toLowerCase().includes(q));
      const matchesType =
        chatTypeFilter === 'all'
          ? true
          : chatTypeFilter === 'channel'
          ? dest.type === 'channel'
          : chatTypeFilter === 'private'
          ? dest.type === 'private'
          : dest.type === 'group' || dest.type === 'supergroup';
      return matchesSearch && matchesType;
    });
  }, [destinations, searchQuery, chatTypeFilter]);

  const channelCount = destinations.filter((d) => d.type === 'channel').length;
  const groupCount = destinations.filter((d) => d.type === 'group' || d.type === 'supergroup').length;
  const userCount = destinations.filter((d) => d.type === 'private').length;

  // Destination Mutations
  const createDestMutation = useMutation({
    mutationFn: (data: {
      telegramChatId: string;
      title: string;
      username?: string | null;
      type?: ChatType;
    }) => DestinationService.create(data),
    onSuccess: (newDest) => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
      setIsDestModalOpen(false);
      setTelegramChatId('');
      setTitle('');
      setUsername('');
      setActionSuccess(`Destination registered. Probing administrative privileges...`);
      handleVerify(newDest._id);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to register destination');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => DestinationService.verify(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
      if (updated.verification.canPublish) {
        setActionSuccess(`Verification verified: ${updated.title} is ready for broadcast.`);
      } else {
        setActionError(
          `Verification alert: ${updated.verification.failureReason || 'Permissions incomplete'}`
        );
      }
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Verification failed');
    },
    onSettled: () => {
      setVerifyingId(null);
    },
  });

  const deleteDestMutation = useMutation({
    mutationFn: (id: string) => DestinationService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
      setActionSuccess('Destination deleted');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to delete destination');
    },
  });

  // Group Mutations
  const createGroupMutation = useMutation({
    mutationFn: (data: { name: string; description?: string | null; destinationIds?: string[] }) =>
      DestinationGroupService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destination-groups'] });
      closeGroupModal();
      setActionSuccess('Destination group created successfully');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to create destination group');
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: (params: {
      id: string;
      data: {
        name?: string;
        description?: string | null;
        destinationIds?: string[];
        status?: DestinationGroupStatus;
      };
    }) => DestinationGroupService.update(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destination-groups'] });
      closeGroupModal();
      setActionSuccess('Destination group updated successfully');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to update destination group');
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => DestinationGroupService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destination-groups'] });
      setGroupToDelete(null);
      setActionSuccess('Destination group removed');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to delete destination group');
    },
  });

  const handleVerify = (id: string) => {
    setActionError(null);
    setActionSuccess(null);
    setVerifyingId(id);
    verifyMutation.mutate(id);
  };

  const handleCreateDest = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    createDestMutation.mutate({
      telegramChatId,
      title,
      username: username ? username : null,
      type,
    });
  };

  const openCreateGroupModal = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupDescription('');
    setGroupMemberIds([]);
    setActionError(null);
    setIsGroupModalOpen(true);
  };

  const openEditGroupModal = (group: DestinationGroupDTO) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || '');
    setGroupMemberIds(group.destinationIds || []);
    setActionError(null);
    setIsGroupModalOpen(true);
  };

  const closeGroupModal = () => {
    setIsGroupModalOpen(false);
    setEditingGroup(null);
  };

  const handleGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const payload = {
      name: groupName,
      description: groupDescription ? groupDescription : null,
      destinationIds: groupMemberIds,
    };

    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup._id, data: payload });
    } else {
      createGroupMutation.mutate(payload);
    }
  };

  const toggleGroupStatus = (group: DestinationGroupDTO) => {
    const newStatus: DestinationGroupStatus = group.status === 'active' ? 'archived' : 'active';
    updateGroupMutation.mutate({
      id: group._id,
      data: { status: newStatus },
    });
  };

  const toggleGroupMember = (destId: string) => {
    setGroupMemberIds((prev) =>
      prev.includes(destId) ? prev.filter((id) => id !== destId) : [...prev, destId]
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5 font-display">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <span>Channels &amp; Groups</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Connected Telegram channels (📢) and groups (👥) for message forwarding.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {activeTab === 'individual' ? (
            <Button
              onClick={() => {
                setActionError(null);
                setIsDestModalOpen(true);
              }}
              variant="primary"
              size="sm"
              className="w-full sm:w-auto justify-center"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              + Add Channel / Group
            </Button>
          ) : (
            <Button
              onClick={openCreateGroupModal}
              variant="primary"
              size="sm"
              className="w-full sm:w-auto justify-center"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              + New Custom Group
            </Button>
          )}
        </div>
      </div>

      {/* Segmented Control Tabs (100% Mobile Friendly) */}
      <div className="grid grid-cols-2 sm:inline-flex p-1 rounded-xl bg-[#0e1017] border border-white/[0.08] gap-1">
        <button
          onClick={() => setActiveTab('individual')}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'individual'
              ? 'bg-[#131722] text-white border border-white/[0.12] font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Share2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="truncate">All Channels ({destinations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'groups'
              ? 'bg-[#131722] text-white border border-white/[0.12] font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="truncate">Custom Groups ({destinationGroups.length})</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* TAB 1: INDIVIDUAL DESTINATIONS */}
      {activeTab === 'individual' && (
        <div className="space-y-4">
          {/* Sub-Filters: Search & Chat Type Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search targets by title, chat ID, @username..."
                className="w-full pl-9 pr-3.5 py-2 bg-[#0e1017] border border-white/[0.08] hover:border-white/[0.18] focus:border-sky-500/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-colors font-mono"
              />
            </div>

            {/* Chat Type Pills with Horizontal Scroll on Mobile */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0e1017] border border-white/[0.08] shrink-0 text-xs overflow-x-auto no-scrollbar">
              <button
                onClick={() => setChatTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  chatTypeFilter === 'all'
                    ? 'bg-[#131722] text-white border border-white/[0.10]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({destinations.length})
              </button>
              <button
                onClick={() => setChatTypeFilter('channel')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  chatTypeFilter === 'channel'
                    ? 'bg-[#131722] text-white border border-white/[0.10]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>📢 Channels ({channelCount})</span>
              </button>
              <button
                onClick={() => setChatTypeFilter('group')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  chatTypeFilter === 'group'
                    ? 'bg-[#131722] text-white border border-white/[0.10]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>👥 Groups ({groupCount})</span>
              </button>
              <button
                onClick={() => setChatTypeFilter('private')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  chatTypeFilter === 'private'
                    ? 'bg-[#131722] text-white border border-white/[0.10]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>👤 Users ({userCount})</span>
              </button>
            </div>
          </div>

          {isLoadingDestinations ? (
            <div className="p-16 text-center text-xs text-slate-400 space-y-3">
              <div className="w-6 h-6 rounded-full border-2 border-sky-500/40 border-t-sky-400 animate-spin mx-auto" />
              <p>Scanning connected channels and groups...</p>
            </div>
          ) : isDestError ? (
            <div className="p-6 text-center text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              Error: {destError instanceof Error ? destError.message : 'Unknown'}
            </div>
          ) : filteredDestinations.length === 0 ? (
            <div className="bg-[#0e1017] border border-white/[0.08] rounded-xl p-16 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-400 flex items-center justify-center mx-auto">
                <Share2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-200">No Broadcast Targets</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {searchQuery || chatTypeFilter !== 'all'
                    ? 'No targets match the active filter.'
                    : 'Add a target Telegram channel (📢) or group chat (👥) and run verification.'}
                </p>
              </div>
              {!searchQuery && chatTypeFilter === 'all' && (
                <Button onClick={() => setIsDestModalOpen(true)} variant="primary" size="sm">
                  + Add First Target
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDestinations.map((dest: DestinationDTO) => {
                const isVerified = dest.verification?.canPublish;
                const isVerifying = verifyingId === dest._id;
                const isChannel = dest.type === 'channel';
                const isPrivate = dest.type === 'private';

                return (
                  <Card
                    key={dest._id}
                    variant="interactive"
                    className="p-4 flex flex-col justify-between relative transition-all group"
                  >
                    <div>
                      {/* Top Header: Title, Icon, Badge */}
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm shrink-0">
                              {isChannel ? '📢' : isPrivate ? '👤' : '👥'}
                            </span>
                            <h3 className="font-semibold text-white text-xs tracking-tight truncate">
                              {dest.displayName || dest.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 mt-1 pl-5">
                            <span className="font-mono text-slate-400 text-[10px] truncate">
                              {dest.telegramChatId}
                            </span>
                            {dest.username && (
                              <span className="text-sky-400 text-[10px] truncate font-mono">
                                @{dest.username}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono border shrink-0 ${
                            isChannel
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/25'
                              : isPrivate
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25'
                          }`}
                        >
                          {isChannel ? 'Channel' : isPrivate ? 'User' : 'Group'}
                        </span>
                      </div>

                      {/* Category Badges */}
                      {dest.categories && dest.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2 pl-5">
                          {dest.categories.map((cat) => (
                            <span
                              key={cat._id}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-500/10 text-violet-300 border border-violet-500/20"
                            >
                              🏷️ {cat.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Health & Permissions Details Card */}
                      <div className="mt-3 p-3 rounded-lg bg-[#131722] border border-white/[0.06] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Status:</span>
                          {isVerified ? (
                            <Badge variant="success" size="xs" dot>
                              Active &bull; Ready
                            </Badge>
                          ) : dest.status === 'permission_missing' ? (
                            <Badge variant="warning" size="xs">
                              Missing Rights
                            </Badge>
                          ) : dest.status === 'invalid' ? (
                            <Badge variant="error" size="xs">
                              Invalid / Kicked
                            </Badge>
                          ) : (
                            <Badge variant="default" size="xs">
                              Pending Check
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Bot Role:</span>
                          <span className="text-slate-200 capitalize font-mono">
                            {dest.verification.botRole || 'Unknown'}
                          </span>
                        </div>

                        {/* Telegram Granular Rights Pills */}
                        <div className="pt-2 border-t border-white/[0.06] flex flex-wrap gap-1 text-[10px]">
                          {dest.type === 'private' && (
                            <span className="px-1.5 py-0.5 rounded font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              direct_subscriber
                            </span>
                          )}
                          {dest.type === 'channel' && (
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono ${
                                dest.verification.rights.canPostMessages
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              can_post: {String(dest.verification.rights.canPostMessages)}
                            </span>
                          )}
                          {(dest.type === 'supergroup' || dest.type === 'group') && (
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono ${
                                dest.verification.rights.canSendMessages
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              can_send: {String(dest.verification.rights.canSendMessages)}
                            </span>
                          )}
                          {dest.verification.rights.canEditMessages && (
                            <span className="px-1.5 py-0.5 rounded font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              can_edit
                            </span>
                          )}
                        </div>

                        {dest.verification.failureReason && (
                          <div className="text-[10px] text-rose-300 leading-tight pt-1 p-2 rounded bg-rose-500/10 border border-rose-500/20">
                            {dest.verification.failureReason}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500">
                        {dest.verification.lastCheckedAt
                          ? `Checked ${new Date(dest.verification.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : 'Unchecked'}
                      </span>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => handleVerify(dest._id)}
                          disabled={isVerifying}
                          leftIcon={
                            <RefreshCw
                              className={`w-3 h-3 text-sky-400 ${
                                isVerifying ? 'animate-spin' : ''
                              }`}
                            />
                          }
                        >
                          <span>{isVerifying ? 'Checking...' : 'Verify'}</span>
                        </Button>

                        <button
                          onClick={() => setDestToDelete(dest)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.06] transition-colors"
                          title="Delete Channel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DESTINATION CLUSTERS */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-[#0e1017] border border-white/[0.08] overflow-hidden">
            {isLoadingGroups ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Loading destination clusters...
              </div>
            ) : destinationGroups.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No custom groups created yet. Click &quot;Create Custom Group&quot; to group channels together.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#0a0c13] text-slate-400 uppercase font-mono text-[10px] border-b border-white/[0.06]">
                    <tr>
                      <th className="px-4 py-3">Cluster Name</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Members</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {destinationGroups.map((grp: DestinationGroupDTO) => (
                      <tr key={grp._id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{grp.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {grp.description || <span className="italic text-slate-600">None</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#131722] border border-white/[0.06] text-slate-300">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span>{(grp.destinationIds || []).length} targets</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleGroupStatus(grp)}
                            disabled={updateGroupMutation.isPending}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold transition-colors ${
                              grp.status === 'active'
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/40'
                                : 'bg-slate-800 text-slate-400 border border-white/[0.08] hover:bg-slate-700'
                            }`}
                            title="Click to toggle status"
                          >
                            <Power className="w-2.5 h-2.5" />
                            <span>{grp.status}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openEditGroupModal(grp)}
                              className="p-1 rounded bg-[#131722] border border-white/[0.06] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
                              title="Edit Cluster"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setGroupToDelete(grp)}
                              className="p-1 rounded bg-[#131722] border border-white/[0.06] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                              title="Delete Cluster"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Destination Modal (Mobile Bottom-Sheet on small devices) */}
      {isDestModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDestModalOpen(false);
          }}
        >
          <div className="apple-glass rounded-t-[28px] sm:rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative max-h-[92vh] sm:max-h-[90vh] overflow-y-auto before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/[0.25] before:to-transparent pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
            {/* Apple Mobile Sheet Grab Handle */}
            <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08] mb-4">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 font-display">
                <Send className="w-4 h-4 text-sky-400" />
                <span>Register Broadcast Target</span>
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDestModalOpen(false)}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setIsDestModalOpen(false)}
                  className="apple-close-btn"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateDest} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Telegram Chat ID *
                </label>
                <input
                  type="text"
                  required
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="e.g. -1009876543210"
                  className="w-full px-3 py-2 bg-[#131722] border border-white/[0.08] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-sky-500/80 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Channel or Group Name"
                  className="w-full px-3 py-2 bg-[#131722] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Username (optional)
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="channel_handle"
                  className="w-full px-3 py-2 bg-[#131722] border border-white/[0.08] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-sky-500/80 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Chat Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ChatType)}
                  className="w-full px-3 py-2 bg-[#131722] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
                >
                  <option value="channel">📢 Channel (Requires Admin can_post_messages)</option>
                  <option value="supergroup">👥 Supergroup (Member or Admin)</option>
                  <option value="group">👥 Group Chat (Standard Member)</option>
                  <option value="private">👤 Private User Chat (Direct Subscriber)</option>
                </select>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDestModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createDestMutation.isPending}
                >
                  {createDestMutation.isPending ? 'Registering...' : 'Register & Probe'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Destination Group Create/Edit Modal (Mobile Bottom-Sheet on small devices) */}
      {isGroupModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeGroupModal();
          }}
        >
          <div className="apple-glass rounded-t-[28px] sm:rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative max-h-[92vh] sm:max-h-[90vh] overflow-y-auto before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/[0.25] before:to-transparent pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
            {/* Apple Mobile Sheet Grab Handle */}
            <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08] mb-4">
              <h3 className="text-sm sm:text-base font-bold text-white font-display">
                {editingGroup ? 'Edit Destination Cluster' : 'Create Destination Cluster'}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={closeGroupModal}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={closeGroupModal}
                  className="apple-close-btn"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            <form onSubmit={handleGroupSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Cluster Name</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. VIP Channels Cluster"
                  className="w-full px-3 py-2 bg-[#131722] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="e.g. Broadcast cluster for trading alerts"
                  className="w-full px-3 py-2 bg-[#131722] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Member Destinations ({groupMemberIds.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto p-2 bg-[#131722] border border-white/[0.08] rounded-xl space-y-1">
                  {destinations.length === 0 ? (
                    <div className="text-xs text-slate-500 p-1">No destinations found.</div>
                  ) : (
                    destinations.map((d: DestinationDTO) => {
                      const isChecked = groupMemberIds.includes(d._id);
                      return (
                        <label
                          key={d._id}
                          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleGroupMember(d._id)}
                            className="rounded border-white/[0.15] bg-[#0e1017] text-sky-500 focus:ring-0"
                          />
                          <span className="text-slate-200 font-medium">{d.title}</span>
                          <span className="text-slate-500 font-mono text-[10px]">
                            ({d.telegramChatId})
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                <Button type="button" variant="ghost" size="sm" onClick={closeGroupModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createGroupMutation.isPending || updateGroupMutation.isPending}
                >
                  {createGroupMutation.isPending || updateGroupMutation.isPending
                    ? 'Saving...'
                    : editingGroup
                      ? 'Save Cluster'
                      : 'Create Cluster'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Modal */}
      <ConfirmModal
        isOpen={!!groupToDelete}
        onClose={() => setGroupToDelete(null)}
        onConfirm={() => {
          if (groupToDelete) {
            deleteGroupMutation.mutate(groupToDelete._id);
            setGroupToDelete(null);
          }
        }}
        title="Delete Destination Cluster?"
        description={`Are you sure you want to delete cluster "${groupToDelete?.name}"? Forwarding rules targeting this cluster will no longer resolve it.`}
        confirmText="Confirm Delete"
        variant="danger"
        isLoading={deleteGroupMutation.isPending}
      />

      {/* Delete Destination Confirmation Modal */}
      <ConfirmModal
        isOpen={!!destToDelete}
        onClose={() => setDestToDelete(null)}
        onConfirm={() => {
          if (destToDelete) {
            deleteDestMutation.mutate(destToDelete._id);
            setDestToDelete(null);
          }
        }}
        title="Delete Destination?"
        description={`Are you sure you want to delete "${destToDelete?.title}" (${destToDelete?.telegramChatId})? Any active forwarding rules will be affected.`}
        confirmText="Delete Destination"
        variant="danger"
        isLoading={deleteDestMutation.isPending}
      />
    </div>
  );
};
