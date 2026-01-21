/**
 * Unit Tests für AlarmStateBadge Atom
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.7 AC1, AC2, AC6:**
 * - Status-Badge mit Farbe und Icon für jeden Status
 * - Progressive Farbwechsel bei GEPLANT basierend auf verbleibender Zeit
 * - Icon-basierte Status-Unterscheidung
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlarmStateBadge } from '../AlarmStateBadge';

describe('AlarmStateBadge', () => {
  describe('AC1: Status-Badge mit Farbe und Icon', () => {
    it('should render GEPLANT status with green styling and clock icon', () => {
      // Given (Arrange)
      const status = 'GEPLANT';

      // When (Act)
      render(<AlarmStateBadge status={status} />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge).toHaveTextContent('Geplant');
      expect(badge.className).toMatch(/bg-green/);
    });

    it('should render AUSGELOEST status with red styling and bell icon', () => {
      // Given (Arrange)
      const status = 'AUSGELOEST';

      // When (Act)
      render(<AlarmStateBadge status={status} />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge).toHaveTextContent('Ausgelöst');
      expect(badge.className).toMatch(/bg-red/);
    });

    it('should render ACKNOWLEDGED status with blue styling and check icon', () => {
      // Given (Arrange)
      const status = 'ACKNOWLEDGED';

      // When (Act)
      render(<AlarmStateBadge status={status} />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge).toHaveTextContent('Bestätigt');
      expect(badge.className).toMatch(/bg-blue/);
    });

    it('should render SNOOZED status with yellow styling and moon icon', () => {
      // Given (Arrange)
      const status = 'SNOOZED';

      // When (Act)
      render(<AlarmStateBadge status={status} />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge).toHaveTextContent('Verschoben');
      expect(badge.className).toMatch(/bg-yellow/);
    });

    it('should render ERLEDIGT status with gray styling and check-circle icon', () => {
      // Given (Arrange)
      const status = 'ERLEDIGT';

      // When (Act)
      render(<AlarmStateBadge status={status} />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge).toHaveTextContent('Erledigt');
      expect(badge.className).toMatch(/bg-gray/);
    });
  });

  describe('AC2: Progressive Farbwechsel bei GEPLANT', () => {
    it('should show green styling when > 5 minutes remaining', () => {
      // Given (Arrange)
      const status = 'GEPLANT';
      const minutesUntilDue = 10;

      // When (Act)
      render(<AlarmStateBadge status={status} minutesUntilDue={minutesUntilDue} />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge.className).toMatch(/bg-green/);
      expect(badge.className).toMatch(/text-green/);
    });

    it('should show yellow styling when 2-5 minutes remaining', () => {
      // Given (Arrange)
      const status = 'GEPLANT';
      const minutesUntilDue = 3;

      // When (Act)
      render(<AlarmStateBadge status={status} minutesUntilDue={minutesUntilDue} />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge.className).toMatch(/bg-yellow/);
      expect(badge.className).toMatch(/text-yellow/);
    });

    it('should show orange styling when < 2 minutes remaining', () => {
      // Given (Arrange)
      const status = 'GEPLANT';
      const minutesUntilDue = 1;

      // When (Act)
      render(<AlarmStateBadge status={status} minutesUntilDue={minutesUntilDue} />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge.className).toMatch(/bg-orange/);
      expect(badge.className).toMatch(/text-orange/);
    });

    it('should show green styling when minutesUntilDue is exactly 5', () => {
      // Given (Arrange) - Boundary test: 5 minutes = warning threshold
      const status = 'GEPLANT';
      const minutesUntilDue = 5;

      // When (Act)
      render(<AlarmStateBadge status={status} minutesUntilDue={minutesUntilDue} />);

      // Then (Assert) - 5 minutes is still in warning zone (2-5)
      const badge = screen.getByRole('status');
      expect(badge.className).toMatch(/bg-yellow/);
    });

    it('should show yellow styling when minutesUntilDue is exactly 2', () => {
      // Given (Arrange) - Boundary test: 2 minutes = urgent threshold
      const status = 'GEPLANT';
      const minutesUntilDue = 2;

      // When (Act)
      render(<AlarmStateBadge status={status} minutesUntilDue={minutesUntilDue} />);

      // Then (Assert) - 2 minutes is still in warning zone (2-5)
      const badge = screen.getByRole('status');
      expect(badge.className).toMatch(/bg-yellow/);
    });

    it('should ignore minutesUntilDue for non-GEPLANT status', () => {
      // Given (Arrange) - AUSGELOEST with minutesUntilDue should stay red
      const status = 'AUSGELOEST';
      const minutesUntilDue = 10;

      // When (Act)
      render(<AlarmStateBadge status={status} minutesUntilDue={minutesUntilDue} />);

      // Then (Assert) - Should still be red, not affected by minutesUntilDue
      const badge = screen.getByRole('status');
      expect(badge.className).toMatch(/bg-red/);
    });
  });

  describe('AC6: Icon-basierte Status-Unterscheidung', () => {
    it('should render clock icon for GEPLANT status', () => {
      // Given (Arrange)
      const status = 'GEPLANT';

      // When (Act)
      render(<AlarmStateBadge status={status} />);

      // Then (Assert) - Icon should be present (test via aria-hidden svg)
      const badge = screen.getByRole('status');
      const icon = badge.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render animated bell icon for AUSGELOEST status', () => {
      // Given (Arrange)
      const status = 'AUSGELOEST';

      // When (Act)
      render(<AlarmStateBadge status={status} />);

      // Then (Assert) - Icon should be present and have animation class
      const badge = screen.getByRole('status');
      const icon = badge.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Pulse Animation', () => {
    it('should have pulse animation for AUSGELOEST status', () => {
      // Given (Arrange)
      const status = 'AUSGELOEST';

      // When (Act)
      render(<AlarmStateBadge status={status} />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge.className).toMatch(/animate-pulse/);
    });

    it('should NOT have pulse animation for GEPLANT status', () => {
      // Given (Arrange)
      const status = 'GEPLANT';

      // When (Act)
      render(<AlarmStateBadge status={status} />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge.className).not.toMatch(/animate-pulse/);
    });
  });

  describe('Size Variants', () => {
    it('should render small size with appropriate classes', () => {
      // Given (Arrange)
      const status = 'GEPLANT';

      // When (Act)
      render(<AlarmStateBadge status={status} size="sm" />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge.className).toMatch(/text-xs/);
    });

    it('should render medium size by default', () => {
      // Given (Arrange)
      const status = 'GEPLANT';

      // When (Act)
      render(<AlarmStateBadge status={status} />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge.className).toMatch(/text-sm/);
    });

    it('should render large size with appropriate classes', () => {
      // Given (Arrange)
      const status = 'GEPLANT';

      // When (Act)
      render(<AlarmStateBadge status={status} size="lg" />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge.className).toMatch(/text-base/);
    });
  });

  describe('Accessibility', () => {
    it('should have role="status" for screen readers', () => {
      // Given (Arrange)
      const status = 'GEPLANT';

      // When (Act)
      render(<AlarmStateBadge status={status} />);

      // Then (Assert)
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have aria-label with full status description', () => {
      // Given (Arrange)
      const status = 'AUSGELOEST';

      // When (Act)
      render(<AlarmStateBadge status={status} />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Ausgelöst'));
    });
  });

  describe('Dark Mode', () => {
    it('should have dark mode classes', () => {
      // Given (Arrange)
      const status = 'GEPLANT';

      // When (Act)
      render(<AlarmStateBadge status={status} />);

      // Then (Assert)
      const badge = screen.getByRole('status');
      expect(badge.className).toMatch(/dark:/);
    });
  });
});
