import React, { useState } from 'react';
import {
  Smartphone,
  Monitor,
  Eye,
  CheckCheck,
  Share2,
  FileText,
  Video,
  CheckCircle2,
} from 'lucide-react';
import type { ComposerMediaItem } from './MediaDropzone';

interface TelegramChatPreviewProps {
  channelTitle?: string;
  channelUsername?: string;
  publishMode: 'copy' | 'forward';
  text: string;
  mediaItems: ComposerMediaItem[];
  senderIdentity?: string;
}

export const TelegramChatPreview: React.FC<TelegramChatPreviewProps> = ({
  channelTitle = 'Channel Announcements',
  channelUsername = 'channel_news',
  publishMode,
  text,
  mediaItems,
  senderIdentity = 'Official Bot',
}) => {
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'desktop'>('mobile');
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<number, boolean>>({});

  // Formatter for Telegram HTML
  const renderFormattedHtml = (rawHtml: string) => {
    if (!rawHtml.trim()) {
      return (
        <span className="text-slate-500 italic text-sm">
          Start typing to see live Telegram message preview...
        </span>
      );
    }

    // Split text by tg-spoiler to render interactive spoilers
    const spoilerRegex = /<tg-spoiler>([\s\S]*?)<\/tg-spoiler>/gi;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let spoilerIndex = 0;

    while ((match = spoilerRegex.exec(rawHtml)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        const textBefore = rawHtml.substring(lastIndex, matchIndex);
        parts.push(
          <span key={`text_${lastIndex}`} dangerouslySetInnerHTML={{ __html: textBefore }} />
        );
      }

      const spoilerContent = match[1];
      const currentIndex = spoilerIndex++;
      const isRevealed = revealedSpoilers[currentIndex];

      parts.push(
        <span
          key={`spoiler_${currentIndex}`}
          onClick={() =>
            setRevealedSpoilers((prev) => ({
              ...prev,
              [currentIndex]: !prev[currentIndex],
            }))
          }
          className={`cursor-pointer transition-all duration-200 select-none rounded px-1 py-0.5 inline-block ${
            isRevealed
              ? 'bg-amber-500/20 text-amber-200'
              : 'bg-slate-700/80 text-transparent blur-[3px] hover:blur-[1.5px]'
          }`}
          title={isRevealed ? 'Click to hide spoiler' : 'Click to reveal spoiler'}
          dangerouslySetInnerHTML={{ __html: spoilerContent }}
        />
      );

      lastIndex = spoilerRegex.lastIndex;
    }

    if (lastIndex < rawHtml.length) {
      parts.push(
        <span
          key={`text_tail`}
          dangerouslySetInnerHTML={{ __html: rawHtml.substring(lastIndex) }}
        />
      );
    }

    return parts;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/80 border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl">
      {/* Simulator Device Switcher Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-300">Live Telegram Simulator</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setDeviceMode('mobile')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
              deviceMode === 'mobile'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode('desktop')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
              deviceMode === 'desktop'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Desktop</span>
          </button>
        </div>
      </div>

      {/* Telegram Wallpaper Background Canvas */}
      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center bg-[#0d141e] bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
        <div
          className={`transition-all duration-300 w-full ${
            deviceMode === 'mobile' ? 'max-w-[370px]' : 'max-w-[540px]'
          }`}
        >
          {/* Telegram Channel Chat Bubble Container */}
          <div className="relative rounded-2xl bg-[#182533] border border-[#243447] shadow-xl overflow-hidden text-slate-100">
            {/* Channel Top Attribution / Header */}
            <div className="px-3.5 pt-3 pb-1 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-500 flex items-center justify-center font-bold text-xs text-white shadow-sm">
                {channelTitle.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <h4 className="text-xs font-semibold text-sky-400 truncate">{channelTitle}</h4>
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0 fill-sky-400/20" />
                </div>
                <p className="text-[10px] text-slate-400 truncate">@{channelUsername}</p>
              </div>
            </div>

            {/* Forward Mode Attribution Header */}
            {publishMode === 'forward' && (
              <div className="mx-3.5 mt-1.5 px-2.5 py-1 rounded bg-[#1f2d3d] border-l-2 border-sky-400 flex items-center gap-2 text-[11px] text-sky-300">
                <Share2 className="w-3 h-3 text-sky-400" />
                <span>
                  Forwarded from <span className="font-semibold text-white">{channelTitle}</span>
                </span>
              </div>
            )}

            {/* Media Gallery in Chat Bubble */}
            {mediaItems.length > 0 && (
              <div className="mt-2 px-2">
                {mediaItems.length === 1 ? (
                  // Single Media Item
                  <div className="rounded-xl overflow-hidden bg-black/40 max-h-[300px] flex items-center justify-center">
                    {mediaItems[0].previewUrl ? (
                      <img
                        src={mediaItems[0].previewUrl}
                        alt="Telegram preview"
                        className="w-full h-auto max-h-[300px] object-cover"
                      />
                    ) : mediaItems[0].mediaType === 'video' ? (
                      <div className="p-8 flex flex-col items-center gap-2 text-purple-300">
                        <Video className="w-10 h-10" />
                        <span className="text-xs font-mono">{mediaItems[0].fileName}</span>
                      </div>
                    ) : (
                      <div className="p-6 flex items-center gap-3 bg-[#1e2c3a] w-full">
                        <FileText className="w-8 h-8 text-sky-400" />
                        <div className="text-xs">
                          <p className="font-medium text-slate-100">{mediaItems[0].fileName}</p>
                          <p className="text-[10px] text-slate-400">Document File</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Multi-Media Album Grid
                  <div
                    className={`grid gap-1 rounded-xl overflow-hidden ${
                      mediaItems.length === 2
                        ? 'grid-cols-2'
                        : mediaItems.length === 3
                          ? 'grid-cols-3'
                          : 'grid-cols-2'
                    }`}
                  >
                    {mediaItems.slice(0, 4).map((m, idx) => (
                      <div
                        key={m.id}
                        className="relative aspect-square bg-black/50 overflow-hidden flex items-center justify-center"
                      >
                        {m.previewUrl ? (
                          <img src={m.previewUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <FileText className="w-6 h-6 text-slate-400" />
                        )}
                        {idx === 3 && mediaItems.length > 4 && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-sm font-bold text-white backdrop-blur-[1px]">
                            +{mediaItems.length - 3}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Post Content Body */}
            <div className="p-3.5 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap break-words [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_pre]:bg-black/40 [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:font-mono [&_pre]:my-1.5 [&_pre]:border [&_pre]:border-white/10 [&_blockquote]:border-l-2 [&_blockquote]:border-sky-400 [&_blockquote]:pl-2.5 [&_blockquote]:my-1 [&_blockquote]:text-slate-300 [&_a]:text-sky-400 [&_a]:underline">
              {renderFormattedHtml(text)}
            </div>

            {/* Telegram Message Footer (Time, Views, Delivery Check) */}
            <div className="px-3.5 pb-2.5 flex items-center justify-end gap-2 text-[10px] text-slate-400 select-none">
              <span className="flex items-center gap-1 text-slate-400 hover:text-slate-300">
                <Eye className="w-3 h-3" />
                <span>1.4k</span>
              </span>
              <span>12:45 PM</span>
              <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
            </div>
          </div>

          {/* Identity & Delivery Capability Pill */}
          <div className="mt-3 flex items-center justify-between px-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50" />
              <span>
                Delivering as:{' '}
                <strong className="text-slate-200 font-semibold">{senderIdentity}</strong>
              </span>
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono border border-slate-700/60 uppercase">
              {publishMode} Mode
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
