import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderTree,
  Plus,
  Archive,
  AlertCircle,
  CheckCircle2,
  Search,
  Edit2,
  Check,
  Layers,
  Sparkles,
  Trash2,
  RotateCcw,
  Clock,
  X,
} from 'lucide-react';
import { CategoryService } from '../services/category.service';
import { DestinationService } from '../services/destination.service';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import type { CategoryDTO, DestinationDTO } from '@telegram-forwarder/shared';

const PRESET_EMOJIS = ['📁', '🚀', '💎', '⚡', '📢', '🔥', '🎯', '💰', '🧠', '🛡️', '📊', '🌐'];

export const CategoriesPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryDTO | null>(null);
  const [categoryToArchive, setCategoryToArchive] = useState<CategoryDTO | null>(null);
  const [categoryToTrash, setCategoryToTrash] = useState<CategoryDTO | null>(null);
  const [categoryToPermanentDelete, setCategoryToPermanentDelete] = useState<CategoryDTO | null>(null);

  // Prevent background scroll when category modal is open
  useLockBodyScroll(isModalOpen);

  // Form Fields
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [iconEmoji, setIconEmoji] = useState('📁');
  const [description, setDescription] = useState('');
  const [selectedDestIds, setSelectedDestIds] = useState<string[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived' | 'deleted'>('all');

  // Feedback alerts
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Queries
  const {
    data: categories = [],
    isLoading: isLoadingCategories,
    isError: isCategoriesError,
    error: categoriesError,
  } = useQuery({
    queryKey: ['categories', filterStatus],
    queryFn: () => CategoryService.list(filterStatus === 'deleted' ? 'deleted' : undefined),
  });

  const { data: destinations = [] } = useQuery({
    queryKey: ['destinations'],
    queryFn: () => DestinationService.list(),
  });

  // Destinations map for fast lookup
  const destMap = useMemo(() => {
    const map = new Map<string, DestinationDTO>();
    destinations.forEach((d) => map.set(d._id, d));
    return map;
  }, [destinations]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesSearch =
        cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cat.description && cat.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        cat.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        filterStatus === 'all'
          ? cat.status !== 'deleted'
          : filterStatus === 'active'
          ? cat.status === 'active'
          : filterStatus === 'archived'
          ? cat.status === 'archived'
          : cat.status === 'deleted';
      return matchesSearch && matchesStatus;
    });
  }, [categories, searchQuery, filterStatus]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      displayName?: string | null;
      iconEmoji?: string;
      description?: string;
      destinationIds?: string[];
    }) => CategoryService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeModal();
      setActionSuccess('Category created successfully');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to create category');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: {
      id: string;
      data: {
        name?: string;
        displayName?: string | null;
        iconEmoji?: string;
        description?: string;
        destinationIds?: string[];
        status?: 'active' | 'archived';
      };
    }) => CategoryService.update(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeModal();
      setActionSuccess('Category updated successfully');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to update category');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => CategoryService.update(id, { status: 'archived' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setCategoryToArchive(null);
      setActionSuccess('Category archived');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to archive category');
    },
  });

  const trashMutation = useMutation({
    mutationFn: (id: string) => CategoryService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setCategoryToTrash(null);
      setActionSuccess('Category moved to Trash (restorable for 48 hours)');
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to move category to trash');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => CategoryService.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setActionSuccess('Category restored to active');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to restore category');
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) => CategoryService.permanentDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setCategoryToPermanentDelete(null);
      setActionSuccess('Category permanently deleted');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to permanently delete category');
    },
  });

  const getRemainingTrashHours = (deletedAt?: string | null) => {
    if (!deletedAt) return 48;
    const elapsedHours = (Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60);
    const remaining = Math.max(0, Math.ceil(48 - elapsedHours));
    return remaining;
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setDisplayName('');
    setIconEmoji('📁');
    setDescription('');
    setSelectedDestIds([]);
    setActionError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: CategoryDTO) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDisplayName(cat.displayName || '');
    setIconEmoji(cat.iconEmoji || '📁');
    setDescription(cat.description || '');
    setSelectedDestIds(cat.destinationIds || []);
    setActionError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const payload = {
      name,
      displayName: displayName || null,
      iconEmoji,
      description,
      destinationIds: selectedDestIds,
    };

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const toggleDestination = (id: string) => {
    setSelectedDestIds((prev) =>
      prev.includes(id) ? prev.filter((dId) => dId !== id) : [...prev, id]
    );
  };

  const selectAllDestinations = () => {
    setSelectedDestIds(destinations.map((d) => d._id));
  };

  const clearAllDestinations = () => {
    setSelectedDestIds([]);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5 font-display">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0">
              <FolderTree className="w-4 h-4" />
            </div>
            <span>Categories</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Group multiple Telegram channels and groups into categories for 1-click sharing.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={openCreateModal}
            variant="primary"
            size="sm"
            className="w-full sm:w-auto justify-center"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            + New Category
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Metrics & Filter Ribbon */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories or channels..."
            className="w-full pl-9 pr-3.5 py-2 bg-[#0e1017] border border-white/[0.08] hover:border-white/[0.18] focus:border-sky-500/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-colors font-mono"
          />
        </div>

        {/* Filter Pills with horizontal scroll on mobile */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0e1017] border border-white/[0.08] shrink-0 text-xs overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              filterStatus === 'all'
                ? 'bg-[#131722] text-white border border-white/[0.10]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              filterStatus === 'active'
                ? 'bg-[#131722] text-white border border-white/[0.10]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterStatus('archived')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              filterStatus === 'archived'
                ? 'bg-[#131722] text-white border border-white/[0.10]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Archived
          </button>
          <button
            onClick={() => setFilterStatus('deleted')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              filterStatus === 'deleted'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-slate-400 hover:text-rose-400'
            }`}
          >
            <Trash2 className="w-3 h-3" />
            <span>Trash</span>
          </button>
        </div>
      </div>

      {/* Main Categories Grid */}
      {isLoadingCategories ? (
        <div className="p-16 text-center text-xs text-slate-400 space-y-3">
          <div className="w-6 h-6 rounded-full border-2 border-sky-500/40 border-t-sky-400 animate-spin mx-auto" />
          <p>Loading categories...</p>
        </div>
      ) : isCategoriesError ? (
        <div className="p-6 text-center text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl">
          Error: {categoriesError instanceof Error ? categoriesError.message : 'Unknown error'}
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-[#0e1017] border border-white/[0.08] rounded-xl p-16 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-400 flex items-center justify-center mx-auto">
            {filterStatus === 'deleted' ? <Trash2 className="w-5 h-5 text-rose-400" /> : <FolderTree className="w-5 h-5" />}
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-200">
              {filterStatus === 'deleted' ? 'Trash is Empty' : 'No Categories Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {filterStatus === 'deleted'
                ? 'Deleted categories stay in Trash for 48 hours where you can restore them, before being permanently deleted.'
                : searchQuery
                ? 'No categories match your search filter.'
                : 'Create categories to group multiple Telegram channels and group chats into a single destination.'}
            </p>
          </div>
          {!searchQuery && filterStatus !== 'deleted' && (
            <Button onClick={openCreateModal} variant="primary" size="sm">
              + Create First Category
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => {
            const bundledDestIds = cat.destinationIds || [];
            const linkedDests = bundledDestIds
              .map((id) => destMap.get(id))
              .filter(Boolean) as DestinationDTO[];

            return (
              <Card
                key={cat._id}
                variant="interactive"
                className="p-4 flex flex-col justify-between relative transition-all group"
              >
                <div className="space-y-3">
                  {/* Top Row: Emoji, Name, Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#131722] border border-white/[0.08] flex items-center justify-center text-lg shrink-0">
                        {cat.iconEmoji || '📁'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold text-white truncate">
                          {cat.name}
                        </h3>
                        <p className="text-[10px] font-mono text-slate-400 truncate">
                          /{cat.slug}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {cat.status === 'deleted' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/25">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Trash ({getRemainingTrashHours(cat.deletedAt)}h left)</span>
                        </span>
                      ) : (
                        <Badge
                          variant={cat.status === 'active' ? 'success' : 'default'}
                          size="xs"
                          dot={cat.status === 'active'}
                        >
                          {cat.status}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {cat.description ? (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No description provided</p>
                  )}

                  {/* Bundled Channels & Groups */}
                  <div className="pt-2 border-t border-white/[0.06] space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-300 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-sky-400" />
                        <span>Linked Channels & Groups</span>
                      </span>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#131722] text-slate-300 border border-white/[0.08]">
                        {linkedDests.length} Targets
                      </span>
                    </div>

                    {linkedDests.length === 0 ? (
                      <div className="p-2 rounded-lg bg-[#131722] border border-dashed border-white/[0.08] text-center">
                        <p className="text-[11px] text-slate-400">No channels attached yet</p>
                        {cat.status !== 'deleted' && (
                          <button
                            onClick={() => openEditModal(cat)}
                            className="mt-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium"
                          >
                            + Assign Channels
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                        {linkedDests.map((dest) => {
                          const isChannel = dest.type === 'channel';
                          return (
                            <span
                              key={dest._id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#131722] border border-white/[0.06] text-[10px] font-mono text-slate-300"
                              title={`${dest.title} (${dest.type})`}
                            >
                              <span>{isChannel ? '📢' : '👥'}</span>
                              <span className="truncate max-w-[100px]">
                                {dest.displayName || dest.title}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions Row */}
                <div className="pt-3 mt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-slate-500">
                    ID: {cat._id.slice(-6)}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {cat.status === 'deleted' ? (
                      <>
                        <Button
                          variant="secondary"
                          size="xs"
                          leftIcon={<RotateCcw className="w-3 h-3 text-emerald-400" />}
                          onClick={() => restoreMutation.mutate(cat._id)}
                          disabled={restoreMutation.isPending}
                        >
                          <span>Restore</span>
                        </Button>
                        <button
                          onClick={() => setCategoryToPermanentDelete(cat)}
                          title="Purge Permanently"
                          className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          size="xs"
                          leftIcon={<Edit2 className="w-3 h-3" />}
                          onClick={() => openEditModal(cat)}
                        >
                          <span>Edit</span>
                        </Button>
                        {cat.status === 'active' ? (
                          <button
                            onClick={() => setCategoryToArchive(cat)}
                            title="Archive Category"
                            className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-white/[0.06] transition-colors"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              updateMutation.mutate({
                                id: cat._id,
                                data: { status: 'active' },
                              })
                            }
                            title="Activate Category"
                            className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-white/[0.06] transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setCategoryToTrash(cat)}
                          title="Move to Trash (48-hour recovery)"
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.06] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Category Modal (Mobile Bottom-Sheet on small devices) */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="apple-glass rounded-t-[28px] sm:rounded-3xl w-full max-w-xl p-5 sm:p-6 shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/[0.25] before:to-transparent pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
            {/* Apple Mobile Sheet Grab Handle */}
            <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08] shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-base text-sky-400 shrink-0">
                  {iconEmoji || '📁'}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white font-display truncate">
                    {editingCategory ? 'Edit Category' : 'Create Category'}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    Configure name, emoji and target broadcast channels
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="apple-close-btn"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Name & Emoji row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Trading Signals, Main Broadcast"
                    className="w-full px-3 py-2 bg-[#131722] border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Emoji</label>
                  <input
                    type="text"
                    value={iconEmoji}
                    onChange={(e) => setIconEmoji(e.target.value)}
                    maxLength={4}
                    className="w-full text-center px-3 py-1.5 bg-[#131722] border border-white/[0.08] rounded-lg text-base text-white focus:outline-none focus:border-sky-500/80 transition-colors"
                  />
                </div>
              </div>

              {/* Emoji quick presets */}
              <div>
                <span className="block text-[11px] text-slate-400 mb-1 font-mono">
                  Quick Emoji Preset:
                </span>
                <div className="flex flex-wrap gap-1">
                  {PRESET_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setIconEmoji(emoji)}
                      className={`w-7 h-7 rounded text-xs flex items-center justify-center transition-all ${
                        iconEmoji === emoji
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'bg-[#131722] border border-white/[0.08] hover:bg-[#181d2a]'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain what broadcasts route through this category..."
                  rows={2}
                  className="w-full px-3 py-2 bg-[#131722] border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
                />
              </div>

              {/* Bundled Destinations Selector */}
              <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200">
                      Attached Telegram Targets
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Selecting this category will route broadcasts to all checked channels
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllDestinations}
                      className="text-[10px] text-sky-400 hover:text-sky-300 font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <button
                      type="button"
                      onClick={clearAllDestinations}
                      className="text-[10px] text-slate-400 hover:text-slate-300"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {destinations.length === 0 ? (
                  <div className="p-4 rounded-lg bg-[#131722] border border-white/[0.08] text-center text-xs text-slate-400">
                    No destinations available in database. Add channels first under Channels &amp; Groups.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 p-2 rounded-lg bg-[#131722] border border-white/[0.08]">
                    {destinations.map((dest) => {
                      const isSelected = selectedDestIds.includes(dest._id);
                      const isChannel = dest.type === 'channel';

                      return (
                        <div
                          key={dest._id}
                          onClick={() => toggleDestination(dest._id)}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-md cursor-pointer transition-all border ${
                            isSelected
                              ? 'bg-sky-500/10 border-sky-500/30 text-white'
                              : 'bg-transparent border-transparent hover:bg-white/[0.03] text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs shrink-0">{isChannel ? '📢' : '👥'}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate leading-tight">
                                {dest.displayName || dest.title}
                              </p>
                              <p className="text-[10px] font-mono text-slate-500 truncate">
                                {dest.telegramChatId}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {dest.verification?.canPublish && (
                              <Badge variant="success" size="xs">
                                Verified
                              </Badge>
                            )}
                            <div
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-sky-600 text-white'
                                  : 'border border-white/[0.20]'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span>
                    Selected targets:{' '}
                    <strong className="text-sky-300 font-mono">
                      {selectedDestIds.length}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <Button type="button" variant="ghost" size="sm" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving Category...'
                    : editingCategory
                    ? 'Save Changes'
                    : 'Create Category'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      <ConfirmModal
        isOpen={!!categoryToArchive}
        onClose={() => setCategoryToArchive(null)}
        onConfirm={() => {
          if (categoryToArchive) {
            archiveMutation.mutate(categoryToArchive._id);
          }
        }}
        title="Archive Category?"
        description={`Are you sure you want to archive "${categoryToArchive?.name}"? Automated forward rules mapped to this category will be suspended.`}
        confirmText="Archive Category"
        variant="warning"
        isLoading={archiveMutation.isPending}
      />

      {/* Move to Trash Confirmation Modal (48-hour recovery) */}
      <ConfirmModal
        isOpen={!!categoryToTrash}
        onClose={() => setCategoryToTrash(null)}
        onConfirm={() => {
          if (categoryToTrash) {
            trashMutation.mutate(categoryToTrash._id);
          }
        }}
        title="Move Category to Trash?"
        description={`"${categoryToTrash?.name}" will be moved to Trash. It will be kept safely for 48 hours, where you can restore it anytime before it is automatically and permanently purged.`}
        confirmText="Move to Trash"
        variant="danger"
        isLoading={trashMutation.isPending}
      />

      {/* Permanent Purge Confirmation Modal */}
      <ConfirmModal
        isOpen={!!categoryToPermanentDelete}
        onClose={() => setCategoryToPermanentDelete(null)}
        onConfirm={() => {
          if (categoryToPermanentDelete) {
            permanentDeleteMutation.mutate(categoryToPermanentDelete._id);
          }
        }}
        title="Permanently Delete Category?"
        description={`Are you sure you want to permanently delete "${categoryToPermanentDelete?.name}"? This action CANNOT be undone and this category will be wiped from the system.`}
        confirmText="Delete Permanently"
        variant="danger"
        isLoading={permanentDeleteMutation.isPending}
      />
    </div>
  );
};
