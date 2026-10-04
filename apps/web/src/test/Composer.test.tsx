import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RichFormatToolbar } from '../components/composer/RichFormatToolbar';
import { TelegramChatPreview } from '../components/composer/TelegramChatPreview';
import { MediaDropzone, type ComposerMediaItem } from '../components/composer/MediaDropzone';
import { PublishingStudioModal } from '../components/composer/PublishingStudioModal';

// Mock Services
vi.mock('../services/destination.service', () => ({
  DestinationService: {
    list: vi.fn().mockResolvedValue([
      {
        _id: 'dest-1',
        title: 'VIP Signals',
        displayName: 'VIP Crypto Signals',
        username: 'cryptovip',
        type: 'channel',
        status: 'active',
        verification: { canPublish: true },
      },
    ]),
  },
}));

vi.mock('../services/category.service', () => ({
  CategoryService: {
    list: vi
      .fn()
      .mockResolvedValue([
        { _id: 'cat-1', name: 'Announcements', displayName: 'Market News', iconEmoji: '📢' },
      ]),
  },
}));

describe('Composer & Publishing Studio Component Suite (Phase 5C)', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  describe('RichFormatToolbar', () => {
    const TestToolbarContainer = () => {
      const ref = useRef<HTMLTextAreaElement>(null);
      const [text, setText] = React.useState('Hello World');

      return (
        <div>
          <RichFormatToolbar textareaRef={ref} text={text} setText={setText} />
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            data-testid="editor-textarea"
          />
        </div>
      );
    };

    it('renders all essential Telegram formatting buttons', () => {
      render(<TestToolbarContainer />);
      expect(screen.getByTitle('Bold (<b>)')).toBeInTheDocument();
      expect(screen.getByTitle('Italic (<i>)')).toBeInTheDocument();
      expect(screen.getByTitle('Telegram Spoiler (<tg-spoiler>)')).toBeInTheDocument();
      expect(screen.getByTitle('Insert Link')).toBeInTheDocument();
      expect(screen.getByText('Sanitize')).toBeInTheDocument();
    });

    it('wraps text with <b> when Bold button is clicked', () => {
      render(<TestToolbarContainer />);
      const boldBtn = screen.getByTitle('Bold (<b>)');
      fireEvent.click(boldBtn);

      const textarea = screen.getByTestId('editor-textarea') as HTMLTextAreaElement;
      expect(textarea.value).toContain('<b>');
      expect(textarea.value).toContain('</b>');
    });

    it('wraps text with <tg-spoiler> when Spoiler button is clicked', () => {
      render(<TestToolbarContainer />);
      const spoilerBtn = screen.getByTitle('Telegram Spoiler (<tg-spoiler>)');
      fireEvent.click(spoilerBtn);

      const textarea = screen.getByTestId('editor-textarea') as HTMLTextAreaElement;
      expect(textarea.value).toContain('<tg-spoiler>');
      expect(textarea.value).toContain('</tg-spoiler>');
    });
  });

  describe('TelegramChatPreview', () => {
    it('renders Telegram channel identity and formatted text', () => {
      render(
        <TelegramChatPreview
          channelTitle="Alpha Signals"
          channelUsername="alpha_signals"
          publishMode="copy"
          text="<b>Exclusive Bitcoin Update</b>: Support held at $94,000."
          mediaItems={[]}
        />
      );

      expect(screen.getByText('Alpha Signals')).toBeInTheDocument();
      expect(screen.getByText('@alpha_signals')).toBeInTheDocument();
      expect(screen.getByText('Exclusive Bitcoin Update')).toBeInTheDocument();
      expect(screen.getByText('1.4k')).toBeInTheDocument();
      expect(screen.getByText('Live Telegram Simulator')).toBeInTheDocument();
    });

    it('renders forward attribution banner when in forward mode', () => {
      render(
        <TelegramChatPreview
          channelTitle="Binance News"
          channelUsername="binance_news"
          publishMode="forward"
          text="Forwarded message content"
          mediaItems={[]}
        />
      );

      expect(screen.getByText(/Forwarded from/i)).toBeInTheDocument();
      expect(screen.getAllByText('Binance News').length).toBeGreaterThanOrEqual(2);
    });

    it('supports device switching between Mobile and Desktop', () => {
      render(
        <TelegramChatPreview
          channelTitle="News"
          channelUsername="news"
          publishMode="copy"
          text="Test content"
          mediaItems={[]}
        />
      );

      const mobileBtn = screen.getByRole('button', { name: /Mobile/i });
      const desktopBtn = screen.getByRole('button', { name: /Desktop/i });

      expect(mobileBtn).toBeInTheDocument();
      expect(desktopBtn).toBeInTheDocument();

      fireEvent.click(desktopBtn);
      // Desktop mode active
      expect(desktopBtn).toHaveClass('bg-sky-600');
    });

    it('reveals interactive spoilers when clicked', () => {
      render(
        <TelegramChatPreview
          channelTitle="Leaks"
          channelUsername="leaks"
          publishMode="copy"
          text="Secret code is <tg-spoiler>PASSWORD123</tg-spoiler>"
          mediaItems={[]}
        />
      );

      const spoilerEl = screen.getByText('PASSWORD123');
      expect(spoilerEl).toBeInTheDocument();
      expect(spoilerEl).toHaveClass('blur-[3px]');

      // Click to reveal
      fireEvent.click(spoilerEl);
      expect(spoilerEl).not.toHaveClass('blur-[3px]');
      expect(spoilerEl).toHaveClass('text-amber-200');
    });
  });

  describe('MediaDropzone', () => {
    it('renders upload instructions and browse prompt', () => {
      render(<MediaDropzone items={[]} setItems={vi.fn()} />);

      expect(screen.getByText(/Choose media/i)).toBeInTheDocument();
      expect(screen.getByText(/drag & drop files here/i)).toBeInTheDocument();
    });

    it('renders attached media items with index badges and remove buttons', () => {
      const mockItems: ComposerMediaItem[] = [
        {
          id: 'item-1',
          mediaType: 'photo',
          fileId: 'file-123',
          fileUniqueId: 'uniq-123',
          fileName: 'chart.png',
          fileSize: 1048576, // 1 MB
          previewUrl: 'blob:http://localhost/fake-blob',
        },
      ];
      const setItems = vi.fn();

      render(<MediaDropzone items={mockItems} setItems={setItems} />);

      expect(screen.getByText('chart.png')).toBeInTheDocument();
      expect(screen.getByText('1.0 MB')).toBeInTheDocument();
      expect(screen.getByText('#1')).toBeInTheDocument();

      const removeBtn = screen.getByTitle('Remove media');
      fireEvent.click(removeBtn);
      expect(setItems).toHaveBeenCalled();
    });

    it('renders reorder controls when multiple media items are attached', () => {
      const mockItems: ComposerMediaItem[] = [
        {
          id: 'item-1',
          mediaType: 'photo',
          fileId: 'file-1',
          fileUniqueId: 'u-1',
          fileName: 'img1.png',
        },
        {
          id: 'item-2',
          mediaType: 'photo',
          fileId: 'file-2',
          fileUniqueId: 'u-2',
          fileName: 'img2.png',
        },
      ];
      const setItems = vi.fn();

      render(<MediaDropzone items={mockItems} setItems={setItems} />);

      const rightBtns = screen.getAllByTitle('Move right in album');
      expect(rightBtns.length).toBeGreaterThan(0);
      fireEvent.click(rightBtns[0]);
      expect(setItems).toHaveBeenCalled();
    });
  });

  describe('PublishingStudioModal', () => {
    it('renders studio dialog title, mode switches, and action buttons', () => {
      renderWithProviders(
        <PublishingStudioModal isOpen={true} onClose={vi.fn()} initialPost={null} />
      );

      expect(screen.getByText('Web Publishing Studio')).toBeInTheDocument();
      expect(screen.getByText('Pro Composer')).toBeInTheDocument();
      expect(screen.getByText('Copy Mode')).toBeInTheDocument();
      expect(screen.getByText('Forward Mode')).toBeInTheDocument();
      expect(screen.getByText('Save Draft')).toBeInTheDocument();
      expect(screen.getByText('Publish Now')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      renderWithProviders(
        <PublishingStudioModal isOpen={false} onClose={vi.fn()} initialPost={null} />
      );

      expect(screen.queryByText('Web Publishing Studio')).not.toBeInTheDocument();
    });

    it('shows dynamic character limits (4,096 max for text, 1,024 for media caption)', () => {
      renderWithProviders(
        <PublishingStudioModal isOpen={true} onClose={vi.fn()} initialPost={null} />
      );

      expect(screen.getByText(/Direct Text Post \(Max 4,096\)/i)).toBeInTheDocument();
      expect(screen.getByText(/0 \/ 4096 chars/i)).toBeInTheDocument();
    });

    it('renders destination sender identity capability badge', async () => {
      renderWithProviders(
        <PublishingStudioModal isOpen={true} onClose={vi.fn()} initialPost={null} />
      );

      expect(await screen.findByText('Channel Identity')).toBeInTheDocument();
    });

    it('shows unsaved changes confirmation dialog when closing with edits', async () => {
      const onClose = vi.fn();
      renderWithProviders(
        <PublishingStudioModal isOpen={true} onClose={onClose} initialPost={null} />
      );

      const textarea = screen.getByPlaceholderText(/Write your Telegram message/i);
      fireEvent.change(textarea, { target: { value: 'New unsaved post content' } });

      const closeBtn = screen.getByTitle(/Close Publishing Studio/i);
      fireEvent.click(closeBtn);

      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
      expect(
        screen.getByText(/Would you like to save it as draft before leaving\?/i)
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('opens pre-publish confirmation dialog before final dispatch', async () => {
      renderWithProviders(
        <PublishingStudioModal isOpen={true} onClose={vi.fn()} initialPost={null} />
      );

      // Type text
      const textarea = screen.getByPlaceholderText(/Write your Telegram message/i);
      fireEvent.change(textarea, { target: { value: 'Broadcast alert message' } });

      // Select destination
      const destItem = await screen.findByText('VIP Crypto Signals');
      fireEvent.click(destItem);

      // Click Publish Now
      const publishBtn = screen.getByText('Publish Now');
      fireEvent.click(publishBtn);

      expect(screen.getByText('Confirm Broadcast Details')).toBeInTheDocument();
      expect(screen.getByText('1 channel(s) selected')).toBeInTheDocument();
      expect(screen.getByText('Confirm & Dispatch')).toBeInTheDocument();
    });
  });
});
