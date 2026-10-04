import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Input,
  Select,
  Modal,
  Skeleton,
  EmptyState,
  PageHeader,
  ConfirmModal,
  StatusBadge,
} from '../components/ui';
import { ToastProvider, useToast } from '../context/ToastContext';
import { AdminLayout } from '../components/AdminLayout';
import { AuthContext } from '../context/AuthContext';
import { Mail, Check, Shield } from 'lucide-react';

describe('Design System Primitives', () => {
  describe('Button component', () => {
    it('renders with children and handles clicks', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);
      const btn = screen.getByRole('button', { name: /click me/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders different variants correctly', () => {
      const { rerender } = render(<Button variant="primary">Primary</Button>);
      expect(screen.getByRole('button')).toHaveClass('from-sky-500');

      rerender(<Button variant="danger">Delete</Button>);
      expect(screen.getByRole('button')).toHaveClass('text-rose-400');
    });

    it('handles loading state properly', () => {
      render(<Button isLoading>Submit</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      expect(btn.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('renders left and right icons', () => {
      render(
        <Button
          leftIcon={<Mail data-testid="left-icon" />}
          rightIcon={<Check data-testid="right-icon" />}
        >
          Send Email
        </Button>
      );
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });
  });

  describe('Card suite', () => {
    it('renders card with header, title, description, content, and footer', () => {
      render(
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>A card description</CardDescription>
          </CardHeader>
          <CardContent>Body content goes here</CardContent>
          <CardFooter>
            <Button size="sm">Save</Button>
          </CardFooter>
        </Card>
      );

      expect(screen.getByText('Test Card')).toBeInTheDocument();
      expect(screen.getByText('A card description')).toBeInTheDocument();
      expect(screen.getByText('Body content goes here')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });
  });

  describe('Badge component', () => {
    it('renders with dot indicator and various semantic variants', () => {
      render(
        <Badge variant="success" dot>
          Active
        </Badge>
      );
      const badge = screen.getByText('Active');
      expect(badge).toBeInTheDocument();
      expect(badge.querySelector('.rounded-full')).toBeInTheDocument();
    });
  });

  describe('Input component', () => {
    it('renders label, input, helper text and error state', () => {
      const { rerender } = render(
        <Input
          label="Email"
          placeholder="Enter email"
          helperText="We will never share your email"
        />
      );

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByText('We will never share your email')).toBeInTheDocument();

      rerender(<Input label="Email" error="Invalid email address" />);
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
  });

  describe('Select component', () => {
    it('renders options and responds to selection changes', () => {
      const handleChange = vi.fn();
      render(
        <Select
          label="Category"
          options={[
            { value: 'cat1', label: 'Tech' },
            { value: 'cat2', label: 'News' },
          ]}
          onChange={handleChange}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      fireEvent.change(select, { target: { value: 'cat2' } });
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Modal component', () => {
    it('renders modal when open and handles escape/close', () => {
      const handleClose = vi.fn();
      const { rerender } = render(
        <Modal isOpen={false} onClose={handleClose} title="Dialog Title">
          Modal content
        </Modal>
      );

      expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument();

      rerender(
        <Modal isOpen={true} onClose={handleClose} title="Dialog Title">
          Modal content
        </Modal>
      );

      expect(screen.getByText('Dialog Title')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();

      // Test close button
      const closeBtn = screen.getByLabelText('Close dialog');
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);

      // Test escape key
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('Skeleton component', () => {
    it('renders with pulsing animation classes', () => {
      const { container } = render(<Skeleton className="w-20 h-4" />);
      expect(container.firstChild).toHaveClass('animate-pulse');
    });
  });

  describe('EmptyState component', () => {
    it('renders icon, title, description, and action buttons', () => {
      const handlePrimary = vi.fn();
      const handleSecondary = vi.fn();

      render(
        <EmptyState
          icon={<Mail data-testid="empty-mail" />}
          title="No Messages"
          description="You do not have any messages in your queue."
          primaryAction={{ label: 'Compose New', onClick: handlePrimary }}
          secondaryAction={{ label: 'Refresh', onClick: handleSecondary }}
        />
      );

      expect(screen.getByTestId('empty-mail')).toBeInTheDocument();
      expect(screen.getByText('No Messages')).toBeInTheDocument();
      expect(screen.getByText('You do not have any messages in your queue.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /compose new/i }));
      expect(handlePrimary).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
      expect(handleSecondary).toHaveBeenCalledTimes(1);
    });
  });

  describe('PageHeader component', () => {
    it('renders title, description, icon, status badge, and action triggers', () => {
      const handleAction = vi.fn();
      render(
        <PageHeader
          title="Forwarding Rules"
          description="Manage automated message routing workflows."
          icon={<Shield data-testid="page-icon" />}
          statusBadge={<StatusBadge status="active" label="3 Active" />}
          actions={<Button onClick={handleAction}>Create Rule</Button>}
        />
      );

      expect(screen.getByText('Forwarding Rules')).toBeInTheDocument();
      expect(screen.getByText('Manage automated message routing workflows.')).toBeInTheDocument();
      expect(screen.getByTestId('page-icon')).toBeInTheDocument();
      expect(screen.getByText('3 Active')).toBeInTheDocument();

      const actionBtn = screen.getByRole('button', { name: /create rule/i });
      expect(actionBtn).toBeInTheDocument();
      fireEvent.click(actionBtn);
      expect(handleAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('ConfirmModal component', () => {
    it('renders dialog with confirm and cancel buttons and executes actions', () => {
      const handleClose = vi.fn();
      const handleConfirm = vi.fn();

      render(
        <ConfirmModal
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          title="Delete Schedule"
          description="Are you sure you want to cancel this scheduled delivery?"
          confirmText="Yes, Delete"
          cancelText="Keep"
          variant="danger"
        />
      );

      expect(screen.getByText('Delete Schedule')).toBeInTheDocument();
      expect(
        screen.getByText('Are you sure you want to cancel this scheduled delivery?')
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /keep/i }));
      expect(handleClose).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('StatusBadge component', () => {
    it('renders correct labels and semantic styles for various statuses', () => {
      const { rerender } = render(<StatusBadge status="published" />);
      expect(screen.getByText('Published')).toBeInTheDocument();

      rerender(<StatusBadge status="scheduled" />);
      expect(screen.getByText('Scheduled')).toBeInTheDocument();

      rerender(<StatusBadge status="failed" label="Delivery Failed" showIcon />);
      expect(screen.getByText('Delivery Failed')).toBeInTheDocument();
    });
  });
});

describe('Toast Notification System', () => {
  const TestToastConsumer: React.FC = () => {
    const { toast } = useToast();
    return (
      <div>
        <button onClick={() => toast.success('Operation Successful', 'All items synced')}>
          Show Success Toast
        </button>
        <button onClick={() => toast.error('Publish Failed', 'Telegram API returned error 429')}>
          Show Error Toast
        </button>
      </div>
    );
  };

  it('renders toasts dynamically and allows manual dismissal', () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    expect(screen.queryByText('Operation Successful')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show success toast/i }));
    expect(screen.getByText('Operation Successful')).toBeInTheDocument();
    expect(screen.getByText('All items synced')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show error toast/i }));
    expect(screen.getByText('Publish Failed')).toBeInTheDocument();

    // Dismiss one toast
    const dismissButtons = screen.getAllByLabelText('Dismiss toast');
    expect(dismissButtons.length).toBe(2);
    fireEvent.click(dismissButtons[0]);
  });
});

describe('Web Shell (AdminLayout)', () => {
  const mockAuthContext = {
    user: {
      _id: 'u1',
      id: 'u1',
      email: 'admin@forwarder.pro',
      name: 'Pankaj Admin',
      role: 'admin' as const,
      status: 'active' as const,
      isSuperAdmin: true,
      tokenVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    token: 'fake-jwt-token',
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    setup: vi.fn(),
  };

  it('renders sidebar navigation links, user identity and header', () => {
    render(
      <MemoryRouter initialEntries={['/posts']}>
        <AuthContext.Provider value={mockAuthContext}>
          <AdminLayout>
            <div data-testid="page-content">Posts Page Content</div>
          </AdminLayout>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    // Sidebar items
    expect(screen.getAllByText('Telegram Forwarder').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Posts & Inbox').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Forwarding Rules')).toBeInTheDocument();

    expect(screen.getByText('Destinations')).toBeInTheDocument();

    // User profile in layout
    expect(screen.getByText('Pankaj Admin')).toBeInTheDocument();

    // Content
    expect(screen.getByTestId('page-content')).toBeInTheDocument();

    // Breadcrumbs
    expect(screen.getByLabelText('Breadcrumbs')).toBeInTheDocument();
  });
});
