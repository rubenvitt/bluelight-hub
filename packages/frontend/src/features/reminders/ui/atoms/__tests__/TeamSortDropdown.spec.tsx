/**
 * Unit Tests fuer TeamSortDropdown Komponente
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 3.8:**
 * - AC2: Sortier-Optionen im UI (Faelligkeit, Erstellt-Datum, Status)
 * - AC3: Anwendung der Sortierung (Callback wird aufgerufen)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamSortDropdown } from '../TeamSortDropdown';

describe('TeamSortDropdown', () => {
  const mockOnSortChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering (AC2)', () => {
    it('should render dropdown button with current sort label', () => {
      // Given (Arrange)
      // When (Act)
      render(<TeamSortDropdown selectedSort="faelligkeit" onSortChange={mockOnSortChange} />);

      // Then (Assert)
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Fälligkeit')).toBeInTheDocument();
    });

    it('should display "Erstellt-Datum" when sort is "erstellt"', () => {
      // Given (Arrange)
      // When (Act)
      render(<TeamSortDropdown selectedSort="erstellt" onSortChange={mockOnSortChange} />);

      // Then (Assert)
      expect(screen.getByText('Erstellt-Datum')).toBeInTheDocument();
    });

    it('should display "Status" when sort is "status"', () => {
      // Given (Arrange)
      // When (Act)
      render(<TeamSortDropdown selectedSort="status" onSortChange={mockOnSortChange} />);

      // Then (Assert)
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  describe('dropdown options (AC2)', () => {
    it('should show all sort options when opened', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      render(<TeamSortDropdown selectedSort="faelligkeit" onSortChange={mockOnSortChange} />);

      // When (Act)
      await user.click(screen.getByRole('button'));

      // Then (Assert)
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Fälligkeit/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Erstellt-Datum/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Status/i })).toBeInTheDocument();
    });
  });

  describe('sort selection (AC3)', () => {
    it('should call onSortChange with "erstellt" when selecting "Erstellt-Datum"', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      render(<TeamSortDropdown selectedSort="faelligkeit" onSortChange={mockOnSortChange} />);

      // When (Act)
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByRole('option', { name: /Erstellt-Datum/i }));

      // Then (Assert)
      expect(mockOnSortChange).toHaveBeenCalledWith('erstellt');
    });

    it('should call onSortChange with "status" when selecting "Status"', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      render(<TeamSortDropdown selectedSort="faelligkeit" onSortChange={mockOnSortChange} />);

      // When (Act)
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByRole('option', { name: /Status/i }));

      // Then (Assert)
      expect(mockOnSortChange).toHaveBeenCalledWith('status');
    });

    it('should call onSortChange with "faelligkeit" when selecting "Fälligkeit"', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      render(<TeamSortDropdown selectedSort="status" onSortChange={mockOnSortChange} />);

      // When (Act)
      await user.click(screen.getByRole('button'));
      await user.click(screen.getByRole('option', { name: /Fälligkeit/i }));

      // Then (Assert)
      expect(mockOnSortChange).toHaveBeenCalledWith('faelligkeit');
    });
  });

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      // Given (Arrange)
      // When (Act)
      render(<TeamSortDropdown selectedSort="faelligkeit" onSortChange={mockOnSortChange} disabled />);

      // Then (Assert)
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should not open dropdown when disabled', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      render(<TeamSortDropdown selectedSort="faelligkeit" onSortChange={mockOnSortChange} disabled />);

      // When (Act)
      await user.click(screen.getByRole('button'));

      // Then (Assert)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      // Given (Arrange)
      const customClass = 'custom-test-class';

      // When (Act)
      const { container } = render(<TeamSortDropdown selectedSort="faelligkeit" onSortChange={mockOnSortChange} className={customClass} />);

      // Then (Assert)
      expect(container.firstChild).toHaveClass(customClass);
    });
  });
});
