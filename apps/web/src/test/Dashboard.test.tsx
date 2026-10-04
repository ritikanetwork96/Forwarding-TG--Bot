import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DashboardStatsDTO } from '@telegram-forwarder/shared';
import {
  DashboardHeader,
  KpiGrid,
  AttentionBanner,
  UpcomingScheduleFeed,
  RecentActivityFeed,
  SystemHealthMatrix,
} from '../components/dashboard';

const mockDashboardStats: DashboardStatsDTO = {
  kpis: {
    destinations: { total: 10, verified: 8, disabled: 1 },
    drafts: { total: 5, inbound: 2 },
    scheduled: { total: 4, todayDue: 2, nextRunAt: '2026-09-26T18:30:00.000Z' },
    queue: {
      waiting: 0,
      active: 1,
      delayed: 0,
      failed: 0,
      completed: 42,
      isPaused: false,
      workerStatus: 'running',
    },
    delivery24h: { total: 20, success: 19, failed: 1, successRate: 95.0, displayRate: '95%' },
  },
  attention: {
    hasFailures: true,
    failureCount: 1,
    failedItems: [
      {
        id: 'fail-1',
        messageId: 'msg-1',
        destinationName: 'VIP Crypto Signals',
        error: 'Bot requires administrator privileges in target channel',
        createdAt: '2026-09-26T14:00:00.000Z',
      },
    ],
  },
  upcomingSchedules: [
    {
      id: 'sch-1',
      scheduledFor: new Date(Date.now() + 1800000).toISOString(), // 30 mins from now
      timezone: 'Asia/Kolkata',
      destinationCount: 3,
      previewText: 'Weekly Telegram Community Roundup',
      categoryName: 'Announcements',
      status: 'scheduled',
    },
  ],
  recentActivity: [
    {
      id: 'log-1',
      publishMode: 'copy',
      status: 'success',
      destinationName: 'Alpha VIP Channel',
      executionTimeMs: 48,
      previewText: 'Bitcoin Market Update',
      createdAt: new Date().toISOString(),
    },
  ],
  infrastructure: {
    mongo: { status: 'connected' },
    redis: { status: 'connected' },
    worker: { status: 'running', concurrency: 5 },
    telegramBot: { status: 'connected', username: 'forwarder_bot' },
    overallStatus: 'healthy',
  },
};

describe('Dashboard Component Suite (Phase 5B)', () => {
  describe('DashboardHeader', () => {
    it('renders personalized user greeting and healthy status pill', () => {
      const handleSync = vi.fn();
      render(
        <MemoryRouter>
          <DashboardHeader
            userName="Pankaj Sharma"
            overallStatus="healthy"
            isFetching={false}
            onSync={handleSync}
          />
        </MemoryRouter>
      );

      expect(screen.getByText(/pankaj sharma/i)).toBeInTheDocument();
      expect(screen.getAllByText('All Systems Operational').length).toBeGreaterThanOrEqual(1);

      const syncBtn = screen.getByRole('button', { name: /sync/i });
      fireEvent.click(syncBtn);
      expect(handleSync).toHaveBeenCalledTimes(1);
    });

    it('displays degraded status badge when overallStatus is degraded', () => {
      render(
        <MemoryRouter>
          <DashboardHeader
            userName="Admin"
            overallStatus="degraded"
            isFetching={false}
            onSync={vi.fn()}
          />
        </MemoryRouter>
      );

      expect(screen.getAllByText('Performance Degraded').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('KpiGrid', () => {
    it('renders all 5 executive KPI cards with accurate values and labels', () => {
      render(
        <MemoryRouter>
          <KpiGrid kpis={mockDashboardStats.kpis} />
        </MemoryRouter>
      );

      // 1. Destinations
      expect(screen.getByText('Active Destinations')).toBeInTheDocument();
      expect(screen.getByText('8 / 10')).toBeInTheDocument();

      // 2. Drafts
      expect(screen.getByText('Pending Drafts')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('2 inbound')).toBeInTheDocument();

      // 3. Scheduled
      expect(screen.getByText('Scheduled Posts')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('2 today')).toBeInTheDocument();

      // 4. Queue
      expect(screen.getByText('Queue Velocity')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // active (1) + waiting (0)

      // 5. 24h Success Rate
      expect(screen.getByText('24h Success Rate')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('1 failed')).toBeInTheDocument();
    });

    it('renders neutral N/A state when 0 delivery attempts completed', () => {
      const neutralKpis = {
        ...mockDashboardStats.kpis,
        delivery24h: {
          total: 0,
          success: 0,
          failed: 0,
          successRate: null,
          displayRate: 'N/A',
        },
      };

      render(
        <MemoryRouter>
          <KpiGrid kpis={neutralKpis} />
        </MemoryRouter>
      );

      expect(screen.getByText('N/A')).toBeInTheDocument();
      expect(screen.getByText('No completed deliveries in 24h')).toBeInTheDocument();
    });
  });

  describe('AttentionBanner', () => {
    it('renders banner when failures exist with destination and error reason', () => {
      render(
        <MemoryRouter>
          <AttentionBanner attention={mockDashboardStats.attention} />
        </MemoryRouter>
      );

      expect(screen.getByText(/Attention Required: 1 Delivery Failure/i)).toBeInTheDocument();
      expect(screen.getByText('VIP Crypto Signals')).toBeInTheDocument();
      expect(
        screen.getByText(/Bot requires administrator privileges in target channel/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /review failed logs/i })).toBeInTheDocument();
    });

    it('renders nothing when hasFailures is false', () => {
      const { container } = render(
        <MemoryRouter>
          <AttentionBanner attention={{ hasFailures: false, failureCount: 0, failedItems: [] }} />
        </MemoryRouter>
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('UpcomingScheduleFeed', () => {
    it('renders upcoming schedules with relative countdown, destination count and preview', () => {
      render(
        <MemoryRouter>
          <UpcomingScheduleFeed schedules={mockDashboardStats.upcomingSchedules} />
        </MemoryRouter>
      );

      expect(screen.getByText('Upcoming Releases')).toBeInTheDocument();
      expect(screen.getByText('Weekly Telegram Community Roundup')).toBeInTheDocument();
      expect(screen.getByText('Announcements')).toBeInTheDocument();
      expect(screen.getByText('3 targets')).toBeInTheDocument();
    });

    it('renders empty state when no upcoming schedules exist', () => {
      render(
        <MemoryRouter>
          <UpcomingScheduleFeed schedules={[]} />
        </MemoryRouter>
      );

      expect(screen.getByText('No Scheduled Releases')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /schedule a post/i })).toBeInTheDocument();
    });
  });

  describe('RecentActivityFeed', () => {
    it('renders recent publishing dispatches with mode, duration and destination', () => {
      render(
        <MemoryRouter>
          <RecentActivityFeed activities={mockDashboardStats.recentActivity} />
        </MemoryRouter>
      );

      expect(screen.getByText('Recent Publishing Activity')).toBeInTheDocument();
      expect(screen.getByText('Alpha VIP Channel')).toBeInTheDocument();
      expect(screen.getByText('copy')).toBeInTheDocument();
      expect(screen.getByText('Bitcoin Market Update')).toBeInTheDocument();
    });

    it('renders empty state when no activities recorded', () => {
      render(
        <MemoryRouter>
          <RecentActivityFeed activities={[]} />
        </MemoryRouter>
      );

      expect(screen.getByText('No Recent Activity')).toBeInTheDocument();
    });
  });

  describe('SystemHealthMatrix', () => {
    it('renders infrastructure health cards for Mongo, Redis, Worker and Bot', () => {
      render(<SystemHealthMatrix infrastructure={mockDashboardStats.infrastructure} />);

      expect(screen.getByText('Infrastructure Matrix')).toBeInTheDocument();
      expect(screen.getByText('MongoDB Atlas')).toBeInTheDocument();
      expect(screen.getByText('Redis Cluster')).toBeInTheDocument();
      expect(screen.getByText('BullMQ Worker')).toBeInTheDocument();
      expect(screen.getByText('Telegram Bot API')).toBeInTheDocument();
      expect(screen.getByText('@forwarder_bot')).toBeInTheDocument();
      expect(screen.getByText('Concurrency 5 • Dedicated Worker')).toBeInTheDocument();
      expect(screen.getByText('Cluster Healthy')).toBeInTheDocument();
    });
  });
});
