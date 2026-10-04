import React, { useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  FileCode,
  Quote,
  EyeOff,
  Link as LinkIcon,
  ShieldAlert,
} from 'lucide-react';

interface RichFormatToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  text: string;
  setText: (val: string) => void;
}

export const RichFormatToolbar: React.FC<RichFormatToolbarProps> = ({
  textareaRef,
  text,
  setText,
}) => {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');

  const applyTag = (openTag: string, closeTag: string, placeholder = 'text') => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = text.substring(start, end);

    let replacement: string;
    let newCursorPos: number;

    if (selected.length > 0) {
      replacement = `${openTag}${selected}${closeTag}`;
      newCursorPos = start + replacement.length;
    } else {
      replacement = `${openTag}${placeholder}${closeTag}`;
      newCursorPos = start + openTag.length + placeholder.length;
    }

    const newText = text.substring(0, start) + replacement + text.substring(end);
    setText(newText);

    // Restore cursor position
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleInsertLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;

    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = text.substring(start, end) || 'link';

    const replacement = `<a href="${linkUrl.trim()}">${selected}</a>`;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    setText(newText);
    setShowLinkModal(false);
    setLinkUrl('https://');

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 0);
  };

  const escapeHtmlEntities = () => {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    setText(escaped);
  };

  return (
    <div className="flex items-center gap-1 p-2 bg-[#0c101c]/95 border-b border-white/[0.08] rounded-t-xl select-none overflow-x-auto no-scrollbar sm:flex-wrap">
      <div className="flex items-center gap-1 border-r border-white/[0.1] pr-2 mr-1 shrink-0">
        <button
          type="button"
          onClick={() => applyTag('<b>', '</b>', 'bold')}
          title="Bold (<b>)"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => applyTag('<i>', '</i>', 'italic')}
          title="Italic (<i>)"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => applyTag('<u>', '</u>', 'underline')}
          title="Underline (<u>)"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <Underline className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => applyTag('<s>', '</s>', 'strikethrough')}
          title="Strikethrough (<s>)"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 border-r border-slate-700/60 pr-2 mr-1">
        <button
          type="button"
          onClick={() => applyTag('<tg-spoiler>', '</tg-spoiler>', 'spoiler')}
          title="Telegram Spoiler (<tg-spoiler>)"
          className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1 text-xs font-medium"
        >
          <EyeOff className="w-4 h-4" />
          <span>Spoiler</span>
        </button>
        <button
          type="button"
          onClick={() => applyTag('<code>', '</code>', 'code')}
          title="Inline Code (<code>)"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <Code className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => applyTag('<pre>', '</pre>', 'code block')}
          title="Preformatted Code Block (<pre>)"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <FileCode className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => applyTag('<blockquote>', '</blockquote>', 'quote')}
          title="Blockquote (<blockquote>)"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <Quote className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setShowLinkModal(true)}
          title="Insert Link"
          className="p-1.5 text-sky-400 hover:text-sky-300 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1 text-xs"
        >
          <LinkIcon className="w-4 h-4" />
          <span>Link</span>
        </button>

        <button
          type="button"
          onClick={escapeHtmlEntities}
          title="Escape raw <, >, & characters so Telegram never throws entity parse errors"
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1 text-xs"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Sanitize</span>
        </button>
      </div>

      {showLinkModal && (
        <div className="absolute inset-x-4 top-14 z-50 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl animate-in fade-in zoom-in-95">
          <form onSubmit={handleInsertLink} className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-300">Insert Telegram Hyperlink:</span>
            <div className="flex gap-2">
              <input
                type="url"
                required
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-md shadow-sm transition-colors"
              >
                Insert
              </button>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="px-2 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
