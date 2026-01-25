/**
 * Unit Tests fuer ErinnerungCard Component
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 2.2 AC2 (Re-Trigger Badge):**
 * - Bei snoozeCount > 0 und Status AUSGELOEST: Badge "X. Ausloesung"
 * - Zeigt dem User optisch, dass es ein Re-Trigger nach Snooze ist
 *
 * **Story 3.2 AC2 (Animation):**
 * - Update-Animation bei WebSocket-Status-Wechsel
 * - Insert-Animation bei neuer Erinnerung via WebSocket
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
  intensificationService: { stopTimer: vi.fn() },
}));

// Mock Sync Service
vi.mock('@/features/reminders/services/sync.service', () => ({
  syncService: { isTempId: vi.fn().mockReturnValue(false) },
}));

// Mock Stores
vi.mock('@/features/reminders/stores', () => ({
  openEditDialog: vi.fn(),
  openDeleteDialog: vi.fn(),
  openMarkErledigtDialog: vi.fn(),
  // Story 2.3: Mock Intensification Hook
  useIntensityLevel: vi.fn().mockReturnValue('none'),
  // Story 2.8: Mock Audio Failed Hook
  useAudioFailed: vi.fn().mockReturnValue(false),
  // Story 3.2: Mock Animation Hook
  useAnimationEntry: vi.fn().mockReturnValue(undefined),
}));

// Mock Seen Assignments Store
vi.mock('@/features/reminders/stores/seen-assignments.store', () => ({
  useIsUnseen: vi.fn().mockReturnValue(false),
  markAsSeen: vi.fn(),
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

  /**
   * Story 3.1: Team-Erinnerungsliste Tests
   *
   * AC3: ErinnerungCard zeigt Ersteller-Namen bei Team-Ansicht
   * AC4: Ersteller-Name unter Erinnerung-Details
   * AC5: Eigene vs fremde visuell unterscheidbar
   * AC8: "Team"-Badge bei fremden Erinnerungen
   */
  describe('Team-Erinnerungsliste (Story 3.1)', () => {
    describe('Team-Badge (AC8)', () => {
      it('should show "Team" badge when erinnerung is from another user', () => {
        // Given (Arrange) - Erinnerung von user-1, aktueller User ist user-2
        const erinnerung: ErinnerungResponseDto = {
          ...baseErinnerung,
          erstelltVon: 'user-1',
          erstellerName: 'Max Mustermann',
        };

        // When (Act)
        render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" currentUserId="user-2" />);

        // Then (Assert)
        expect(screen.getByText('Team')).toBeInTheDocument();
      });

      it('should NOT show "Team" badge when erinnerung is from current user', () => {
        // Given (Arrange) - Erinnerung von user-1, aktueller User ist auch user-1
        const erinnerung: ErinnerungResponseDto = {
          ...baseErinnerung,
          erstelltVon: 'user-1',
        };

        // When (Act)
        render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" currentUserId="user-1" />);

        // Then (Assert)
        expect(screen.queryByText('Team')).not.toBeInTheDocument();
      });

      it('should NOT show "Team" badge when erinnerung is assigned to current user', () => {
        // Given (Arrange) - Erinnerung von user-1, assigned to user-2, aktueller User ist user-2
        const erinnerung: ErinnerungResponseDto = {
          ...baseErinnerung,
          erstelltVon: 'user-1',
          assignedToId: 'user-2',
        };

        // When (Act)
        render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" currentUserId="user-2" />);

        // Then (Assert)
        expect(screen.queryByText('Team')).not.toBeInTheDocument();
      });

      it('should NOT show "Team" badge when currentUserId is not provided', () => {
        // Given (Arrange) - Kein currentUserId bedeutet wir können nicht unterscheiden
        const erinnerung: ErinnerungResponseDto = {
          ...baseErinnerung,
          erstelltVon: 'user-1',
        };

        // When (Act)
        render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

        // Then (Assert)
        expect(screen.queryByText('Team')).not.toBeInTheDocument();
      });

      it('should have correct aria-label and title for Team badge', () => {
        // Given (Arrange)
        const erinnerung: ErinnerungResponseDto = {
          ...baseErinnerung,
          erstelltVon: 'user-1',
          erstellerName: 'Max Mustermann',
        };

        // When (Act)
        render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" currentUserId="user-2" />);

        // Then (Assert)
        const badge = screen.getByText('Team');
        expect(badge).toHaveAttribute('aria-label', 'Team-Erinnerung');
        expect(badge).toHaveAttribute('title', 'Erstellt von Max Mustermann');
      });
    });

    describe('Ersteller-Name Anzeige (AC3/AC4)', () => {
      it('should show creator name when showCreator is true', () => {
        // Given (Arrange)
        const erinnerung: ErinnerungResponseDto = {
          ...baseErinnerung,
          erstellerName: 'Max Mustermann',
        };

        // When (Act)
        // Note: currentUserId unterschiedlich von assignedToId (undefined) damit "von" statt "Erstellt von" gezeigt wird
        render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" showCreator={true} currentUserId="other-user" />);

        // Then (Assert)
        expect(screen.getByText('von')).toBeInTheDocument();
        expect(screen.getByText('Max Mustermann')).toBeInTheDocument();
      });

      it('should show creator name when erinnerung is from team (isTeamReminder)', () => {
        // Given (Arrange)
        const erinnerung: ErinnerungResponseDto = {
          ...baseErinnerung,
          erstelltVon: 'user-1',
          erstellerName: 'Anna Schmidt',
        };

        // When (Act)
        render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" currentUserId="user-2" />);

        // Then (Assert)
        expect(screen.getByText('von')).toBeInTheDocument();
        expect(screen.getByText('Anna Schmidt')).toBeInTheDocument();
      });

      it('should NOT show creator name when showCreator is false and is own erinnerung', () => {
        // Given (Arrange)
        const erinnerung: ErinnerungResponseDto = {
          ...baseErinnerung,
          erstelltVon: 'user-1',
          erstellerName: 'Max Mustermann',
        };

        // When (Act)
        render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" currentUserId="user-1" showCreator={false} />);

        // Then (Assert)
        expect(screen.queryByText('von')).not.toBeInTheDocument();
        expect(screen.queryByText('Max Mustermann')).not.toBeInTheDocument();
      });

      it('should NOT show creator name when erstellerName is not provided', () => {
        // Given (Arrange)
        const erinnerung: ErinnerungResponseDto = {
          ...baseErinnerung,
          erstellerName: undefined,
        };

        // When (Act)
        render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" showCreator={true} />);

        // Then (Assert)
        expect(screen.queryByText('von')).not.toBeInTheDocument();
      });
    });
  });

  /**
   * Story 3.2 AC2: Status-Aenderungsanimation
   *
   * Tests fuer Animation bei WebSocket-Updates:
   * - Update-Animation: Highlight-Effekt bei Status-Wechsel
   * - Insert-Animation: Slide-in bei neuer Erinnerung
   */
  describe('WebSocket Animation (Story 3.2 AC2)', () => {
    it('should apply update animation class when animationEntry type is update', async () => {
      // Given (Arrange)
      const { useAnimationEntry } = await import('@/features/reminders/stores');
      vi.mocked(useAnimationEntry).mockReturnValue({ type: 'update', timestamp: Date.now() });

      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'GEPLANT',
      };

      // When (Act)
      const { container } = render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/animate-highlight/);
    });

    it('should apply insert animation class when animationEntry type is insert', async () => {
      // Given (Arrange)
      const { useAnimationEntry } = await import('@/features/reminders/stores');
      vi.mocked(useAnimationEntry).mockReturnValue({ type: 'insert', timestamp: Date.now() });

      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'GEPLANT',
      };

      // When (Act)
      const { container } = render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/animate-slide-in-right/);
    });

    it('should NOT apply animation classes when animationEntry is undefined', async () => {
      // Given (Arrange)
      const { useAnimationEntry } = await import('@/features/reminders/stores');
      vi.mocked(useAnimationEntry).mockReturnValue(undefined);

      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        status: 'GEPLANT',
      };

      // When (Act)
      const { container } = render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      const card = container.firstChild as HTMLElement;
      expect(card.className).not.toMatch(/animate-highlight/);
      expect(card.className).not.toMatch(/animate-slide-in-right/);
    });
  });

  /**
   * Story 3.7: Zuweisungs-Notification & "Neu" Badge
   *
   * AC3: "Neu" Markierung in der Liste wenn mir neu zugewiesen
   * AC4: "Neu" Markierung entfernen bei Interaktion
   */
  describe('Zuweisungs-Notification Badge (Story 3.7 AC3/AC4)', () => {
    it('should show "NEU" badge when reminder is unseen and assigned to current user', async () => {
      // Given (Arrange)
      const { useIsUnseen } = await import('@/features/reminders/stores/seen-assignments.store');
      vi.mocked(useIsUnseen).mockReturnValue(true);

      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        assignedToId: 'user-1',
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" currentUserId="user-1" />);

      // Then (Assert)
      expect(screen.getByText('NEU')).toBeInTheDocument();
    });

    it('should NOT show "NEU" badge when reminder is already seen', async () => {
      // Given (Arrange)
      const { useIsUnseen } = await import('@/features/reminders/stores/seen-assignments.store');
      vi.mocked(useIsUnseen).mockReturnValue(false);

      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        assignedToId: 'user-1',
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" currentUserId="user-1" />);

      // Then (Assert)
      expect(screen.queryByText('NEU')).not.toBeInTheDocument();
    });

    it('should NOT show "NEU" badge when reminder is assigned to someone else', async () => {
      // Given (Arrange)
      const { useIsUnseen } = await import('@/features/reminders/stores/seen-assignments.store');
      vi.mocked(useIsUnseen).mockReturnValue(true); // Is theoretically unseen but not for me

      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        assignedToId: 'user-2', // Other user
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" currentUserId="user-1" />);

      // Then (Assert)
      expect(screen.queryByText('NEU')).not.toBeInTheDocument();
    });

    it('should call markAsSeen when card is clicked', async () => {
      // Given (Arrange)
      const { useIsUnseen, markAsSeen } = await import('@/features/reminders/stores/seen-assignments.store');
      vi.mocked(useIsUnseen).mockReturnValue(true);

      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        assignedToId: 'user-1',
      };

      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" currentUserId="user-1" />);

      // When (Act) - Click anywhere on the card
      const cardTitle = screen.getByText('Test Erinnerung'); // Click title to simulate card click
      cardTitle.click();

      // Then (Assert)
      expect(markAsSeen).toHaveBeenCalledWith(erinnerung.id);
    });

    it('should have correct accessibility attributes for NEU badge', async () => {
      // Given (Arrange)
      const { useIsUnseen } = await import('@/features/reminders/stores/seen-assignments.store');
      vi.mocked(useIsUnseen).mockReturnValue(true);

      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        assignedToId: 'user-1',
      };

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" currentUserId="user-1" />);

      // Then (Assert)
      const badge = screen.getByText('NEU');
      expect(badge).toHaveAttribute('role', 'status');
      expect(badge).toHaveAttribute('aria-label', 'Neue Zuweisung');
      expect(badge).toHaveAttribute('title', 'Neu zugewiesen');
    });
  });

  describe('Eskalationsperson (Story 4.1)', () => {
    it('should show "Eskalation: Name" badge when eskalationsPersonName is present', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        eskalationsPersonId: 'clw3h8x9y0005znopqrstuvw',
        eskalationsPersonName: 'Chief Wiggum',
      } as any;

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      const badge = screen.getByText('Chief Wiggum');
      expect(badge).toBeInTheDocument();
      expect(badge.parentElement).toHaveTextContent('Eskalation: Chief Wiggum');
    });

    it('should NOT show escalation badge when eskalationsPersonName is missing', () => {
      // Given (Arrange)
      const erinnerung: ErinnerungResponseDto = {
        ...baseErinnerung,
        eskalationsPersonId: null,
      } as any;

      // When (Act)
      render(<ErinnerungCard erinnerung={erinnerung} einsatzId="einsatz-1" />);

      // Then (Assert)
      expect(screen.queryByText(/Eskalation:/)).not.toBeInTheDocument();
    });
  });
});
