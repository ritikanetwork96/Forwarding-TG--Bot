import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitFork,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Power,
  Layers,
  X,
} from 'lucide-react';
import { RuleService } from '../services/rule.service';
import { SourceService } from '../services/source.service';
import { CategoryService } from '../services/category.service';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { DestinationSelector } from '../components/selector/DestinationSelector';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import type {
  ForwardingRuleDTO,
  PublishMode,
  WorkflowType,
  SourceDTO,
  CategoryDTO,
} from '@telegram-forwarder/shared';

export const RulesPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Modals & form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ForwardingRuleDTO | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<ForwardingRuleDTO | null>(null);

  // Prevent background scrolling when rules modal is open
  useLockBodyScroll(isModalOpen);

  // Form Fields
  const [name, setName] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [selectedDestinationIds, setSelectedDestinationIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [publishMode, setPublishMode] = useState<PublishMode>('copy');
  const [workflowType, setWorkflowType] = useState<WorkflowType>('manual_approval');
  const [priority, setPriority] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Feedback alerts
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Queries
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

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      sourceId: string;
      categoryId?: string | null;
      destinationIds: string[];
      destinationGroupIds: string[];
      publishMode: PublishMode;
      workflowType: WorkflowType;
      priority: number;
      isActive: boolean;
    }) => RuleService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      closeModal();
      setActionSuccess('Forward rule created successfully');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to create forward rule');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: {
      id: string;
      data: {
        name?: string;
        sourceId?: string;
        categoryId?: string | null;
        destinationIds?: string[];
        destinationGroupIds?: string[];
        publishMode?: PublishMode;
        workflowType?: WorkflowType;
        priority?: number;
        isActive?: boolean;
      };
    }) => RuleService.update(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      closeModal();
      setActionSuccess('Forward rule updated successfully');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to update forward rule');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => RuleService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      setRuleToDelete(null);
      setActionSuccess('Forward rule deleted');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to delete forwarding rule');
    },
  });

  const toggleRuleActive = (rule: ForwardingRuleDTO) => {
    updateMutation.mutate({
      id: rule._id,
      data: { isActive: !rule.isActive },
    });
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setName('');
    setSourceId(sources[0]?._id || '');
    setCategoryId('');
    setSelectedDestinationIds([]);
    setSelectedGroupIds([]);
    setPublishMode('copy');
    setWorkflowType('manual_approval');
    setPriority(0);
    setIsActive(true);
    setActionError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: ForwardingRuleDTO) => {
    setEditingRule(rule);
    setName(rule.name);
    setSourceId(rule.sourceId);
    setCategoryId(rule.categoryId || '');
    setSelectedDestinationIds(rule.destinationIds || []);
    setSelectedGroupIds(rule.destinationGroupIds || []);
    setPublishMode(rule.publishMode);
    setWorkflowType(rule.workflowType);
    setPriority(rule.priority || 0);
    setIsActive(rule.isActive);
    setActionError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    if (!sourceId) {
      setActionError('Please select a source chat');
      return;
    }

    if (selectedDestinationIds.length === 0 && selectedGroupIds.length === 0) {
      setActionError('Please select at least one destination or cluster');
      return;
    }

    const payload = {
      name,
      sourceId,
      categoryId: categoryId || null,
      destinationIds: selectedDestinationIds,
      destinationGroupIds: selectedGroupIds,
      publishMode,
      workflowType,
      priority,
      isActive,
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getSourceName = (srcId: string) => {
    const s = sources.find((src: SourceDTO) => src._id === srcId);
    return s ? s.title : 'Any Monitored Source';
  };

  const getCategoryName = (catId?: string | null) => {
    if (!catId) return 'All Categories';
    const c = categories.find((cat: CategoryDTO) => cat._id === catId);
    return c ? c.name : 'Unknown Category';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5 font-display">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0">
              <GitFork className="w-4 h-4" />
            </div>
            <span>Forward Rules</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automate message forwarding from source channels to target channels.
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
            + New Forward Rule
          </Button>
        </div>
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

      {/* Rules Container (Responsive Glass Cards for Mobile + Table for Desktop) */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {isLoadingRules ? (
          <div className="p-16 text-center text-xs text-slate-400 space-y-3">
            <div className="w-6 h-6 rounded-full border-2 border-sky-500/40 border-t-sky-400 animate-spin mx-auto" />
            <p>Loading forward rules...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-400 flex items-center justify-center mx-auto">
              <GitFork className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-200">No Forward Rules Configured</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Create rules to automatically forward messages from monitored source chats to target channels &amp; groups.
              </p>
            </div>
            <Button onClick={openCreateModal} variant="primary" size="sm">
              + Create First Rule
            </Button>
          </div>
        ) : (
          <>
            {/* Mobile View: Vertical Cards */}
            <div className="md:hidden divide-y divide-white/[0.06]">
              {rules.map((rule: ForwardingRuleDTO) => (
                <div key={rule._id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-white text-sm">{rule.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-sky-400 font-semibold bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                          P{rule.priority}
                        </span>
                        <Badge
                          variant={rule.workflowType === 'automatic' ? 'success' : 'warning'}
                          size="xs"
                        >
                          {rule.workflowType === 'automatic' ? 'Automatic' : 'Approval'}
                        </Badge>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleRuleActive(rule)}
                      disabled={updateMutation.isPending}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono uppercase font-semibold transition-colors shrink-0 ${
                        rule.isActive
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-white/[0.08]'
                      }`}
                    >
                      <Power className="w-2.5 h-2.5" />
                      <span>{rule.isActive ? 'Active' : 'Inactive'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-black/20 p-2.5 rounded-xl border border-white/[0.04]">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-slate-500 block">Source</span>
                      <span className="text-slate-300 font-medium truncate block">{getSourceName(rule.sourceId)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono text-slate-500 block">Category</span>
                      <span className="text-sky-400 font-medium truncate block">{getCategoryName(rule.categoryId)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {rule.destinationIds && rule.destinationIds.length > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#131722] border border-white/[0.06] text-slate-300">
                          {rule.destinationIds.length} dests
                        </span>
                      )}
                      {rule.destinationGroupIds && rule.destinationGroupIds.length > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>{rule.destinationGroupIds.length} clusters</span>
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#131722] border border-white/[0.06] text-slate-400">
                        {rule.publishMode === 'copy' ? 'Clean Copy' : 'Quote'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => openEditModal(rule)}
                        className="p-1.5 rounded-lg bg-[#131722] border border-white/[0.08] text-slate-300 hover:text-white"
                        title="Edit Rule"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setRuleToDelete(rule)}
                        className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Full Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0a0c13]/60 text-slate-400 uppercase font-mono text-[10px] border-b border-white/[0.06]">
                  <tr>
                    <th className="px-4 py-3">Rule &amp; Priority</th>
                    <th className="px-4 py-3">Source &amp; Category</th>
                    <th className="px-4 py-3">Targets</th>
                    <th className="px-4 py-3">Relay Mode</th>
                    <th className="px-4 py-3">Workflow</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {rules.map((rule: ForwardingRuleDTO) => (
                    <tr key={rule._id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white">{rule.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Priority:{' '}
                          <span className="text-sky-400 font-semibold">P{rule.priority}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-200 font-medium">
                          {getSourceName(rule.sourceId)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {rule.categoryId ? (
                            <span className="text-sky-400/90">
                              {getCategoryName(rule.categoryId)}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">All categories</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {rule.destinationIds && rule.destinationIds.length > 0 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#131722] border border-white/[0.06] text-slate-300">
                              {rule.destinationIds.length} dest
                              {rule.destinationIds.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {rule.destinationGroupIds && rule.destinationGroupIds.length > 0 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              <span>
                                {rule.destinationGroupIds.length} cluster
                                {rule.destinationGroupIds.length > 1 ? 's' : ''}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#131722] border border-white/[0.06] text-slate-300">
                          {rule.publishMode === 'copy' ? 'Clean Copy' : 'Quote Credit'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={rule.workflowType === 'automatic' ? 'success' : 'warning'}
                          size="xs"
                        >
                          {rule.workflowType === 'automatic' ? 'Automatic' : 'Approval'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRuleActive(rule)}
                          disabled={updateMutation.isPending}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono uppercase font-semibold transition-colors ${
                            rule.isActive
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/40'
                              : 'bg-slate-800 text-slate-400 border border-white/[0.08] hover:bg-slate-700'
                          }`}
                          title="Click to toggle active state"
                        >
                          <Power className="w-2.5 h-2.5" />
                          <span>{rule.isActive ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openEditModal(rule)}
                            className="p-1 rounded bg-[#131722] border border-white/[0.06] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
                            title="Edit Rule"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setRuleToDelete(rule)}
                            className="p-1 rounded bg-[#131722] border border-white/[0.06] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete Rule"
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
          </>
        )}
      </div>

      {/* Create / Edit Rule Modal (Mobile Bottom-Sheet on small devices) */}
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

            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08] mb-4 shrink-0">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 font-display">
                <GitFork className="w-4 h-4 text-sky-400" />
                <span>{editingRule ? 'Edit Forward Rule' : 'Create Forward Rule'}</span>
              </h3>
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

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Inbound News to Broadcast"
                  className="w-full px-3 py-2 bg-[#131722] border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Monitored Inbound Source *
                  </label>
                  <select
                    required
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#131722] border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
                  >
                    {sources.map((s: SourceDTO) => (
                      <option key={s._id} value={s._id}>
                        {s.title} ({s.telegramChatId})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category Filter (Optional)
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#131722] border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors"
                  >
                    <option value="">All Categories (No filter)</option>
                    {categories.map((c: CategoryDTO) => (
                      <option key={c._id} value={c._id}>
                        {c.iconEmoji || '📁'} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Destinations & Clusters */}
              <div>
                <DestinationSelector
                  selectedDestinationIds={selectedDestinationIds}
                  selectedGroupIds={selectedGroupIds}
                  onChange={({ destinationIds, groupIds }) => {
                    setSelectedDestinationIds(destinationIds);
                    setSelectedGroupIds(groupIds);
                  }}
                />
              </div>

              {/* Mode & Workflow */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Relay Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPublishMode('copy')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition-all ${
                        publishMode === 'copy'
                          ? 'bg-[#131722] border-sky-500/60 text-sky-400 font-semibold shadow-sm'
                          : 'bg-[#0e1017] border-white/[0.08] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Clean Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => setPublishMode('forward')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition-all ${
                        publishMode === 'forward'
                          ? 'bg-[#131722] border-sky-500/60 text-sky-400 font-semibold shadow-sm'
                          : 'bg-[#0e1017] border-white/[0.08] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Native Quote
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Workflow</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWorkflowType('manual_approval')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition-all ${
                        workflowType === 'manual_approval'
                          ? 'bg-[#131722] border-amber-500/50 text-amber-400 font-semibold shadow-sm'
                          : 'bg-[#0e1017] border-white/[0.08] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Approval
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkflowType('automatic')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition-all ${
                        workflowType === 'automatic'
                          ? 'bg-[#131722] border-emerald-500/50 text-emerald-400 font-semibold shadow-sm'
                          : 'bg-[#0e1017] border-white/[0.08] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Instant Auto
                    </button>
                  </div>
                </div>
              </div>

              {/* Priority & Active */}
              <div className="grid grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Priority (Higher runs first)
                  </label>
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-[#131722] border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500/80 transition-colors font-mono"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="isActiveCheckbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-white/[0.20] bg-[#131722] text-sky-600 focus:ring-0 w-4 h-4"
                  />
                  <label
                    htmlFor="isActiveCheckbox"
                    className="text-xs font-medium text-slate-300 cursor-pointer select-none"
                  >
                    Rule Active
                  </label>
                </div>
              </div>

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
                    ? 'Saving...'
                    : editingRule
                      ? 'Save Rule'
                      : 'Create Rule'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!ruleToDelete}
        onClose={() => setRuleToDelete(null)}
        onConfirm={() => {
          if (ruleToDelete) {
            deleteMutation.mutate(ruleToDelete._id);
            setRuleToDelete(null);
          }
        }}
        title="Delete Forward Rule?"
        description={`Are you sure you want to delete rule "${ruleToDelete?.name}"? Messages matching this rule will no longer be forwarded.`}
        confirmText="Confirm Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
