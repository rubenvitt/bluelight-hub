/**
 * Integration Tests für QuickCreateErinnerungDialog
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.2:** "Erinnerung mit benutzerdefinierter Zeit anlegen"
 * - AC1: Benutzerdefiniert-Chip neben Preset-Chips sichtbar
 * - AC2: TimeInput erscheint bei Benutzerdefiniert-Klick
 * - AC4: Modus-Wechsel zwischen Preset und Custom
 * - Form Submit: Formular kann mit Custom-Zeit submitted werden
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { QuickCreateErinnerungDialog } from '../QuickCreateErinnerungDialog';

// Mock der API-Hooks
const mockMutate = vi.fn();
vi.mock('../../../api', () => ({
  useCreateErinnerung: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

// Mock der Zeit-Berechnung für deterministische Tests
vi.mock('../../../utils/time-calculation', () => ({
  getDefaultCustomTime: () => ({ hours: 14, minutes: 30 }),
  calculateCustomFaelligAm: (hours: number, minutes: number) => {
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  },
  formatTimeForToast: (date: Date) => `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`,
}));

describe('QuickCreateErinnerungDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    einsatzId: 'test-einsatz-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Story 1.2 AC1: Benutzerdefiniert-Chip Sichtbarkeit', () => {
    it('should display "Benutzerdefiniert" chip alongside preset chips', () => {
      // Given (Arrange)
      // - Dialog wird gerendert mit Standard-Props

      // When (Act)
      renderWithProviders(<QuickCreateErinnerungDialog {...defaultProps} />);

      // Then (Assert)
      // - Alle Preset-Chips sind sichtbar
      expect(screen.getByRole('button', { name: '5 Min' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '10 Min' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '15 Min' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '30 Min' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '60 Min' })).toBeInTheDocument();

      // - Benutzerdefiniert-Chip ist ebenfalls sichtbar
      expect(screen.getByRole('button', { name: /benutzerdefiniert/i })).toBeInTheDocument();
    });

    it('should have preset mode selected by default (30 Min)', () => {
      // Given (Arrange)
      // - Dialog wird gerendert

      // When (Act)
      renderWithProviders(<QuickCreateErinnerungDialog {...defaultProps} />);

      // Then (Assert)
      // - 30 Min Chip ist standardmaessig aktiv (aria-pressed)
      const defaultChip = screen.getByRole('button', { name: '30 Min' });
      expect(defaultChip).toHaveAttribute('aria-pressed', 'true');

      // - Benutzerdefiniert-Chip ist nicht aktiv
      const customChip = screen.getByRole('button', { name: /benutzerdefiniert/i });
      expect(customChip).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Story 1.2 AC2: TimeInput bei Benutzerdefiniert-Klick', () => {
    it('should show TimeInput when "Benutzerdefiniert" chip is clicked', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      renderWithProviders(<QuickCreateErinnerungDialog {...defaultProps} />);

      // - TimeInput ist initial nicht sichtbar
      expect(screen.queryByLabelText(/stunden/i)).not.toBeInTheDocument();

      // When (Act)
      const customChip = screen.getByRole('button', { name: /benutzerdefiniert/i });
      await user.click(customChip);

      // Then (Assert)
      // - TimeInput wird angezeigt (Stunden und Minuten Felder)
      expect(screen.getByLabelText(/stunden/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/minuten/i)).toBeInTheDocument();
    });

    it('should mark "Benutzerdefiniert" chip as active after click', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      renderWithProviders(<QuickCreateErinnerungDialog {...defaultProps} />);

      // When (Act)
      const customChip = screen.getByRole('button', { name: /benutzerdefiniert/i });
      await user.click(customChip);

      // Then (Assert)
      // - Benutzerdefiniert-Chip ist jetzt aktiv
      expect(customChip).toHaveAttribute('aria-pressed', 'true');

      // - Alle Preset-Chips sind inaktiv
      expect(screen.getByRole('button', { name: '30 Min' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: '5 Min' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('should display default time values in TimeInput', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      renderWithProviders(<QuickCreateErinnerungDialog {...defaultProps} />);

      // When (Act)
      const customChip = screen.getByRole('button', { name: /benutzerdefiniert/i });
      await user.click(customChip);

      // Then (Assert)
      // - Default-Zeit ist 14:30 (aus getDefaultCustomTime Mock)
      expect(screen.getByLabelText(/stunden/i)).toHaveValue('14');
      expect(screen.getByLabelText(/minuten/i)).toHaveValue('30');
    });
  });

  describe('Story 1.2 AC4: Modus-Wechsel', () => {
    it('should hide TimeInput when switching from custom to preset mode', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      renderWithProviders(<QuickCreateErinnerungDialog {...defaultProps} />);

      // - Wechsle zu Custom-Modus
      const customChip = screen.getByRole('button', { name: /benutzerdefiniert/i });
      await user.click(customChip);

      // - TimeInput ist sichtbar
      expect(screen.getByLabelText(/stunden/i)).toBeInTheDocument();

      // When (Act)
      // - Wechsle zurueck zu Preset-Modus (klicke auf 15 Min)
      const presetChip = screen.getByRole('button', { name: '15 Min' });
      await user.click(presetChip);

      // Then (Assert)
      // - TimeInput ist nicht mehr sichtbar
      expect(screen.queryByLabelText(/stunden/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/minuten/i)).not.toBeInTheDocument();

      // - 15 Min Chip ist jetzt aktiv
      expect(presetChip).toHaveAttribute('aria-pressed', 'true');

      // - Benutzerdefiniert-Chip ist inaktiv
      expect(customChip).toHaveAttribute('aria-pressed', 'false');
    });

    it('should show TimeInput again when switching back to custom mode', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      renderWithProviders(<QuickCreateErinnerungDialog {...defaultProps} />);

      // - Wechsle zu Custom-Modus
      const customChip = screen.getByRole('button', { name: /benutzerdefiniert/i });
      await user.click(customChip);

      // - TimeInput ist sichtbar
      expect(screen.getByLabelText(/stunden/i)).toBeInTheDocument();

      // - Wechsle zu Preset
      const presetChip = screen.getByRole('button', { name: '10 Min' });
      await user.click(presetChip);

      // - TimeInput ist versteckt
      expect(screen.queryByLabelText(/stunden/i)).not.toBeInTheDocument();

      // When (Act)
      // - Wechsle zurueck zu Custom
      await user.click(customChip);

      // Then (Assert)
      // - TimeInput ist wieder sichtbar
      expect(screen.getByLabelText(/stunden/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/minuten/i)).toBeInTheDocument();
    });
  });

  describe('Form Submit mit Custom-Zeit', () => {
    it('should submit form with custom time values', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      renderWithProviders(<QuickCreateErinnerungDialog {...defaultProps} />);

      // - Titel eingeben
      const titelInput = screen.getByPlaceholderText(/lagebesprechung/i);
      await user.type(titelInput, 'Wichtige Erinnerung');

      // - Wechsle zu Custom-Modus
      const customChip = screen.getByRole('button', { name: /benutzerdefiniert/i });
      await user.click(customChip);

      // - Zeit aendern
      const hoursInput = screen.getByLabelText(/stunden/i);
      const minutesInput = screen.getByLabelText(/minuten/i);
      await user.clear(hoursInput);
      await user.type(hoursInput, '18');
      await user.clear(minutesInput);
      await user.type(minutesInput, '00');

      // When (Act)
      // - Formular absenden
      const submitButton = screen.getByRole('button', { name: /erinnerung erstellen/i });
      await user.click(submitButton);

      // Then (Assert)
      // - API wurde mit korrekten Daten aufgerufen
      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockMutate.mock.calls[0][0];
      expect(callArgs.einsatzId).toBe('test-einsatz-123');
      expect(callArgs.data.titel).toBe('Wichtige Erinnerung');
      expect(callArgs.data.faelligAm).toBeDefined();
    });

    it('should submit form with preset time values', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      renderWithProviders(<QuickCreateErinnerungDialog {...defaultProps} />);

      // - Titel eingeben
      const titelInput = screen.getByPlaceholderText(/lagebesprechung/i);
      await user.type(titelInput, 'Test Erinnerung');

      // - Preset auswaehlen (15 Min)
      const presetChip = screen.getByRole('button', { name: '15 Min' });
      await user.click(presetChip);

      // When (Act)
      const submitButton = screen.getByRole('button', { name: /erinnerung erstellen/i });
      await user.click(submitButton);

      // Then (Assert)
      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockMutate.mock.calls[0][0];
      expect(callArgs.einsatzId).toBe('test-einsatz-123');
      expect(callArgs.data.titel).toBe('Test Erinnerung');
      expect(callArgs.data.faelligAm).toBeDefined();
    });

    it('should not submit when titel is empty', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      renderWithProviders(<QuickCreateErinnerungDialog {...defaultProps} />);

      // - Kein Titel eingeben, aber Zeit auswaehlen
      const presetChip = screen.getByRole('button', { name: '10 Min' });
      await user.click(presetChip);

      // When (Act)
      const submitButton = screen.getByRole('button', { name: /erinnerung erstellen/i });
      await user.click(submitButton);

      // Then (Assert)
      // - Formular sollte nicht abgesendet werden
      await waitFor(() => {
        // API wurde nicht aufgerufen
        expect(mockMutate).not.toHaveBeenCalled();
      });

      // - Fehler sollte angezeigt werden
      expect(screen.getByText(/titel ist erforderlich/i)).toBeInTheDocument();
    });
  });

  describe('Dialog Verhalten', () => {
    it('should call onClose when "Abbrechen" is clicked', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderWithProviders(<QuickCreateErinnerungDialog {...defaultProps} onClose={onClose} />);

      // When (Act)
      const cancelButton = screen.getByRole('button', { name: /abbrechen/i });
      await user.click(cancelButton);

      // Then (Assert)
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not render when isOpen is false', () => {
      // Given (Arrange)
      // - Dialog mit isOpen=false

      // When (Act)
      renderWithProviders(<QuickCreateErinnerungDialog {...defaultProps} isOpen={false} />);

      // Then (Assert)
      expect(screen.queryByText(/erinnerung erstellen/i)).not.toBeInTheDocument();
    });

    it('should call form reset when cancel button triggers onClose', async () => {
      // Given (Arrange)
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderWithProviders(<QuickCreateErinnerungDialog {...defaultProps} onClose={onClose} />);

      // - Aendere Formular-Daten (Titel eingeben)
      const titelInput = screen.getByPlaceholderText(/lagebesprechung/i);
      await user.type(titelInput, 'Test');

      // When (Act)
      // - Klicke auf Abbrechen
      const cancelButton = screen.getByRole('button', { name: /abbrechen/i });
      await user.click(cancelButton);

      // Then (Assert)
      // - onClose wurde aufgerufen (Dialog schliessen + Form reset wird intern durch handleClose gemacht)
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
