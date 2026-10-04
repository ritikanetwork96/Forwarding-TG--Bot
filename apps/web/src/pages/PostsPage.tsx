import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Layers,
  Image as ImageIcon,
  AlertCircle,
  Trash2,
  Radio,
  Plus,
  Edit3,
  Send,
} from 'lucide-react';
import { PostService } from '../services/post.service';
import { PublishService } from '../services/publish.service';
import { CategoryService } from '../services/category.service';
import { PublishingStudioModal } from '../components/composer/PublishingStudioModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { MediaViewer } from '../components/ui/MediaViewer';
import { cn } from '../lib/utils';
import type { MessageDTO, MessageStatus } from '@telegram-forwarder/shared';

export const PostsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending_approval' | 'draft' | 'published' | 'failed'
  >('all');

  // Publishing Studio Modal State
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [studioInitialPost, setStudioInitialPost] = useState<MessageDTO | null>(null);

  // Auto-open composer if ?composer=open or ?new=1
  useEffect(() => {
    if (
      searchParams.get('composer') === 'open' ||
      searchParams.get('new') === 'true' ||
      searchParams.get('new') === '1'
    ) {
      setIsStudioOpen(true);
    }
  }, [searchParams]);

  // Delete modal state
  const [postToDelete, setPostToDelete] = useState<MessageDTO | null>(null);

  // Feedback states
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => PostService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setPostToDelete(null);
      setActionSuccess('Post deleted successfully');
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to delete post');
      setTimeout(() => setActionError(null), 4000);
    },
  });

  // Queries
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: () => PostService.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => CategoryService.list(),
  });

  const categoryMap = new Map(categories.map((c) => [c._id, c]));

  const retryFailedMutation = useMutation({
    mutationFn: (messageId: string) => PublishService.retryFailed(messageId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      setActionSuccess(
        `Retry completed: Status is now ${result.aggregateStatus.toUpperCase()} (${result.newlySuccessfulCount} newly succeeded)`
      );
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Retry failed');
      setTimeout(() => setActionError(null), 5000);
    },
  });



  const getStatusBadge = (status: MessageStatus) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Published
          </span>
        );
      case 'partially_published':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            Partially Published
          </span>
        );
      case 'publishing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            Publishing...
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      case 'pending_approval':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            Pending Approval
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  const pendingApprovalCount = posts.filter(
    (p: MessageDTO) => p.status === 'pending_approval'
  ).length;
  const draftsCount = posts.filter((p: MessageDTO) => p.status === 'draft').length;
  const publishedCount = posts.filter((p: MessageDTO) => p.status === 'published').length;
  const failedCount = posts.filter((p: MessageDTO) => p.status === 'failed').length;

  const displayedPosts =
    statusFilter === 'all' ? posts : posts.filter((p: MessageDTO) => p.status === statusFilter);

  const handleCloseStudio = () => {
    setIsStudioOpen(false);
    setStudioInitialPost(null);
    if (searchParams.has('composer') || searchParams.has('new')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('composer');
      nextParams.delete('new');
      setSearchParams(nextParams, { replace: true });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* SaaS Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
              Posts &amp; Content Inbox
            </h1>
            <Badge variant="brand" size="sm">
              {posts.length} {posts.length === 1 ? 'Post' : 'Posts'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 font-normal leading-relaxed">
            Create, format, and broadcast messages with photos, videos, albums, and schedules across
            your channels.
          </p>
        </div>

        {/* Primary Action Button: Create Post & Upload Media */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setActionError(null);
              setStudioInitialPost(null);
              setIsStudioOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
            rightIcon={<ImageIcon className="w-4 h-4 opacity-80" />}
            className="w-full sm:w-auto justify-center shadow-lg shadow-sky-500/25 active:scale-[0.97]"
          >
            <span>
              <span className="hidden sm:inline">+ Create Post &amp; Upload Media</span>
              <span className="sm:hidden">+ Create New Post</span>
            </span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Quick Metrics Strip */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 overflow-x-auto">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            statusFilter === 'all'
              ? 'bg-[#111c33] text-sky-400 border border-sky-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          All ({posts.length})
        </button>

        <button
          onClick={() => setStatusFilter('pending_approval')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            statusFilter === 'pending_approval'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <span>Pending Approval</span>
          {pendingApprovalCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-400 font-mono">
              {pendingApprovalCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setStatusFilter('draft')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            statusFilter === 'draft'
              ? 'bg-[#111c33] text-white border border-white/[0.14] shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <span>Drafts</span>
          {draftsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/[0.08] text-slate-300 font-mono">
              {draftsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setStatusFilter('published')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            statusFilter === 'published'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <span>Published</span>
          {publishedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-mono">
              {publishedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setStatusFilter('failed')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            statusFilter === 'failed'
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <span>Failed</span>
          {failedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-400 font-mono">
              {failedCount}
            </span>
          )}
        </button>
      </div>

      {/* Action Alerts */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2.5 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5 animate-fade-in shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Posts List */}
      {postsLoading ? (
        <div className="p-12 text-center text-xs text-slate-400 font-mono">
          Loading posts &amp; dispatches...
        </div>
      ) : displayedPosts.length === 0 ? (
        <div className="p-10 sm:p-14 glass-card rounded-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto shadow-sm">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h3 className="font-display text-base font-semibold text-white">
            No posts matching filter
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Ready to broadcast? Click below to open the Publishing Studio and upload photos or
            videos.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setStudioInitialPost(null);
              setIsStudioOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            <span>+ Create First Post</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedPosts.map((post: MessageDTO) => {
            const hasFailedDests =
              post.deliverySummary?.failedDestinationIds &&
              post.deliverySummary.failedDestinationIds.length > 0;

            return (
              <Card
                key={post._id}
                variant="default"
                className={`glass-card glass-card-hover p-4 sm:p-5 space-y-3.5 rounded-2xl relative overflow-hidden transition-all duration-200 ${
                  post.status === 'pending_approval' ? 'ring-1 ring-amber-500/40' : ''
                }`}
              >
                {/* Post Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {getStatusBadge(post.status)}
                    {post.categoryId && categoryMap.get(post.categoryId) && (
                      <span className="flex items-center gap-1 text-[11px] text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded font-medium">
                        {categoryMap.get(post.categoryId)?.iconEmoji || '📁'}{' '}
                        {categoryMap.get(post.categoryId)?.displayName ||
                          categoryMap.get(post.categoryId)?.name}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-400 uppercase bg-[#090e1a] px-2 py-0.5 rounded border border-white/[0.06]">
                      Type: {post.messageType}
                    </span>
                    {post.telegramChatId && (
                      <span className="flex items-center gap-1 text-[11px] text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded font-mono">
                        <Radio className="w-3 h-3" />
                        Source: {post.telegramChatId}{' '}
                        {post.telegramMessageId ? `#${post.telegramMessageId}` : ''}
                      </span>
                    )}
                    {post.content.mediaItems && post.content.mediaItems.length > 1 && (
                      <span className="flex items-center gap-1 text-[11px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded font-mono">
                        <Layers className="w-3 h-3" />
                        Album ({post.content.mediaItems.length} items)
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                    Created: {new Date(post.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Inbound Approval Queue Notice */}
                {post.status === 'pending_approval' && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        <strong>Inbound Approval Queue:</strong> Arrived from monitored source
                        channel and awaiting moderation.
                      </span>
                    </div>
                    <Button
                      variant="primary"
                      size="xs"
                      onClick={() => {
                        setStudioInitialPost(post);
                        setIsStudioOpen(true);
                      }}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      className="bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20 shrink-0"
                    >
                      <span>Review &amp; Approve</span>
                    </Button>
                  </div>
                )}

                {/* Edited at source warning */}
                {post.isEditedAtSource && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      <strong>Edited at Source:</strong> This post was modified in the source
                      Telegram channel
                      {post.sourceEditedAt
                        ? ` at ${new Date(post.sourceEditedAt).toLocaleTimeString()}`
                        : ''}
                      .
                    </span>
                  </div>
                )}

                {/* Content preview */}
                <div className="space-y-2.5">
                  {post.content.text && (
                    <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {post.content.text}
                    </p>
                  )}

                  {post.content.mediaItems && post.content.mediaItems.length > 0 && (
                    <div className="pt-1">
                      <MediaViewer mediaItems={post.content.mediaItems} />
                    </div>
                  )}
                </div>

                {/* Delivery summary */}
                {post.deliverySummary?.targetCount > 0 && (
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-3 pt-2">
                    <span>Target: {post.deliverySummary.targetCount}</span>
                    <span className="text-emerald-400">
                      Success: {post.deliverySummary.successfulDestinationIds?.length || 0}
                    </span>
                    <span
                      className={
                        post.deliverySummary.failedDestinationIds?.length
                          ? 'text-rose-400 font-bold'
                          : ''
                      }
                    >
                      Failed: {post.deliverySummary.failedDestinationIds?.length || 0}
                    </span>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="pt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <Button
                      variant="danger"
                      size="xs"
                      onClick={() => setPostToDelete(post)}
                      disabled={deleteMutation.isPending}
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      title="Delete Post"
                    >
                      <span>Delete</span>
                    </Button>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap justify-end">
                    {/* Re-send / Forward Action for sent posts */}
                    {post.status === 'published' || post.status === 'partially_published' ? (
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => {
                          setStudioInitialPost(post);
                          setIsStudioOpen(true);
                        }}
                        leftIcon={<Send className="w-3.5 h-3.5" />}
                        title="Open in Publishing Studio to review previous channels and re-send or forward"
                        className="flex-1 sm:flex-none whitespace-nowrap shadow-sm bg-sky-600 hover:bg-sky-500 text-white font-medium"
                      >
                        <span>Re-send / Forward</span>
                      </Button>
                    ) : (
                      <Button
                        variant={post.status === 'pending_approval' ? 'primary' : 'secondary'}
                        size="xs"
                        onClick={() => {
                          setStudioInitialPost(post);
                          setIsStudioOpen(true);
                        }}
                        leftIcon={
                          post.status === 'pending_approval' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Edit3 className="w-3.5 h-3.5" />
                          )
                        }
                        title="Open in Publishing Studio"
                        className={cn(
                          'flex-1 sm:flex-none whitespace-nowrap',
                          post.status === 'pending_approval' &&
                            'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20 text-white font-medium'
                        )}
                      >
                        <span>
                          {post.status === 'pending_approval'
                            ? 'Review & Approve'
                            : 'Open & Edit'}
                        </span>
                      </Button>
                    )}

                    {hasFailedDests && (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => retryFailedMutation.mutate(post._id)}
                        disabled={retryFailedMutation.isPending}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
                        className="flex-1 sm:flex-none whitespace-nowrap"
                      >
                        <span>
                          Retry Failed ({post.deliverySummary.failedDestinationIds.length})
                        </span>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Web Publishing Studio Modal */}
      <PublishingStudioModal
        isOpen={isStudioOpen}
        initialPost={studioInitialPost}
        onClose={handleCloseStudio}
        onSuccess={(msg) => {
          setActionSuccess(msg);
          setTimeout(() => setActionSuccess(null), 3000);
        }}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!postToDelete}
        onClose={() => setPostToDelete(null)}
        onConfirm={() => {
          if (postToDelete) {
            deleteMutation.mutate(postToDelete._id);
          }
        }}
        title="Delete Post"
        description="Are you sure you want to delete this post? This action cannot be undone and will permanently remove the record from MongoDB."
        confirmText={deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
