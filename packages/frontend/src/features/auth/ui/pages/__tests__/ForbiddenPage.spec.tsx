/**
 * Unit Tests fuer ForbiddenPage Komponente
 *
 * Verifiziert:
 * - Zeigt Forbidden-Nachricht mit Begruendung
 * - Zeigt Default-Nachricht ohne Begruendung
 * - Zeigt vorgeschlagene Aktion als Button
 * - Auto-Fokus auf Zurueck-Button (mit hasInitialFocusRef Guard)
 * - aria-live="polite" fuer Screenreader
 * - role="status"
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-icons/pi', () => ({
  PiWarning: (props: Record<string, unknown>) => <span data-testid="warning-icon" {...props} />,
}));

vi.mock('@/shared/ui/atoms/button.atom', () => ({
  Button: vi.fn(({ children, ref: _ref, ...props }: { children: React.ReactNode; ref?: React.Ref<HTMLButtonElement>; [key: string]: unknown }) => {
    // Verwende forwardRef-Verhalten via callback ref
    return (
      <button
        type="button"
        {...props}
        ref={(el: HTMLButtonElement | null) => {
          if (typeof _ref === 'function') {
            _ref(el);
          } else if (_ref && typeof _ref === 'object') {
            (_ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
          }
        }}
      >
        {children}
      </button>
    );
  }),
}));

import { ForbiddenPage } from '../ForbiddenPage';

describe('ForbiddenPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zeigt die Custom-Begruendung an', () => {
    render(<ForbiddenPage reason="Sie benoetigen die Rolle Einsatzleiter" />);

    expect(screen.getByText('Zugriff nicht freigegeben')).toBeInTheDocument();
    expect(screen.getByText('Sie benoetigen die Rolle Einsatzleiter')).toBeInTheDocument();
  });

  it('zeigt die Default-Nachricht wenn keine Begruendung angegeben', () => {
    render(<ForbiddenPage />);

    expect(screen.getByText('Zugriff nicht freigegeben')).toBeInTheDocument();
    expect(screen.getByText('Dieser Bereich ist für Ihre Rolle nicht freigegeben.')).toBeInTheDocument();
  });

  it('zeigt den vorgeschlagenen Aktions-Button', () => {
    render(<ForbiddenPage suggestedAction="Zum Dashboard" />);

    expect(screen.getByRole('button', { name: 'Zum Dashboard' })).toBeInTheDocument();
  });

  it('zeigt den Default-Aktions-Button', () => {
    render(<ForbiddenPage />);

    expect(screen.getByRole('button', { name: /Zurück zum Überblick/i })).toBeInTheDocument();
  });

  it('navigiert beim Klick auf den Zurueck-Button', async () => {
    const user = userEvent.setup();

    render(<ForbiddenPage backTo="/app/einsaetze" />);

    const button = screen.getByRole('button', { name: /Zurück zum Überblick/i });
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/app/einsaetze' });
  });

  it('navigiert zum custom backTo-Ziel', async () => {
    const user = userEvent.setup();

    render(<ForbiddenPage backTo="/app/dashboard" suggestedAction="Zum Dashboard" />);

    const button = screen.getByRole('button', { name: 'Zum Dashboard' });
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/app/dashboard' });
  });

  it('fokussiert den Zurueck-Button automatisch via useEffect', async () => {
    render(<ForbiddenPage />);

    const button = screen.getByRole('button', { name: /Zurück zum Überblick/i });

    await waitFor(() => {
      expect(document.activeElement).toBe(button);
    });
  });

  it('hat aria-live="polite" fuer Screenreader', () => {
    render(<ForbiddenPage />);

    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('hat role="status"', () => {
    render(<ForbiddenPage />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('zeigt das Warning-Icon', () => {
    render(<ForbiddenPage />);

    expect(screen.getByTestId('warning-icon')).toBeInTheDocument();
  });
});
