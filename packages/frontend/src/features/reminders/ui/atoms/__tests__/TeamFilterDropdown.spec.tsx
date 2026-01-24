/**
 * Unit Tests fuer TeamFilterDropdown Komponente
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 3.6 Task 2 + Task 5.2:**
 * - AC1: Filter-Dropdown mit allen Optionen (Alle, Meine, Unzugewiesen, Teilnehmer)
 * - AC2: Visuelles Feedback bei aktivem Filter
 * - AC5: Filter-Reset auf "Alle"
 *
 * **Code Review Fix:** Tagged Union Types fuer TeamFilterType
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamFilterDropdown } from '../TeamFilterDropdown';
import type { TeamFilterType, Teilnehmer } from '@/features/reminders/stores';

describe('TeamFilterDropdown', () => {
  const mockOnFilterChange = vi.fn();
  const defaultTeilnehmer: Teilnehmer[] = [
    { id: 'user-1', name: 'Thomas Mueller' },
    { id: 'user-2', name: 'Markus Weber' },
  ];
  const defaultCurrentUserId = 'current-user-id';

  // Tagged Union Filter Types (Code Review Fix #1)
  const filterAll: TeamFilterType = { type: 'all' };
  const filterMine: TeamFilterType = { type: 'mine' };
  const filterUnassigned: TeamFilterType = { type: 'unassigned' };
  const filterUser1: TeamFilterType = { type: 'user', userId: 'user-1' };
  const filterUnknownUser: TeamFilterType = { type: 'user', userId: 'unknown-user-id' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering (AC1)', () => {
    it('should render dropdown button with current filter label', () => {
      // Given (Arrange)
      // When (Act)
      render(<TeamFilterDropdown selectedFilter={filterAll} onFilterChange={mockOnFilterChange} teilnehmer={defaultTeilnehmer} currentUserId={defaultCurrentUserId} />);

      // Then (Assert)
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Alle')).toBeInTheDocument();
    });

    it('should display "Meine" when filter is "mine"', () => {
      // Given (Arrange)
      // When (Act)
      render(<TeamFilterDropdown selectedFilter={filterMine} onFilterChange={mockOnFilterChange} teilnehmer={defaultTeilnehmer} currentUserId={defaultCurrentUserId} />);

      // Then (Assert)
      expect(screen.getByText('Meine')).toBeInTheDocument();
    });

    it('should display "Unzugewiesen" when filter is "unassigned"', () => {
      // Given (Arrange)
      // When (Act)
      render(<TeamFilterDropdown selectedFilter={filterUnassigned} onFilterChange={mockOnFilterChange} teilnehmer={defaultTeilnehmer} currentUserId={defaultCurrentUserId} />);

      // Then (Assert)
      expect(screen.getByText('Unzugewiesen')).toBeInTheDocument();
    });

    it('should display teilnehmer name when filter is userId', () => {
      // Given (Arrange)
      // When (Act)
      render(<TeamFilterDropdown selectedFilter={filterUser1} onFilterChange={mockOnFilterChange} teilnehmer={defaultTeilnehmer} currentUserId={defaultCurrentUserId} />);

      // Then (Assert)
      expect(screen.getByText('Thomas Mueller')).toBeInTheDocument();
    });
  });

  describe('dropdown options (AC1)', () => {
    it('should show all filter options when opened', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      render(<TeamFilterDropdown selectedFilter={filterAll} onFilterChange={mockOnFilterChange} teilnehmer={defaultTeilnehmer} currentUserId={defaultCurrentUserId} />);

      // When (Act)
      await user.click(screen.getByRole('button'));

      // Then (Assert)
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      // Base options
      expect(screen.getByRole('option', { name: /Alle/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Meine/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Unzugewiesen/i })).toBeInTheDocument();
      // Teilnehmer options
      expect(screen.getByRole('option', { name: /Thomas Mueller/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Markus Weber/i })).toBeInTheDocument();
    });

    it('should render empty teilnehmer list gracefully', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      render(<TeamFilterDropdown selectedFilter={filterAll} onFilterChange={mockOnFilterChange} teilnehmer={[]} currentUserId={defaultCurrentUserId} />);

      // When (Act)
      await user.click(screen.getByRole('button'));

      // Then (Assert)
      // Base options should still be there
      expect(screen.getByRole('option', { name: /Alle/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Meine/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Unzugewiesen/i })).toBeInTheDocument();
    });
  });

  describe('filter selection', () => {
    it('should call onFilterChange with "mine" when selecting "Meine" (AC3)', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      render(<TeamFilterDropdown selectedFilter={filterAll} onFilterChange={mockOnFilterChange} teilnehmer={defaultTeilnehmer} currentUserId={defaultCurrentUserId} />);

      // When (Act)
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByRole('option', { name: /Meine/i }));

      // Then (Assert) - Tagged Union Type
      expect(mockOnFilterChange).toHaveBeenCalledWith({ type: 'mine' });
    });

    it('should call onFilterChange with "unassigned" when selecting "Unzugewiesen" (AC4)', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      render(<TeamFilterDropdown selectedFilter={filterAll} onFilterChange={mockOnFilterChange} teilnehmer={defaultTeilnehmer} currentUserId={defaultCurrentUserId} />);

      // When (Act)
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByRole('option', { name: /Unzugewiesen/i }));

      // Then (Assert) - Tagged Union Type
      expect(mockOnFilterChange).toHaveBeenCalledWith({ type: 'unassigned' });
    });

    it('should call onFilterChange with "all" when selecting "Alle" (AC5)', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      render(<TeamFilterDropdown selectedFilter={filterMine} onFilterChange={mockOnFilterChange} teilnehmer={defaultTeilnehmer} currentUserId={defaultCurrentUserId} />);

      // When (Act)
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByRole('option', { name: /Alle/i }));

      // Then (Assert) - Tagged Union Type
      expect(mockOnFilterChange).toHaveBeenCalledWith({ type: 'all' });
    });

    it('should call onFilterChange with userId when selecting teilnehmer (AC2)', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      render(<TeamFilterDropdown selectedFilter={filterAll} onFilterChange={mockOnFilterChange} teilnehmer={defaultTeilnehmer} currentUserId={defaultCurrentUserId} />);

      // When (Act)
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByRole('option', { name: /Thomas Mueller/i }));

      // Then (Assert) - Tagged Union Type with userId
      expect(mockOnFilterChange).toHaveBeenCalledWith({ type: 'user', userId: 'user-1' });
    });
  });

  describe('visual feedback (AC2)', () => {
    it('should show active filter indicator when filter is not "all"', () => {
      // Given (Arrange)
      // When (Act)
      render(<TeamFilterDropdown selectedFilter={filterMine} onFilterChange={mockOnFilterChange} teilnehmer={defaultTeilnehmer} currentUserId={defaultCurrentUserId} />);

      // Then (Assert)
      // Should have visual indicator (badge or highlight)
      const button = screen.getByRole('button');
      expect(button.className).toMatch(/bg-primary|text-primary/);
    });

    it('should not show active filter indicator when filter is "all"', () => {
      // Given (Arrange)
      // When (Act)
      render(<TeamFilterDropdown selectedFilter={filterAll} onFilterChange={mockOnFilterChange} teilnehmer={defaultTeilnehmer} currentUserId={defaultCurrentUserId} />);

      // Then (Assert)
      const button = screen.getByRole('button');
      // Default state should not have primary colors
      expect(button.className).not.toMatch(/bg-primary-[56]00/);
    });
  });

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      // Given (Arrange)
      // When (Act)
      render(<TeamFilterDropdown selectedFilter={filterAll} onFilterChange={mockOnFilterChange} teilnehmer={defaultTeilnehmer} currentUserId={defaultCurrentUserId} disabled />);

      // Then (Assert)
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('edge cases', () => {
    it('should handle unknown userId filter gracefully', () => {
      // Given (Arrange)
      // When (Act)
      render(<TeamFilterDropdown selectedFilter={filterUnknownUser} onFilterChange={mockOnFilterChange} teilnehmer={defaultTeilnehmer} currentUserId={defaultCurrentUserId} />);

      // Then (Assert)
      // Should show fallback text or unknown indicator
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should handle many teilnehmer without performance issues', async () => {
      // Given (Arrange)
      const manyTeilnehmer: Teilnehmer[] = Array.from({ length: 50 }, (_, i) => ({
        id: `user-${i}`,
        name: `User ${i}`,
      }));
      const user = userEvent.setup();

      // When (Act)
      render(<TeamFilterDropdown selectedFilter={filterAll} onFilterChange={mockOnFilterChange} teilnehmer={manyTeilnehmer} currentUserId={defaultCurrentUserId} />);
      await user.click(screen.getByRole('button'));

      // Then (Assert)
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      // Should have scrollable list
      expect(screen.getAllByRole('option').length).toBeGreaterThan(3);
    });
  });
});
