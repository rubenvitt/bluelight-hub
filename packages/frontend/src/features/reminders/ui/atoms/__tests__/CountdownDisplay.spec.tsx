/**
 * Unit Tests für CountdownDisplay Atom
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.7 AC3, AC4:**
 * - CountdownDisplay zeigt verbleibende Zeit an
 * - Format "Xh Ym", "Xm", "Xm Ys", "Xs", "Jetzt fällig!"
 * - Farbwechsel basierend auf verbleibender Zeit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CountdownDisplay } from '../CountdownDisplay';

describe('CountdownDisplay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('AC3: Format-Anzeige', () => {
    it('should display hours and minutes format (e.g., "2h 15m")', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T12:15:00Z'); // 2h 15m ahead

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} />);

      // Then (Assert)
      expect(screen.getByText('2h 15m')).toBeInTheDocument();
    });

    it('should display only minutes format (e.g., "45m")', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:45:00Z'); // 45 minutes ahead

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} />);

      // Then (Assert)
      expect(screen.getByText('45m')).toBeInTheDocument();
    });

    it('should display minutes and seconds format for < 2 minutes (e.g., "1m 30s")', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:01:30Z'); // 1m 30s ahead

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} />);

      // Then (Assert)
      expect(screen.getByText('1m 30s')).toBeInTheDocument();
    });

    it('should display only seconds for < 1 minute (e.g., "30s")', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:00:30Z'); // 30 seconds ahead

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} />);

      // Then (Assert)
      expect(screen.getByText('30s')).toBeInTheDocument();
    });

    it('should display "Jetzt fällig!" when overdue', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T09:55:00Z'); // 5 minutes past

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} />);

      // Then (Assert)
      expect(screen.getByText('Jetzt fällig!')).toBeInTheDocument();
    });

    it('should handle string date input', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = '2026-01-20T10:10:00Z'; // 10 minutes ahead

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} />);

      // Then (Assert)
      expect(screen.getByText('10m')).toBeInTheDocument();
    });
  });

  describe('AC3: Farbwechsel basierend auf Zeit', () => {
    it('should have green text color for > 5 minutes (normal)', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:10:00Z'); // 10 minutes

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} />);

      // Then (Assert)
      const display = screen.getByText('10m');
      expect(display.className).toMatch(/text-green/);
    });

    it('should have yellow text color for 2-5 minutes (warning)', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:03:00Z'); // 3 minutes

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} />);

      // Then (Assert)
      const display = screen.getByText('3m');
      expect(display.className).toMatch(/text-yellow/);
    });

    it('should have orange text color for < 2 minutes (urgent)', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:01:00Z'); // 1 minute

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} />);

      // Then (Assert)
      const display = screen.getByText('1m 0s');
      expect(display.className).toMatch(/text-orange/);
    });

    it('should have red text color when overdue (critical)', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T09:55:00Z'); // past

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} />);

      // Then (Assert)
      const display = screen.getByText('Jetzt fällig!');
      expect(display.className).toMatch(/text-red/);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-live="off" initially to prevent screen reader spam', () => {
      // Given (Arrange) - Fix Issue #4: aria-live spam
      // aria-live ist initial "off" um zu verhindern, dass Screen Reader
      // bei jedem 1s Update die Zeit vorlesen. Es wird nur "polite" wenn
      // sich das urgency level ändert.
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:05:00Z');

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} />);

      // Then (Assert)
      const display = screen.getByText('5m');
      expect(display).toHaveAttribute('aria-live', 'off');
    });

    it('should have aria-atomic="true" for complete announcements', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:05:00Z');

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} />);

      // Then (Assert)
      const display = screen.getByText('5m');
      expect(display).toHaveAttribute('aria-atomic', 'true');
    });

    it('should have role="timer"', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:05:00Z');

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} />);

      // Then (Assert)
      const display = screen.getByRole('timer');
      expect(display).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:05:00Z');

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} className="my-custom-class" />);

      // Then (Assert)
      const display = screen.getByText('5m');
      expect(display.className).toContain('my-custom-class');
    });
  });

  describe('Dark Mode', () => {
    it('should have dark mode classes', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:05:00Z');

      // When (Act)
      render(<CountdownDisplay faelligAm={faelligAm} />);

      // Then (Assert)
      const display = screen.getByText('5m');
      expect(display.className).toMatch(/dark:/);
    });
  });
});
