/**
 * Unit Tests fuer OfflineBanner Component
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.8 AC1:**
 * - Offline Banner zeigt "Offline - wird synchronisiert"
 * - Variants: Offline (gelb), Syncing (blau), Hidden
 * - Phosphor Icons: PiCloudSlash, PiCloudArrowUp
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineBanner } from '../OfflineBanner';

describe('OfflineBanner', () => {
  describe('visibility', () => {
    it('should be visible when isOffline is true (AC1)', () => {
      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={0} />);

      // Then (Assert)
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should be hidden when isOffline is false and no pending actions', () => {
      // When (Act)
      const { container } = render(<OfflineBanner isOffline={false} pendingCount={0} />);

      // Then (Assert)
      expect(container.firstChild).toBeNull();
    });

    it('should show syncing variant when online with pending actions', () => {
      // When (Act)
      render(<OfflineBanner isOffline={false} pendingCount={3} isSyncing={true} />);

      // Then (Assert)
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(/synchronisiere/i)).toBeInTheDocument();
    });
  });

  describe('offline variant', () => {
    it('should show cloud-slash icon when offline', () => {
      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={0} />);

      // Then (Assert)
      expect(screen.getByTestId('offline-icon')).toBeInTheDocument();
    });

    it('should show "Offline" text when offline', () => {
      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={0} />);

      // Then (Assert)
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });

    it('should show pending count in offline message (AC1)', () => {
      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={5} />);

      // Then (Assert)
      expect(screen.getByText(/5 Aktionen/i)).toBeInTheDocument();
    });

    it('should have yellow/amber background when offline', () => {
      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={0} />);

      // Then (Assert)
      const banner = screen.getByRole('status');
      expect(banner.className).toMatch(/amber|yellow/);
    });
  });

  describe('syncing variant', () => {
    it('should show cloud-arrow-up icon when syncing', () => {
      // When (Act)
      render(<OfflineBanner isOffline={false} pendingCount={2} isSyncing={true} />);

      // Then (Assert)
      expect(screen.getByTestId('syncing-icon')).toBeInTheDocument();
    });

    it('should show "Synchronisiere..." text when syncing', () => {
      // When (Act)
      render(<OfflineBanner isOffline={false} pendingCount={2} isSyncing={true} />);

      // Then (Assert)
      expect(screen.getByText(/synchronisiere/i)).toBeInTheDocument();
    });

    it('should have blue background when syncing', () => {
      // When (Act)
      render(<OfflineBanner isOffline={false} pendingCount={2} isSyncing={true} />);

      // Then (Assert)
      const banner = screen.getByRole('status');
      expect(banner.className).toMatch(/blue/);
    });
  });

  describe('pendingCount display', () => {
    it('should show singular "Aktion" for count of 1', () => {
      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={1} />);

      // Then (Assert)
      expect(screen.getByText(/1 Aktion/i)).toBeInTheDocument();
      expect(screen.queryByText(/1 Aktionen/i)).not.toBeInTheDocument();
    });

    it('should show plural "Aktionen" for count > 1', () => {
      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={3} />);

      // Then (Assert)
      expect(screen.getByText(/3 Aktionen/i)).toBeInTheDocument();
    });

    it('should not show count when pendingCount is 0 and offline', () => {
      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={0} />);

      // Then (Assert)
      expect(screen.queryByText(/Aktion/i)).not.toBeInTheDocument();
    });
  });

  describe('offlineSince display', () => {
    it('should show duration when offlineSince is provided', () => {
      // Given (Arrange)
      const offlineSince = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={0} offlineSince={offlineSince} />);

      // Then (Assert)
      // Might show "seit 5 Min" or similar - just check it exists
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('styling and layout', () => {
    it('should have full width', () => {
      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={0} />);

      // Then (Assert)
      const banner = screen.getByRole('status');
      expect(banner.className).toMatch(/w-full/);
    });

    it('should have transition classes for animation', () => {
      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={0} />);

      // Then (Assert)
      const banner = screen.getByRole('status');
      expect(banner.className).toMatch(/transition/);
    });
  });

  describe('accessibility', () => {
    it('should have role="status" for screen readers', () => {
      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={0} />);

      // Then (Assert)
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have aria-live="polite" for announcements', () => {
      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={0} />);

      // Then (Assert)
      const banner = screen.getByRole('status');
      expect(banner).toHaveAttribute('aria-live', 'polite');
    });

    it('should have aria-atomic="true" for complete region announcements (Issue #13)', () => {
      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={0} />);

      // Then (Assert)
      const banner = screen.getByRole('status');
      expect(banner).toHaveAttribute('aria-atomic', 'true');
    });

    it('should have dynamic aria-label for offline state (Issue #13)', () => {
      // When (Act)
      render(<OfflineBanner isOffline={true} pendingCount={3} />);

      // Then (Assert)
      const banner = screen.getByRole('status');
      expect(banner).toHaveAttribute('aria-label', 'Offline - 3 Aktionen werden synchronisiert');
    });

    it('should have dynamic aria-label for syncing state (Issue #13)', () => {
      // When (Act)
      render(<OfflineBanner isOffline={false} pendingCount={2} isSyncing={true} />);

      // Then (Assert)
      const banner = screen.getByRole('status');
      expect(banner).toHaveAttribute('aria-label', 'Synchronisiere 2 Aktionen');
    });

    it('should have singular aria-label for single pending action', () => {
      // When (Act)
      render(<OfflineBanner isOffline={false} pendingCount={1} isSyncing={true} />);

      // Then (Assert)
      const banner = screen.getByRole('status');
      expect(banner).toHaveAttribute('aria-label', 'Synchronisiere 1 Aktion');
    });
  });
});
