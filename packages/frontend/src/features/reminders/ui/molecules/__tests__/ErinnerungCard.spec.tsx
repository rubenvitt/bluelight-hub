/**
 * Unit Tests fuer ErinnerungCard Component
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 2.2 AC2 (Re-Trigger Badge):**
 * - Bei snoozeCount > 0 und Status AUSGELOEST: Badge "X. Ausloesung"
 * - Zeigt dem User optisch, dass es ein Re-Trigger nach Snooze ist
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErinnerungCard } from '../ErinnerungCard';
import type { ErinnerungResponseDto } from '@/shared';

// Mock API Hooks
vi.mock('@/features/reminders/api', () => ({
  useAcknowledgeErinnerung: () => ({ mutate: vi.fn(), isPending: false }),
  useSnoozeErinnerung: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Mock Services
vi.mock('@/features/reminders/services', () => ({
  soundService: { stopAllSounds: vi.fn() },
  timerService: { resetTriggered: vi.fn() },
}));

// Mock Sync Service
vi.mock('@/features/reminders/services/sync.service', () => ({
  syncService: { isTempId: vi.fn().mockReturnValue(false) },
}));

// Mock Stores
vi.mock('@/features/reminders/stores', () => ({
  openEditDialog: vi.fn(),
  openDeleteDialog: vi.fn(),
}));

// Mock Countdown Hook
vi.mock('@/features/reminders/hooks/use-countdown', () => ({
  useCountdown: () => ({ urgencyLevel: 'normal', remaining: 600000 }),
}));

describe('ErinnerungCard', () => {
  const baseErinnerung: ErinnerungResponseDto = {
    id: 'test-id-123',
    einsatzId: 'einsatz-1',
    titel: 'Test Erinnerung',
    faelligAm: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 Min in Zukunft
    erstelltVon: 'user-1',
    erstelltAm: new Date().toISOString(),
    status: 'GEPLANT',
    snoozeCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Re-Trigger Badge (Story 2.2 AC2)', () => {
    it('should show "2. Ausloesung" badge when snoozeCount is 1 and status is AUSGELOEST', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'AUSGELOEST',
        snoozeCount: 1,
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      expect(screen.getByText('2. Auslösung')).toBeInTheDocument();
    });

    it('should show "3. Ausloesung" badge when snoozeCount is 2 and status is AUSGELOEST', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'AUSGELOEST',
        snoozeCount: 2,
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      expect(screen.getByText('3. Auslösung')).toBeInTheDocument();
    });

    it('should NOT show re-trigger badge when snoozeCount is 0', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'AUSGELOEST',
        snoozeCount: 0,
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      expect(screen.queryByText(/Auslösung/)).not.toBeInTheDocument();
    });

    it('should NOT show re-trigger badge when snoozeCount is undefined', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'AUSGELOEST',
        snoozeCount: undefined,
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      expect(screen.queryByText(/Auslösung/)).not.toBeInTheDocument();
    });

    it('should NOT show re-trigger badge when status is GEPLANT even with snoozeCount > 0', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'GEPLANT',
        snoozeCount: 2,
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      expect(screen.queryByText(/Auslösung/)).not.toBeInTheDocument();
    });

    it('should NOT show re-trigger badge when status is ACKNOWLEDGED even with snoozeCount > 0', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'ACKNOWLEDGED',
        snoozeCount: 3,
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      expect(screen.queryByText(/Auslösung/)).not.toBeInTheDocument();
    });

    it('should NOT show re-trigger badge when status is SNOOZED even with snoozeCount > 0', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'SNOOZED',
        snoozeCount: 1,
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      expect(screen.queryByText(/Auslösung/)).not.toBeInTheDocument();
    });

    it('should have correct aria-label for re-trigger badge', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'AUSGELOEST',
        snoozeCount: 2,
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      const badge = screen.getByText('3. Auslösung');
      expect(badge).toHaveAttribute('aria-label', '3. Auslösung nach Snooze');
    });

    it('should have role="status" for re-trigger badge', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'AUSGELOEST',
        snoozeCount: 1,
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      const badge = screen.getByText('2. Auslösung');
      expect(badge).toHaveAttribute('role', 'status');
    });

    it('should have correct title tooltip showing snooze count', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'AUSGELOEST',
        snoozeCount: 3,
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      const badge = screen.getByText('4. Auslösung');
      expect(badge).toHaveAttribute('title', '4. Auslösung - wurde 3x gesnoozed');
    });

    it('should have red styling for re-trigger badge', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'AUSGELOEST',
        snoozeCount: 1,
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      const badge = screen.getByText('2. Auslösung');
      expect(badge.className).toMatch(/red/);
    });
  });

  describe('Titel display', () => {
    it('should display the erinnerung titel', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        titel: 'Wichtige Erinnerung ABC',
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      expect(screen.getByText('Wichtige Erinnerung ABC')).toBeInTheDocument();
    });
  });

  describe('Status-based rendering', () => {
    it('should render as button when status is AUSGELOEST', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'AUSGELOEST',
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert) - Card sollte ein button sein fuer Keyboard Support
      const card = screen.getByRole('button', { name: /Erinnerung.*Enter: Bestätigen/i });
      expect(card).toBeInTheDocument();
    });

    it('should render as div when status is GEPLANT', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'GEPLANT',
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert) - Kein button role bei GEPLANT
      expect(screen.queryByRole('button', { name: /Enter: Bestätigen/i })).not.toBeInTheDocument();
    });
  });
});
