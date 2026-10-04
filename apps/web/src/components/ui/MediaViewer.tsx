import React, { useState } from 'react';
import { Video, FileText, Music, ExternalLink, Eye, X } from 'lucide-react';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { API_BASE_URL } from '../../services/api';

export interface MediaItemLike {
  fileId: string;
  fileUniqueId?: string;
  mediaType: 'photo' | 'video' | 'document' | 'audio' | string;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  caption?: string | null;
  previewUrl?: string | null;
}

interface MediaViewerProps {
  mediaItems?: MediaItemLike[] | null;
  className?: string;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ mediaItems, className = '' }) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useLockBodyScroll(Boolean(selectedPhoto));

  if (!mediaItems || mediaItems.length === 0) return null;

  const getMediaUrl = (item: MediaItemLike) => {
    if (item.previewUrl && !item.previewUrl.startsWith('blob:')) {
      return item.previewUrl;
    }
    const token = localStorage.getItem('token');
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${API_BASE_URL}/media/file/${encodeURIComponent(item.fileId)}${tokenQuery}`;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span>ATTACHED MEDIA ({mediaItems.length})</span>
        <span className="text-[10px] text-slate-500">Tap to inspect / open</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {mediaItems.map((item, idx) => {
          const url = getMediaUrl(item);
          const isPhoto = item.mediaType === 'photo';
          const isVideo = item.mediaType === 'video';
          const isAudio = item.mediaType === 'audio';

          if (isPhoto) {
            return (
              <div
                key={item.fileUniqueId || item.fileId || idx}
                className="group relative rounded-xl overflow-hidden bg-[#090d16] border border-white/[0.08] hover:border-sky-500/40 transition-all cursor-pointer aspect-video flex items-center justify-center shadow-md"
                onClick={() => setSelectedPhoto(url)}
              >
                <img
                  src={url}
                  alt={item.fileName || `Photo #${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    // Fallback to icon if Telegram link expired
                    (e.currentTarget as HTMLElement).style.display = 'none';
                    e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                  }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium backdrop-blur-[2px]">
                  <Eye className="w-4 h-4 text-sky-400" />
                  <span>Preview</span>
                </div>
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[9px] font-mono text-slate-200 border border-white/[0.1]">
                  Photo #{idx + 1}
                </div>
              </div>
            );
          }

          return (
            <div
              key={item.fileUniqueId || item.fileId || idx}
              className="group p-2.5 rounded-xl bg-[#090d16] border border-white/[0.08] hover:border-sky-500/40 transition-all flex flex-col justify-between space-y-2 shadow-md"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#141824] border border-white/[0.08] flex items-center justify-center shrink-0">
                  {isVideo ? (
                    <Video className="w-4 h-4 text-purple-400" />
                  ) : isAudio ? (
                    <Music className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <FileText className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-200 truncate" title={item.fileName || item.mediaType}>
                    {item.fileName || `${item.mediaType.toUpperCase()} #${idx + 1}`}
                  </p>
                  {item.fileSize && (
                    <p className="text-[10px] font-mono text-slate-400">
                      {(item.fileSize / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  )}
                </div>
              </div>

              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-1 px-2 rounded-lg bg-[#141824] hover:bg-[#1f2438] text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center justify-center gap-1.5 border border-white/[0.06] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <span>Open File</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal for Photo inspection */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              <a
                href={selectedPhoto}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs font-medium flex items-center gap-1.5 border border-white/[0.15] backdrop-blur-md transition-colors"
              >
                <span>Full Resolution</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white border border-white/[0.15] backdrop-blur-md transition-colors"
                title="Close Lightbox"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={selectedPhoto}
              alt="Full preview"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain border border-white/[0.1] shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
