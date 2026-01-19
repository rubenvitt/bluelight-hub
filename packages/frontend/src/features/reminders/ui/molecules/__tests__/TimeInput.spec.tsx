/**
 * Unit Tests für TimeInput Molecule
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.2 AC2:**
 * - Time-Picker zeigt Stunden (00-23) und Minuten (00-59)
 * - Input-Verhalten: Nur Zahlen erlauben
 * - Keyboard Navigation: Tab zwischen Feldern
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeInput } from '../TimeInput';

describe('TimeInput', () => {
  describe('Rendering', () => {
    it('should render two input fields for hours and minutes', () => {
      // Given (Arrange)
      const onChange = vi.fn();

      // When (Act)
      render(<TimeInput value={{ hours: 14, minutes: 30 }} onChange={onChange} />);

      // Then (Assert)
      expect(screen.getByLabelText(/stunden/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/minuten/i)).toBeInTheDocument();
    });

    it('should display hours and minutes with leading zeros', () => {
      // Given (Arrange)
      const onChange = vi.fn();

      // When (Act)
      render(<TimeInput value={{ hours: 9, minutes: 5 }} onChange={onChange} />);

      // Then (Assert)
      expect(screen.getByLabelText(/stunden/i)).toHaveValue('09');
      expect(screen.getByLabelText(/minuten/i)).toHaveValue('05');
    });

    it('should render separator between fields', () => {
      // Given (Arrange)
      const onChange = vi.fn();

      // When (Act)
      render(<TimeInput value={{ hours: 12, minutes: 0 }} onChange={onChange} />);

      // Then (Assert)
      expect(screen.getByText(':')).toBeInTheDocument();
    });
  });

  describe('Hours Input', () => {
    it('should accept valid hour input (0-23)', () => {
      // Given (Arrange)
      const onChange = vi.fn();
      render(<TimeInput value={{ hours: 0, minutes: 0 }} onChange={onChange} />);

      // When (Act)
      const hoursInput = screen.getByLabelText(/stunden/i);
      fireEvent.change(hoursInput, { target: { value: '14' } });

      // Then (Assert)
      expect(onChange).toHaveBeenCalledWith({ hours: 14, minutes: 0 });
    });

    it('should clamp hours to max 23', () => {
      // Given (Arrange)
      const onChange = vi.fn();
      render(<TimeInput value={{ hours: 0, minutes: 0 }} onChange={onChange} />);

      // When (Act)
      const hoursInput = screen.getByLabelText(/stunden/i);
      fireEvent.change(hoursInput, { target: { value: '25' } });

      // Then (Assert) - Should clamp to 23
      expect(onChange).toHaveBeenCalledWith({ hours: 23, minutes: 0 });
    });

    it('should reject non-numeric input', () => {
      // Given (Arrange)
      const onChange = vi.fn();
      render(<TimeInput value={{ hours: 14, minutes: 30 }} onChange={onChange} />);

      // When (Act)
      const hoursInput = screen.getByLabelText(/stunden/i);
      fireEvent.change(hoursInput, { target: { value: 'abc' } });

      // Then (Assert) - Should fall back to 0 when no numeric value
      expect(onChange).toHaveBeenCalledWith({ hours: 0, minutes: 30 });
    });
  });

  describe('Minutes Input', () => {
    it('should accept valid minute input (0-59)', () => {
      // Given (Arrange)
      const onChange = vi.fn();
      render(<TimeInput value={{ hours: 14, minutes: 0 }} onChange={onChange} />);

      // When (Act)
      const minutesInput = screen.getByLabelText(/minuten/i);
      fireEvent.change(minutesInput, { target: { value: '45' } });

      // Then (Assert)
      expect(onChange).toHaveBeenCalledWith({ hours: 14, minutes: 45 });
    });

    it('should clamp minutes to max 59', () => {
      // Given (Arrange)
      const onChange = vi.fn();
      render(<TimeInput value={{ hours: 14, minutes: 0 }} onChange={onChange} />);

      // When (Act)
      const minutesInput = screen.getByLabelText(/minuten/i);
      fireEvent.change(minutesInput, { target: { value: '99' } });

      // Then (Assert) - Should clamp to 59
      expect(onChange).toHaveBeenCalledWith({ hours: 14, minutes: 59 });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should auto-focus minutes after entering 2 digits for hours', () => {
      // Given (Arrange)
      const onChange = vi.fn();
      render(<TimeInput value={{ hours: 0, minutes: 0 }} onChange={onChange} />);

      // When (Act) - Simulate entering a 2-digit hour value
      const hoursInput = screen.getByLabelText(/stunden/i);
      hoursInput.focus();
      fireEvent.change(hoursInput, { target: { value: '14' } });

      // Then (Assert) - Focus should have moved to minutes
      const minutesInput = screen.getByLabelText(/minuten/i);
      expect(minutesInput).toHaveFocus();
    });

    it('should allow Tab navigation between fields', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<TimeInput value={{ hours: 14, minutes: 30 }} onChange={onChange} />);

      // When (Act)
      const hoursInput = screen.getByLabelText(/stunden/i);
      hoursInput.focus();
      await user.tab();

      // Then (Assert)
      const minutesInput = screen.getByLabelText(/minuten/i);
      expect(minutesInput).toHaveFocus();
    });
  });

  describe('Disabled State', () => {
    it('should disable both inputs when disabled prop is true', () => {
      // Given (Arrange)
      const onChange = vi.fn();

      // When (Act)
      render(<TimeInput value={{ hours: 14, minutes: 30 }} onChange={onChange} disabled />);

      // Then (Assert)
      expect(screen.getByLabelText(/stunden/i)).toBeDisabled();
      expect(screen.getByLabelText(/minuten/i)).toBeDisabled();
    });
  });

  describe('Error State', () => {
    it('should show error styling when error prop is true', () => {
      // Given (Arrange)
      const onChange = vi.fn();

      // When (Act)
      render(<TimeInput value={{ hours: 14, minutes: 30 }} onChange={onChange} error />);

      // Then (Assert)
      const hoursInput = screen.getByLabelText(/stunden/i);
      const minutesInput = screen.getByLabelText(/minuten/i);
      // Error state should be reflected in className (border-red classes)
      expect(hoursInput.className).toMatch(/border-red/);
      expect(minutesInput.className).toMatch(/border-red/);
    });
  });
});
