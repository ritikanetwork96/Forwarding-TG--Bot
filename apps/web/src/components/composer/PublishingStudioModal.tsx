import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Send,
  Calendar,
  Save,
  Share2,
  Copy,
  Sparkles,
  Check,
  AlertCircle,
  Clock,
  Eye,
  Edit3,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import type { MessageDTO, PublishMode } from '@telegram-forwarder/shared';
import { PostService } from '../../services/post.service';
import { DestinationService } from '../../services/destination.service';
import { PublishService } from '../../services/publish.service';
import { ScheduleService } from '../../services/schedule.service';
import { RichFormatToolbar } from './RichFormatToolbar';
import { MediaDropzone, type ComposerMediaItem } from './MediaDropzone';
import { TelegramChatPreview } from './TelegramChatPreview';
import { DestinationSelector } from '../selector/DestinationSelector';
import { CategorySelector } from '../selector/CategorySelector';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

const DRAFT_STORAGE_KEY = 'tg_forwarder_composer_draft';

interface PublishingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPost?: MessageDTO | null;
  onSuccess?: (message: string) => void;
}

export const PublishingStudioModal: React.FC<PublishingStudioModalProps> = ({
  isOpen,
  onClose,
  initialPost,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Strictly lock background body and html scrolling while composer is open
  useLockBodyScroll(isOpen);

  // Form States
  const [postText, setPostText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [publishMode, setPublishMode] = useState<PublishMode>('copy');
  const [mediaItems, setMediaItems] = useState<ComposerMediaItem[]>([]);
  const [selectedDestIds, setSelectedDestIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Scheduling State
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');

  // Mobile View Tab
  const [activeMobileTab, setActiveMobileTab] = useState<'editor' | 'preview'>('editor');

  // Dialog & Guard States
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [showConfirmPublish, setShowConfirmPublish] = useState(false);
  const [draftRestoredNotice, setDraftRestoredNotice] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Status/Error Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Whether initialPost is already published (requiring new post creation on re-send)
  const isAlreadyPublished = Boolean(
    initialPost &&
      (initialPost.status === 'published' || initialPost.status === 'partially_published')
  );

  // Queries
  const { data: destinations = [] } = useQuery({
    queryKey: ['destinations'],
    queryFn: () => DestinationService.list(),
    enabled: isOpen,
  });

  // Populate initial post data or restore draft when opening modal
  useEffect(() => {
    if (!isOpen) return;

    if (initialPost) {
      setPostText(initialPost.content?.text || '');
      setSelectedCategoryId(initialPost.categoryId || '');
      const existingMedia: ComposerMediaItem[] = (initialPost.content?.mediaItems || []).map(
        (m, idx) => ({
          ...m,
          id: `init_${idx}_${Date.now()}`,
          isUploading: false,
        })
      );
      setMediaItems(existingMedia);

      // Pre-populate previously targeted channels so user can see, uncheck or add new ones
      const previousDests = Array.from(
        new Set([
          ...(initialPost.deliverySummary?.successfulDestinationIds || []),
          ...(initialPost.deliverySummary?.failedDestinationIds || []),
        ])
      );
      setSelectedDestIds(previousDests);
      setSelectedGroupIds([]);
      setIsScheduling(false);
      setScheduleDateTime('');
      setSaveStatus('saved');
      setDraftRestoredNotice(false);
    } else {
      // Check if saved draft exists in localStorage
      try {
        const rawSaved = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (rawSaved) {
          const parsed = JSON.parse(rawSaved);
          if (parsed.postText || (parsed.selectedDestIds && parsed.selectedDestIds.length > 0)) {
            setPostText(parsed.postText || '');
            setSelectedCategoryId(parsed.selectedCategoryId || '');
            setPublishMode(parsed.publishMode || 'copy');
            setSelectedDestIds(parsed.selectedDestIds || []);
            setDraftRestoredNotice(true);
            setSaveStatus('saved');
            return;
          }
        }
      } catch {
        // ignore parse error
      }

      setPostText('');
      setSelectedCategoryId('');
      setPublishMode('copy');
      setMediaItems([]);
      setSelectedDestIds([]);
      setIsScheduling(false);
      setScheduleDateTime('');
      setSaveStatus('saved');
      setDraftRestoredNotice(false);
    }
    setErrorMsg(null);
  }, [initialPost, isOpen]);

  // Dirty State Calculation
  const isDirty = useMemo(() => {
    if (initialPost) {
      const origText = initialPost.content?.text || '';
      const origCat = initialPost.categoryId || '';
      const origMediaCount = initialPost.content?.mediaItems?.length || 0;
      return (
        postText !== origText ||
        selectedCategoryId !== origCat ||
        mediaItems.length !== origMediaCount ||
        selectedDestIds.length > 0
      );
    }
    return (
      postText.trim().length > 0 ||
      mediaItems.length > 0 ||
      selectedDestIds.length > 0 ||
      selectedCategoryId !== ''
    );
  }, [initialPost, postText, selectedCategoryId, mediaItems, selectedDestIds]);

  // Autosave Debounce to LocalStorage (for new draft posts)
  useEffect(() => {
    if (!isOpen || initialPost) return;

    if (!isDirty) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('unsaved');
    const timer = setTimeout(() => {
      setSaveStatus('saving');
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            postText,
            selectedCategoryId,
            publishMode,
            selectedDestIds,
            updatedAt: Date.now(),
          })
        );
        setSaveStatus('saved');
      } catch {
        setSaveStatus('unsaved');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isOpen, initialPost, isDirty, postText, selectedCategoryId, publishMode, selectedDestIds]);

  const handleDiscardSavedDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setPostText('');
    setSelectedCategoryId('');
    setPublishMode('copy');
    setMediaItems([]);
    setSelectedDestIds([]);
    setDraftRestoredNotice(false);
    setSaveStatus('saved');
  };

  // Safe Exit Handler (Unsaved Changes Guard)
  const handleRequestClose = () => {
    if (isDirty) {
      setShowUnsavedPrompt(true);
    } else {
      onClose();
    }
  };

  // Character limit calculations
  const maxCharacters = mediaItems.length > 0 ? 1024 : 4096;
  const currentLength = postText.length;
  const isOverLimit = currentLength > maxCharacters;

  // Mutations
  const executePublishMutation = useMutation({
    mutationFn: async () => {
      // 1. Validate destination count
      if (selectedDestIds.length === 0 && selectedGroupIds.length === 0 && !selectedCategoryId) {
        throw new Error('Please select at least one target channel, group, or content category');
      }

      // Check for ongoing uploads
      if (mediaItems.some((m) => m.isUploading)) {
        throw new Error('Please wait for media uploads to complete before publishing');
      }

      // 2. Prepare media items
      const cleanedMedia = mediaItems
        .filter((m) => m.fileId)
        .map((m) => ({
          mediaType: m.mediaType,
          fileId: m.fileId,
          fileUniqueId: m.fileUniqueId,
          caption: m.caption,
          fileName: m.fileName,
          fileSize: m.fileSize,
          mimeType: m.mimeType,
          width: m.width,
          height: m.height,
        }));

      // Inferred message type
      let messageType: 'text' | 'photo' | 'video' | 'document' | 'album' = 'text';
      if (cleanedMedia.length > 1) {
        messageType = 'album';
      } else if (cleanedMedia.length === 1) {
        messageType =
          cleanedMedia[0].mediaType === 'video'
            ? 'video'
            : cleanedMedia[0].mediaType === 'document'
              ? 'document'
              : 'photo';
      }

      let targetPostId: string;

      // 3. Handle Existing Post Update vs New Post Creation
      // If the post is already published, create a new post rather than updating the historical post (avoiding 400 error)
      if (initialPost && !isAlreadyPublished) {
        targetPostId = initialPost._id;
        await PostService.update(initialPost._id, {
          categoryId: selectedCategoryId || null,
          content: {
            text: postText,
            mediaItems: cleanedMedia,
          },
          status: isScheduling ? 'draft' : 'publishing',
        });
      } else {
        const createdPost = await PostService.create({
          categoryId: selectedCategoryId || undefined,
          messageType,
          content: {
            text: postText,
            mediaItems: cleanedMedia,
          },
          status: isScheduling ? 'draft' : 'publishing',
        });
        targetPostId = createdPost._id;
      }

      // 4. Handle Schedule vs Immediate Dispatch
      if (isScheduling) {
        if (!scheduleDateTime) {
          throw new Error('Please specify a date and time for the scheduled release');
        }

        const scheduledDate = new Date(scheduleDateTime);
        if (scheduledDate.getTime() <= Date.now()) {
          throw new Error('Scheduled time must be in the future');
        }

        await ScheduleService.create({
          messageId: targetPostId,
          destinationIds: selectedDestIds,
          destinationGroupIds: selectedGroupIds,
          publishMode,
          scheduledFor: scheduledDate.toISOString(),
          timezone: 'Asia/Kolkata',
          categoryId: selectedCategoryId || undefined,
        });

        // Clean local draft
        try {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          /* ignore */
        }

        return { scheduled: true, title: 'Post scheduled successfully' };
      }

      // Immediate Publish
      await PublishService.manual({
        messageId: targetPostId,
        destinationIds: selectedDestIds,
        destinationGroupIds: selectedGroupIds,
        categoryIds: selectedCategoryId ? [selectedCategoryId] : undefined,
        publishMode,
      });

      // Clean local draft
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        /* ignore */
      }

      return { scheduled: false, title: 'Post published successfully' };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setShowConfirmPublish(false);
      if (onSuccess) {
        onSuccess(result.title);
      }
      onClose();
    },
    onError: (err: unknown) => {
      setShowConfirmPublish(false);
      setErrorMsg(err instanceof Error ? err.message : 'Operation failed');
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const cleanedMedia = mediaItems
        .filter((m) => m.fileId)
        .map((m) => ({
          mediaType: m.mediaType,
          fileId: m.fileId,
          fileUniqueId: m.fileUniqueId,
          caption: m.caption,
          fileName: m.fileName,
          fileSize: m.fileSize,
          mimeType: m.mimeType,
          width: m.width,
          height: m.height,
        }));

      if (initialPost && !isAlreadyPublished) {
        return PostService.update(initialPost._id, {
          categoryId: selectedCategoryId || null,
          content: {
            text: postText,
            mediaItems: cleanedMedia,
          },
          status: 'draft',
        });
      }

      return PostService.create({
        categoryId: selectedCategoryId || undefined,
        content: {
          text: postText,
          mediaItems: cleanedMedia,
        },
        status: 'draft',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setShowUnsavedPrompt(false);
      if (onSuccess) {
        onSuccess('Post saved as draft');
      }
      onClose();
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save draft');
    },
  });

  // Global Keyboard Shortcut: Ctrl + Enter to Trigger Confirmation / Publish
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isOpen) {
        e.preventDefault();
        if (
          !isOverLimit &&
          selectedDestIds.length > 0 &&
          (postText.trim() || mediaItems.length > 0)
        ) {
          setShowConfirmPublish(true);
        }
      }
      if (e.key === 'Escape' && isOpen) {
        handleRequestClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isOverLimit, selectedDestIds, postText, mediaItems]);

  if (!isOpen) return null;

  // Selected Channel for live preview identity
  const primaryDest = destinations.find((d) => d._id === selectedDestIds[0]);
  const previewChannelTitle = primaryDest?.displayName || primaryDest?.title || 'Target Channel';
  const previewChannelUsername = primaryDest?.username || 'official_channel';

  // Compute Sender Identity text
  const primaryIdentity = primaryDest
    ? primaryDest.type === 'channel' || primaryDest.verification?.senderIdentity === 'channel'
      ? `@${previewChannelUsername} (Channel Identity)`
      : primaryDest.verification?.senderIdentity === 'anonymous_admin'
        ? 'Anonymous Admin'
        : 'Official Bot'
    : 'Official Bot';

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden sm:overflow-y-auto overflow-x-hidden p-0 sm:p-4 md:p-6 bg-[#07080c] sm:bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 flex flex-col items-stretch sm:items-center justify-start sm:justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleRequestClose();
      }}
    >
      <div className="publishing-studio-shell relative w-full max-w-7xl min-h-0 flex-1 sm:flex-none sm:flex-initial max-h-[100dvh] sm:max-h-[90vh] sm:my-auto flex flex-col apple-glass rounded-none sm:rounded-3xl shadow-2xl shadow-black/90 overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/[0.25] before:to-transparent shrink-0">
        {/* Studio Top Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 border-b border-white/[0.08] bg-[#090e1a]/95 backdrop-blur-md shrink-0 safe-area-top">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="hidden sm:flex w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 items-center justify-center text-white shadow-lg shadow-sky-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] sm:text-base font-bold text-slate-100 flex items-center gap-2 font-display tracking-tight">
                  <span>Publishing Studio</span>
                  <span className="hidden sm:inline px-2 py-0.5 text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full uppercase tracking-wider">
                    {initialPost ? (isAlreadyPublished ? 'Re-send / Forward' : 'Edit Post') : 'Composer'}
                  </span>
                </h2>
                <span className="sm:hidden px-2 py-0.5 text-[10px] font-semibold bg-white/[0.06] text-sky-300/90 border border-white/[0.1] rounded-full uppercase tracking-wide">
                  {initialPost ? (isAlreadyPublished ? 'Re-send' : 'Edit') : 'New post'}
                </span>

                {/* Draft / Autosave Status Indicator */}
                {!initialPost && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                      saveStatus === 'saved'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : saveStatus === 'saving'
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 animate-pulse'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {saveStatus === 'saved' && <Check className="w-3 h-3" />}
                    {saveStatus === 'saving' && <Clock className="w-3 h-3 animate-spin" />}
                    <span>
                      {saveStatus === 'saved'
                        ? 'Saved ✓'
                        : saveStatus === 'saving'
                          ? 'Saving...'
                          : 'Unsaved'}
                    </span>
                  </span>
                )}
              </div>
              <p className="hidden sm:block text-xs text-slate-400">
                WYSIWYG Telegram editor with real media uploads and live client preview
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleRequestClose}
              className="hidden sm:inline-flex px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] transition-all"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleRequestClose}
              title="Close Publishing Studio (Esc)"
              className="apple-close-btn sm:ml-0"
              aria-label="Close"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Mobile tab switcher */}
        <div className="md:hidden px-4 py-2.5 border-b border-white/[0.06] bg-[#080d1a]/80 shrink-0">
          <div className="studio-mobile-segment flex bg-[#0a0f1a] p-1 rounded-xl border border-white/[0.06]">
            <button
              type="button"
              data-active={activeMobileTab === 'editor' ? 'true' : 'false'}
              onClick={() => setActiveMobileTab('editor')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeMobileTab === 'editor'
                  ? 'bg-sky-500/20 text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.35)] sm:bg-sky-500 sm:text-white sm:shadow-md'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editor</span>
            </button>
            <button
              type="button"
              data-active={activeMobileTab === 'preview' ? 'true' : 'false'}
              onClick={() => setActiveMobileTab('preview')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeMobileTab === 'preview'
                  ? 'bg-sky-500/20 text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.35)] sm:bg-sky-500 sm:text-white sm:shadow-md'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>
        </div>

        {/* Restored Draft Notice Banner */}
        {draftRestoredNotice && (
          <div className="px-6 py-2 bg-sky-500/10 border-b border-sky-500/20 flex items-center justify-between text-xs text-sky-300">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Restored unsaved draft from your previous session.</span>
            </div>
            <button
              type="button"
              onClick={handleDiscardSavedDraft}
              className="text-xs text-sky-400 hover:text-white underline font-medium"
            >
              Discard Restored Draft
            </button>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Studio Dual-Pane Content Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Pane: Creative Editor (55% on desktop) */}
          <div
            className={`flex-1 md:w-[55%] flex flex-col overflow-y-auto overscroll-contain p-4 sm:p-6 pb-28 sm:pb-8 gap-6 sm:gap-5 border-r border-white/[0.08] bg-[#090e1a]/50 scroll-pb-6 ${
              activeMobileTab === 'preview' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Row 2: Rich HTML Formatting Textarea (first on mobile) */}
            <div
              className={`order-1 md:order-2 flex flex-col relative rounded-2xl border bg-[#0a0f18] overflow-hidden shadow-inner transition-all ${
                isOverLimit
                  ? 'border-rose-500 ring-1 ring-rose-500'
                  : 'border-white/[0.08] focus-within:ring-1 focus-within:ring-sky-500/50 focus-within:border-sky-500/40'
              }`}
            >
              <RichFormatToolbar textareaRef={textareaRef} text={postText} setText={setPostText} />
              <textarea
                ref={textareaRef}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Write your Telegram message or media caption here..."
                rows={5}
                className="w-full p-3.5 text-sm text-slate-100 bg-transparent placeholder-slate-500 focus:outline-none resize-y min-h-[120px] sm:min-h-[140px] leading-relaxed font-sans"
              />

              <div className="flex items-center justify-between px-3.5 py-2 border-t border-white/[0.06] bg-[#0d1526]/80 text-[11px]">
                <span className="text-slate-500">
                  {mediaItems.length > 0 ? 'Caption · max 1,024' : 'Text · max 4,096'}
                </span>
                <span
                  className={`font-mono font-medium ${
                    isOverLimit
                      ? 'text-rose-400 font-bold'
                      : currentLength > maxCharacters * 0.85
                        ? 'text-amber-400'
                        : 'text-slate-400'
                  }`}
                >
                  {currentLength} / {maxCharacters}
                </span>
              </div>
            </div>

            {/* Row 1: Mode & Category Config */}
            <div className="order-2 md:order-1 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3 items-end rounded-2xl sm:rounded-none border border-white/[0.06] sm:border-0 bg-[#0a0f18]/60 sm:bg-transparent p-3.5 sm:p-0">
              {/* Category Selector */}
              <div>
                <CategorySelector
                  selectedCategoryId={selectedCategoryId}
                  onChange={(id) => setSelectedCategoryId(id || '')}
                />
              </div>

              {/* Publish Mode Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Publish Mode
                </label>
                <div className="studio-mode-toggle grid grid-cols-2 gap-1.5 p-1 bg-[#070b14] border border-white/[0.06] rounded-xl">
                  <button
                    type="button"
                    data-active={publishMode === 'copy' ? 'true' : 'false'}
                    onClick={() => setPublishMode('copy')}
                    className={`flex items-center justify-center gap-1.5 py-2 sm:py-1.5 text-xs font-medium rounded-lg transition-all ${
                      publishMode === 'copy'
                        ? 'bg-sky-500/20 text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.3)] sm:bg-sky-600 sm:text-white sm:shadow-sm'
                        : 'text-slate-500 hover:text-slate-300 sm:text-slate-400 sm:hover:text-slate-200'
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </button>
                  <button
                    type="button"
                    data-active={publishMode === 'forward' ? 'true' : 'false'}
                    onClick={() => setPublishMode('forward')}
                    className={`flex items-center justify-center gap-1.5 py-2 sm:py-1.5 text-xs font-medium rounded-lg transition-all ${
                      publishMode === 'forward'
                        ? 'bg-sky-500/20 text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.3)] sm:bg-sky-600 sm:text-white sm:shadow-sm'
                        : 'text-slate-500 hover:text-slate-300 sm:text-slate-400 sm:hover:text-slate-200'
                    }`}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Forward</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Character Limit Exceeded Guidance */}
            {isOverLimit && (
              <div className="order-2 md:order-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  Post exceeds limit by {currentLength - maxCharacters} characters. Telegram{' '}
                  {mediaItems.length > 0
                    ? 'media captions cannot exceed 1,024'
                    : 'text posts cannot exceed 4,096'}{' '}
                  characters. Please trim content to proceed.
                </span>
              </div>
            )}

            {/* Row 3: Real Media Uploader (Dropzone + Touch Picker) */}
            <div className="order-3 md:order-4 rounded-2xl sm:rounded-none border border-white/[0.06] sm:border-0 bg-[#0a0f18]/60 sm:bg-transparent p-3.5 sm:p-0">
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Media &amp; albums
              </label>
              <MediaDropzone items={mediaItems} setItems={setMediaItems} maxItems={10} />
            </div>

            {/* Row 4: Target Destination & Group Picker */}
            <div className="order-4 md:order-5 rounded-2xl sm:rounded-none border border-white/[0.06] sm:border-0 bg-[#0a0f18]/60 sm:bg-transparent p-3.5 sm:p-0">
              <DestinationSelector
                selectedDestinationIds={selectedDestIds}
                selectedGroupIds={selectedGroupIds}
                onChange={({ destinationIds, groupIds }) => {
                  setSelectedDestIds(destinationIds);
                  setSelectedGroupIds(groupIds);
                }}
              />
            </div>

            {/* Row 5: Schedule Toggle */}
            <div className="order-5 md:order-6 p-3.5 bg-[#0a0f18] border border-white/[0.06] rounded-2xl sm:rounded-xl sm:bg-[#090e1a] sm:border-white/[0.08] space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    Schedule for Future Release
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isScheduling}
                  onChange={(e) => setIsScheduling(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 bg-[#0d1526] border-white/20 cursor-pointer"
                />
              </div>

              {isScheduling && (
                <div className="pt-2 border-t border-white/[0.06] flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="datetime-local"
                    value={scheduleDateTime}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                    className="w-full sm:w-auto flex-1 px-3 py-1.5 bg-[#0d1526] border border-white/[0.10] rounded-lg text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <span className="text-[11px] text-slate-400 font-mono">
                    Timezone: Asia/Kolkata
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Pane: Live Telegram Preview Simulator (45% on desktop) */}
          <div
            className={`flex-1 md:w-[45%] flex flex-col p-4 sm:p-6 bg-[#050914] ${
              activeMobileTab === 'editor' ? 'hidden md:flex' : 'flex'
            }`}
          >
            <TelegramChatPreview
              channelTitle={previewChannelTitle}
              channelUsername={previewChannelUsername}
              publishMode={publishMode}
              text={postText}
              mediaItems={mediaItems}
              senderIdentity={primaryIdentity}
            />
          </div>
        </div>

        {/* Studio Bottom Action Bar */}
        <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-3.5 bg-[#090e1a]/95 backdrop-blur-xl border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 shadow-[0_-8px_32px_rgba(0,0,0,0.45)] safe-area-bottom sm:pb-3.5">
          <div className="text-xs text-slate-400 hidden sm:flex items-center gap-2">
            <span>Shortcut:</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[#111c33] border border-white/[0.10] rounded text-slate-300">
              Ctrl + Enter
            </kbd>
            <span>to publish</span>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleRequestClose}
              className="hidden sm:inline-flex px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-xl border border-white/[0.08] transition-all"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => saveDraftMutation.mutate()}
              disabled={
                saveDraftMutation.isPending || (!postText.trim() && mediaItems.length === 0)
              }
              className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-3 sm:py-2.5 text-xs font-semibold text-slate-200 hover:text-white bg-[#111c33] hover:bg-[#162544] rounded-xl border border-white/[0.10] transition-all disabled:opacity-50 shadow-sm whitespace-nowrap active:scale-[0.97]"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveDraftMutation.isPending ? 'Saving...' : 'Save Draft'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmPublish(true)}
              disabled={
                executePublishMutation.isPending ||
                isOverLimit ||
                selectedDestIds.length === 0 ||
                (!postText.trim() && mediaItems.length === 0)
              }
              className={`flex items-center justify-center gap-2 px-4 sm:px-5 py-3 sm:py-2.5 text-xs font-bold text-white rounded-xl shadow-lg transition-all whitespace-nowrap active:scale-[0.97] ${
                isScheduling
                  ? 'bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 shadow-amber-500/20'
                  : 'bg-sky-600 hover:bg-sky-500 shadow-sky-500/25 sm:bg-gradient-to-r sm:from-sky-600 sm:to-indigo-600 sm:hover:from-sky-500 sm:hover:to-indigo-500 sm:shadow-sky-500/20'
              } disabled:opacity-50`}
            >
              {executePublishMutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : isScheduling ? (
                <>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {initialPost?.status === 'pending_approval'
                      ? 'Approve & Schedule'
                      : 'Schedule Release'}
                  </span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {initialPost?.status === 'pending_approval'
                      ? 'Approve & Publish'
                      : 'Publish Now'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pre-Publish Confirmation Dialog (Mobile Sheet) */}
      {showConfirmPublish && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfirmPublish(false);
          }}
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md apple-glass rounded-t-[28px] sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 border border-white/15 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6">
            <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto mb-2 sm:hidden shrink-0" />
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span>Confirm Broadcast Details</span>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmPublish(false)}
                className="apple-close-btn"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-black/40 rounded-2xl border border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Destinations:</span>
                  <span className="font-semibold text-slate-200">
                    {selectedDestIds.length} channel(s) selected
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Publish Mode:</span>
                  <span className="font-semibold text-sky-400 uppercase">{publishMode} Mode</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Sender Identity:</span>
                  <span className="font-semibold text-slate-200">{primaryIdentity}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Release Timing:</span>
                  <span className="font-semibold text-amber-400">
                    {isScheduling ? `Scheduled: ${scheduleDateTime}` : 'Immediate Dispatch'}
                  </span>
                </div>
              </div>

              {mediaItems.length > 0 && (
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {mediaItems.length === 1
                      ? '1 media file attached'
                      : `${mediaItems.length} media items album`}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmPublish(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] rounded-xl transition-all border border-white/[0.08]"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={() => executePublishMutation.mutate()}
                disabled={executePublishMutation.isPending}
                className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 rounded-xl shadow-lg shadow-sky-500/25 transition-all disabled:opacity-50 active:scale-[0.97]"
              >
                {executePublishMutation.isPending ? (
                  <span>Processing...</span>
                ) : isScheduling ? (
                  <span>Confirm &amp; Schedule</span>
                ) : (
                  <span>Confirm &amp; Dispatch</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Guard Dialog (Mobile Sheet) */}
      {showUnsavedPrompt && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUnsavedPrompt(false);
          }}
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm apple-glass rounded-t-[28px] sm:rounded-3xl shadow-2xl p-5 space-y-4 border border-white/15 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">
            <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto mb-2 sm:hidden shrink-0" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Unsaved Changes</h3>
                <p className="text-xs text-slate-400">
                  You have unsaved changes in this post. Would you like to save it as draft before
                  leaving?
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => saveDraftMutation.mutate()}
                disabled={saveDraftMutation.isPending}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-400 rounded-xl shadow-lg shadow-sky-500/25 transition-all active:scale-[0.97]"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save as Draft</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem(DRAFT_STORAGE_KEY);
                  } catch {
                    /* ignore */
                  }
                  setShowUnsavedPrompt(false);
                  onClose();
                }}
                className="w-full py-2.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors active:scale-[0.97]"
              >
                Discard Changes &amp; Exit
              </button>
              <button
                type="button"
                onClick={() => setShowUnsavedPrompt(false)}
                className="w-full py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
