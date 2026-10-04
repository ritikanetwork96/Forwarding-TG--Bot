import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  Video,
  FileText,
  X,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import type { MediaItem } from '@telegram-forwarder/shared';
import { MediaService } from '../../services/media.service';

export interface ComposerMediaItem extends MediaItem {
  id: string; // client temporary ID
  previewUrl?: string;
  isUploading?: boolean;
  uploadError?: string;
  rawFile?: File;
}

interface MediaDropzoneProps {
  items: ComposerMediaItem[];
  setItems: React.Dispatch<React.SetStateAction<ComposerMediaItem[]>>;
  maxItems?: number;
}

export const MediaDropzone: React.FC<MediaDropzoneProps> = ({ items, setItems, maxItems = 10 }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadSingleFile = async (clientId: string, file: File) => {
    try {
      const uploadResult = await MediaService.upload(file);
      setItems((prev) =>
        prev.map((item) =>
          item.id === clientId
            ? {
                ...item,
                fileId: uploadResult.fileId,
                fileUniqueId: uploadResult.fileUniqueId,
                width: uploadResult.width,
                height: uploadResult.height,
                isUploading: false,
                uploadError: undefined,
              }
            : item
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setItems((prev) =>
        prev.map((item) =>
          item.id === clientId
            ? {
                ...item,
                isUploading: false,
                uploadError: msg,
              }
            : item
        )
      );
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setDragError(null);

    const availableSlots = maxItems - items.length;
    if (availableSlots <= 0) {
      setDragError(`Maximum ${maxItems} media items allowed per post`);
      return;
    }

    const filesToUpload = Array.from(fileList).slice(0, availableSlots);

    // Process each file
    for (const file of filesToUpload) {
      const clientId = `tmp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const inferredType = isImage ? 'photo' : isVideo ? 'video' : 'document';

      // Instant client blob preview
      const blobUrl = isImage ? URL.createObjectURL(file) : undefined;

      const placeholderItem: ComposerMediaItem = {
        id: clientId,
        mediaType: inferredType,
        fileId: '',
        fileUniqueId: '',
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        previewUrl: blobUrl,
        isUploading: true,
        rawFile: file,
      };

      setItems((prev) => [...prev, placeholderItem]);

      // Upload in background
      uploadSingleFile(clientId, file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const moveItem = (index: number, direction: 'left' | 'right') => {
    setItems((prev) => {
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleRetry = (item: ComposerMediaItem) => {
    if (!item.rawFile) return;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isUploading: true, uploadError: undefined } : i))
    );
    uploadSingleFile(item.id, item.rawFile);
  };

  return (
    <div className="space-y-3">
      {/* Upload Drop Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col sm:flex-row items-center justify-between p-4 sm:p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 shadow-sm ${
          isDragOver
            ? 'border-sky-400 bg-sky-500/15 scale-[1.01]'
            : 'border-white/[0.14] hover:border-sky-500/50 bg-[#090e1a]/90 hover:bg-[#0d1526]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        <div className="flex items-center gap-3.5 mb-3 sm:mb-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-inner shrink-0">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              <span className="text-sky-400 underline decoration-sky-500/40 underline-offset-2">
                Choose media
              </span>{' '}
              or drag &amp; drop files here
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              PNG, JPG, WebP, MP4, PDF up to 50MB (Photos up to 10MB) &bull; {items.length} /{' '}
              {maxItems} items attached
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-semibold shadow-sm transition-colors">
            Browse Files / Photos
          </span>
        </div>

        {dragError && (
          <div className="absolute bottom-2 left-4 flex items-center gap-1.5 text-xs text-rose-400 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{dragError}</span>
          </div>
        )}
      </div>

      {/* Thumbnails Gallery */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="group relative rounded-xl border border-white/[0.08] bg-[#0d1526] overflow-hidden shadow-lg shadow-black/20 flex flex-col justify-between"
            >
              {/* Media Thumbnail */}
              <div className="relative aspect-video bg-[#090e1a] flex items-center justify-center overflow-hidden">
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.fileName || 'Media upload'}
                    className="w-full h-full object-cover"
                  />
                ) : item.mediaType === 'video' ? (
                  <div className="flex flex-col items-center justify-center text-purple-400 gap-1">
                    <Video className="w-7 h-7" />
                    <span className="text-[10px] font-mono uppercase tracking-wider">Video</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-amber-400 gap-1">
                    <FileText className="w-7 h-7" />
                    <span className="text-[10px] font-mono uppercase tracking-wider">Document</span>
                  </div>
                )}

                {/* Uploading Overlay */}
                {item.isUploading && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-sky-400 gap-1.5 z-10">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-[10px] font-medium text-slate-200">
                      Uploading to Telegram...
                    </span>
                  </div>
                )}

                {/* Upload Error Overlay */}
                {item.uploadError && (
                  <div className="absolute inset-0 bg-rose-950/95 flex flex-col items-center justify-center text-rose-200 p-2 text-center z-10">
                    <AlertCircle className="w-4 h-4 text-rose-400 mb-1" />
                    <span className="text-[10px] leading-tight font-medium text-rose-300 line-clamp-2">
                      {item.uploadError}
                    </span>
                    {item.rawFile && (
                      <button
                        type="button"
                        onClick={() => handleRetry(item)}
                        className="mt-1.5 flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold shadow-sm"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Retry</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Index badge */}
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/70 text-slate-200 border border-white/10 z-10 backdrop-blur-sm">
                  #{idx + 1}
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  title="Remove media"
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors z-20 backdrop-blur-sm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Meta details footer with Reordering Buttons */}
              <div className="p-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-white/[0.06] bg-[#090e1a]/80">
                <span
                  className="truncate max-w-[85px] font-medium text-slate-300"
                  title={item.fileName}
                >
                  {item.fileName || `Item ${idx + 1}`}
                </span>

                {/* Reorder controls for albums */}
                <div className="flex items-center gap-1">
                  {items.length > 1 && (
                    <>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveItem(idx, 'left')}
                        title="Move left in album"
                        className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === items.length - 1}
                        onClick={() => moveItem(idx, 'right')}
                        title="Move right in album"
                        className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <span className="text-[10px] font-mono text-slate-500">
                    {formatFileSize(item.fileSize)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
