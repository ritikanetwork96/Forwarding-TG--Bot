import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Radio,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Play,
  Pause,
  Clock,
  Hash,
} from 'lucide-react';
import { SourceService } from '../services/source.service';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Modal } from '../components/ui/Modal';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import type { SourceDTO, ChatType, SourceStatus } from '@telegram-forwarder/shared';

export const SourcesPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [type, setType] = useState<ChatType>('channel');

  // Edit Modal State
  const [editingSource, setEditingSource] = useState<SourceDTO | null>(null);

  useLockBodyScroll(Boolean(isCreateOpen || editingSource));
  const [editTitle, setEditTitle] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editType, setEditType] = useState<ChatType>('channel');
  const [editStatus, setEditStatus] = useState<SourceStatus>('active');

  // Delete Confirmation State
  const [sourceToDelete, setSourceToDelete] = useState<SourceDTO | null>(null);

  // Status Alerts
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const {
    data: sources = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['sources'],
    queryFn: () => SourceService.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      telegramChatId: string;
      title: string;
      username?: string | null;
      type?: ChatType;
    }) => SourceService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setIsCreateOpen(false);
      setTelegramChatId('');
      setTitle('');
      setUsername('');
      setActionSuccess('Source registered successfully');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to register source');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: {
      id: string;
      data: { title?: string; username?: string | null; status?: SourceStatus; type?: ChatType };
    }) => SourceService.update(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setEditingSource(null);
      setActionSuccess('Source updated successfully');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to update source');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => SourceService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setSourceToDelete(null);
      setActionSuccess('Source removed successfully');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to delete source');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    createMutation.mutate({
      telegramChatId,
      title,
      username: username ? username : null,
      type,
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSource) return;
    setActionError(null);
    updateMutation.mutate({
      id: editingSource._id,
      data: {
        title: editTitle,
        username: editUsername ? editUsername : null,
        type: editType,
        status: editStatus,
      },
    });
  };

  const openEditModal = (src: SourceDTO) => {
    setEditingSource(src);
    setEditTitle(src.title);
    setEditUsername(src.username || '');
    setEditType(src.type);
    setEditStatus(src.status);
    setActionError(null);
  };

  const togglePauseSource = (src: SourceDTO) => {
    const newStatus: SourceStatus = src.status === 'active' ? 'paused' : 'active';
    updateMutation.mutate({
      id: src._id,
      data: { status: newStatus },
    });
  };

  const formatIngestedDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5 font-display">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
              <Radio className="w-4 h-4" />
            </div>
            <span>Inbound Monitored Sources</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Channels and chats actively monitored by the bot for incoming messages to forward and transform.
          </p>
        </div>

        <Button
          onClick={() => {
            setActionError(null);
            setIsCreateOpen(true);
          }}
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          + Add Monitored Source
        </Button>
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

      <div className="rounded-xl bg-[#0e1017] border border-white/[0.08] overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-xs text-slate-400 space-y-3">
            <div className="w-6 h-6 rounded-full border-2 border-sky-500/40 border-t-sky-400 animate-spin mx-auto" />
            <p>Scanning monitored sources...</p>
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            Error loading sources: {error instanceof Error ? error.message : 'Unknown'}
          </div>
        ) : sources.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-400 flex items-center justify-center mx-auto">
              <Radio className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-500">
              No sources registered yet. Click &quot;Add Monitored Source&quot; to configure an inbound channel or chat.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0a0c13] text-slate-400 uppercase font-mono text-[10px] border-b border-white/[0.06]">
                <tr>
                  <th className="px-4 py-3">Title &amp; Handle</th>
                  <th className="px-4 py-3">Telegram Chat ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Ingested</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {sources.map((src: SourceDTO) => (
                  <tr key={src._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white">{src.title}</div>
                      <div className="text-[11px] text-slate-400">
                        {src.username ? `@${src.username}` : 'No username'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-400">{src.telegramChatId}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant="brand" size="xs">
                        {src.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        variant={
                          src.status === 'active'
                            ? 'success'
                            : src.status === 'paused'
                            ? 'warning'
                            : 'error'
                        }
                        size="xs"
                        dot={src.status === 'active'}
                      >
                        {src.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formatIngestedDate(src.lastIngestedAt)}</span>
                      </div>
                      {src.lastMessageId && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono mt-0.5">
                          <Hash className="w-2.5 h-2.5" />
                          <span>msg #{src.lastMessageId}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => togglePauseSource(src)}
                          disabled={updateMutation.isPending}
                          title={src.status === 'active' ? 'Pause ingestion' : 'Resume ingestion'}
                          className={`p-1.5 rounded-md border border-white/[0.06] transition-colors ${
                            src.status === 'active'
                              ? 'bg-[#131722] hover:bg-amber-500/20 text-slate-400 hover:text-amber-400'
                              : 'bg-[#131722] hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400'
                          }`}
                        >
                          {src.status === 'active' ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => openEditModal(src)}
                          className="p-1.5 rounded-md bg-[#131722] border border-white/[0.06] hover:bg-sky-500/20 text-slate-400 hover:text-sky-400 transition-colors"
                          title="Edit Source"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setSourceToDelete(src)}
                          className="p-1.5 rounded-md bg-[#131722] border border-white/[0.06] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete Source"
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

      {/* Register Source Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register Inbound Source"
        description="Monitor a channel or group to auto-ingest incoming messages"
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Telegram Chat ID *
            </label>
            <input
              type="text"
              required
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="e.g. -1001234567890"
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-sky-500/80 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Source Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Source Channel Name"
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
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
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-sky-500/80 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Chat Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ChatType)}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
            >
              <option value="channel">📢 Channel</option>
              <option value="supergroup">👥 Supergroup</option>
              <option value="group">👥 Group Chat</option>
            </select>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              className="w-full sm:w-auto justify-center"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createMutation.isPending}
              className="w-full sm:w-auto justify-center"
            >
              {createMutation.isPending ? 'Registering...' : 'Register Source'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Source Modal */}
      <Modal
        isOpen={!!editingSource}
        onClose={() => setEditingSource(null)}
        title="Edit Source"
        description="Update source properties and ingestion status"
        size="md"
      >
        {editingSource && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Telegram Chat ID
              </label>
              <input
                type="text"
                disabled
                value={editingSource.telegramChatId}
                className="w-full px-3.5 py-2.5 bg-black/25 border border-white/[0.06] rounded-xl text-xs text-slate-400 font-mono cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Title</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Username (optional)
              </label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Chat Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as ChatType)}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
                >
                  <option value="channel">Channel</option>
                  <option value="supergroup">Supergroup</option>
                  <option value="group">Group</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as SourceStatus)}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingSource(null)}
                className="w-full sm:w-auto justify-center"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto justify-center"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!sourceToDelete}
        onClose={() => setSourceToDelete(null)}
        onConfirm={() => {
          if (sourceToDelete) {
            deleteMutation.mutate(sourceToDelete._id);
            setSourceToDelete(null);
          }
        }}
        title="Remove Source?"
        description={`Are you sure you want to remove source "${sourceToDelete?.title}" (${sourceToDelete?.telegramChatId})? Messages from this chat will no longer be ingested.`}
        confirmText="Confirm Remove"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
