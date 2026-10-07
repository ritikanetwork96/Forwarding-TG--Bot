import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  CheckSquare,
  Square,
  MinusSquare,
  Layers,
  Radio,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { DestinationService } from '../../services/destination.service';
import { DestinationGroupService } from '../../services/destination-group.service';
import type {
  DestinationDTO,
  DestinationGroupWithDestinationsDTO,
} from '@telegram-forwarder/shared';

export interface DestinationSelectorProps {
  selectedDestinationIds: string[];
  selectedGroupIds?: string[];
  onChange: (params: { destinationIds: string[]; groupIds: string[] }) => void;
  disabled?: boolean;
  className?: string;
  error?: string | null;
}

export const DestinationSelector: React.FC<DestinationSelectorProps> = ({
  selectedDestinationIds,
  selectedGroupIds = [],
  onChange,
  disabled = false,
  className = '',
  error = null,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch all destinations
  const { data: destinations = [], isLoading: isLoadingDestinations } = useQuery<DestinationDTO[]>({
    queryKey: ['destinations'],
    queryFn: () => DestinationService.list(),
  });

  // 2. Fetch destination groups with populated member destinations
  const { data: groups = [], isLoading: isLoadingGroups } = useQuery<
    DestinationGroupWithDestinationsDTO[]
  >({
    queryKey: ['destination-groups-populated'],
    queryFn: () => DestinationGroupService.list('active', true),
  });

  // Map for fast destination lookup
  const destinationMap = useMemo(() => {
    const map = new Map<string, DestinationDTO>();
    destinations.forEach((d) => map.set(d._id, d));
    return map;
  }, [destinations]);

  // Verified / publishable destinations
  const verifiedDestinations = useMemo(() => {
    return destinations.filter((d) => d.status === 'active' && d.verification?.canPublish);
  }, [destinations]);

  // Filtered groups based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description && g.description.toLowerCase().includes(q))
    );
  }, [groups, searchQuery]);

  // Filtered individual destinations based on search
  const filteredDestinations = useMemo(() => {
    if (!searchQuery.trim()) return destinations;
    const q = searchQuery.toLowerCase();
    return destinations.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.username && d.username.toLowerCase().includes(q)) ||
        d.telegramChatId.includes(q)
    );
  }, [destinations, searchQuery]);

  // Check group selection status: 'all' | 'some' | 'none'
  const getGroupSelectionState = (
    group: DestinationGroupWithDestinationsDTO
  ): 'all' | 'some' | 'none' => {
    const validGroupDestIds = (group.destinationIds || []).filter((id) => {
      const dest = destinationMap.get(id);
      return dest && dest.status === 'active' && dest.verification?.canPublish;
    });

    if (validGroupDestIds.length === 0) return 'none';

    const selectedCount = validGroupDestIds.filter((id) =>
      selectedDestinationIds.includes(id)
    ).length;

    if (selectedCount === 0) return 'none';
    if (selectedCount === validGroupDestIds.length) return 'all';
    return 'some';
  };

  // Toggle group selection
  const handleToggleGroup = (group: DestinationGroupWithDestinationsDTO) => {
    if (disabled) return;

    const state = getGroupSelectionState(group);
    const validGroupDestIds = (group.destinationIds || []).filter((id) => {
      const dest = destinationMap.get(id);
      return dest && dest.status === 'active' && dest.verification?.canPublish;
    });

    const newDestIds = new Set(selectedDestinationIds);
    const newGroupIds = new Set(selectedGroupIds);

    if (state === 'all') {
      // Deselect all member destinations of this group
      validGroupDestIds.forEach((id) => newDestIds.delete(id));
      newGroupIds.delete(group._id);
    } else {
      // Select all member destinations of this group
      validGroupDestIds.forEach((id) => newDestIds.add(id));
      newGroupIds.add(group._id);
    }

    onChange({
      destinationIds: Array.from(newDestIds),
      groupIds: Array.from(newGroupIds),
    });
  };

  // Toggle individual destination
  const handleToggleDestination = (dest: DestinationDTO) => {
    if (disabled) return;
    const isVerified = dest.status === 'active' && dest.verification?.canPublish;
    if (!isVerified) return; // Cannot select unverified destinations for publishing

    const newDestIds = new Set(selectedDestinationIds);
    if (newDestIds.has(dest._id)) {
      newDestIds.delete(dest._id);
    } else {
      newDestIds.add(dest._id);
    }

    // Re-evaluate group IDs based on selection
    const newGroupIds = new Set<string>();
    groups.forEach((g) => {
      const validGroupDestIds = (g.destinationIds || []).filter((id) => {
        const d = destinationMap.get(id);
        return d && d.status === 'active' && d.verification?.canPublish;
      });
      if (validGroupDestIds.length > 0 && validGroupDestIds.every((id) => newDestIds.has(id))) {
        newGroupIds.add(g._id);
      }
    });

    onChange({
      destinationIds: Array.from(newDestIds),
      groupIds: Array.from(newGroupIds),
    });
  };

  // Select all verified destinations
  const handleSelectAllVerified = () => {
    if (disabled) return;
    const allVerifiedIds = verifiedDestinations.map((d) => d._id);
    const allGroupIds = groups.map((g) => g._id);

    onChange({
      destinationIds: allVerifiedIds,
      groupIds: allGroupIds,
    });
  };

  // Clear all selections
  const handleClearAll = () => {
    if (disabled) return;
    onChange({
      destinationIds: [],
      groupIds: [],
    });
  };

  const isLoading = isLoadingDestinations || isLoadingGroups;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search & Global Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels, groups, or handles (@)..."
            disabled={disabled}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900/90 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleSelectAllVerified}
            disabled={disabled || verifiedDestinations.length === 0}
            className="flex-1 sm:flex-none px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-lg border border-sky-500/20 transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap active:scale-[0.97]"
          >
            Select All Verified ({verifiedDestinations.length})
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={disabled || selectedDestinationIds.length === 0}
            className="px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap active:scale-[0.97]"
          >
            Clear Selection
          </button>
        </div>
      </div>

      {/* Counter & Target Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3 py-2 bg-[#090e1a] border border-white/[0.08] rounded-xl text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-300">Selected Targets:</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30">
            {selectedDestinationIds.length} Channels
          </span>
          {selectedGroupIds.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              {selectedGroupIds.length} Groups
            </span>
          )}
        </div>

        <span className="text-[10px] sm:text-[11px] text-slate-500">
          Only verified channels receive broadcasts
        </span>
      </div>

      {/* Tier 1: Reusable Destination Groups */}
      {filteredGroups.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Destination Groups ({filteredGroups.length})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredGroups.map((group) => {
              const state = getGroupSelectionState(group);
              const activeCount = group.activeCount || 0;
              const totalCount = group.destinationCount || (group.destinationIds || []).length;

              return (
                <div
                  key={group._id}
                  onClick={() => handleToggleGroup(group)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                    state === 'all'
                      ? 'bg-indigo-950/30 border-indigo-500/50 shadow-sm shadow-indigo-500/10'
                      : state === 'some'
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/90'
                  } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="mt-0.5 text-indigo-400 flex-shrink-0">
                    {state === 'all' ? (
                      <CheckSquare className="w-4 h-4 text-sky-400" />
                    ) : state === 'some' ? (
                      <MinusSquare className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-xs text-slate-200 truncate">
                        {group.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 flex-shrink-0">
                        {activeCount}/{totalCount}
                      </span>
                    </div>
                    {group.description && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tier 2: Individual Telegram Destinations */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider uppercase text-slate-400">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-sky-400" />
            <span>Individual Channels & Chats ({filteredDestinations.length})</span>
          </div>
          {searchQuery && (
            <span className="text-[10px] lowercase text-slate-500">
              filtered by "{searchQuery}"
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-lg border border-slate-800">
            Loading destinations and groups...
          </div>
        ) : filteredDestinations.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-lg border border-slate-800">
            No matching destinations found.
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto pr-1 space-y-1 rounded-lg border border-slate-800/80 bg-slate-950/40 p-1.5 custom-scrollbar">
            {filteredDestinations.map((dest) => {
              const isSelected = selectedDestinationIds.includes(dest._id);
              const isVerified = dest.status === 'active' && dest.verification?.canPublish;
              const hasMissingPerms = dest.status === 'permission_missing';

              return (
                <div
                  key={dest._id}
                  onClick={() => handleToggleDestination(dest)}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-all ${
                    !isVerified
                      ? 'opacity-50 cursor-not-allowed bg-slate-900/20 border-slate-900'
                      : isSelected
                        ? 'bg-sky-950/30 border-sky-500/40 cursor-pointer shadow-sm shadow-sky-500/5'
                        : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-900/80 hover:border-slate-700 cursor-pointer'
                  } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-200 truncate">
                          {dest.displayName || dest.title}
                        </span>
                        {dest.username && (
                          <span className="text-[11px] text-slate-500 truncate">
                            @{dest.username}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                        <span>ID: {dest.telegramChatId}</span>
                        <span>•</span>
                        <span>{dest.type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status & Identity Pills */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {dest.type === 'private'
                        ? 'Direct Subscriber'
                        : dest.verification?.senderIdentity === 'channel' || dest.type === 'channel'
                          ? 'Channel Identity'
                          : dest.verification?.senderIdentity === 'anonymous_admin'
                            ? 'Anonymous Admin'
                            : 'Bot Identity'}
                    </span>
                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    ) : hasMissingPerms ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <AlertTriangle className="w-3 h-3" />
                        <span className="hidden sm:inline">Permissions Missing</span>
                        <span className="sm:hidden">Missing</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-3 h-3" />
                        <span className="hidden sm:inline">Invalid / Kicked</span>
                        <span className="sm:hidden">Invalid</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
    </div>
  );
};
