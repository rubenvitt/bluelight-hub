/**
 * Unit Tests fuer PermissionGate Komponente
 *
 * Verifiziert:
 * - Rendert children wenn Permission zugaenglich ist
 * - Rendert Fallback wenn Permission verweigert ist
 * - Rendert null als Default wenn verweigert (kein Fallback)
 * - Rendert null waehrend des Ladens
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock fuer useCanAccess
const { mockUseCanAccess } = vi.hoisted(() => ({
  mockUseCanAccess: vi.fn(),
}));

vi.mock('../../../hooks', () => ({
  useCanAccess: (area: string) => mockUseCanAccess(area),
}));

import { PermissionGate } from '../PermissionGate';

describe('PermissionGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rendert children wenn Permission zugaenglich ist', () => {
    mockUseCanAccess.mockReturnValue({
      accessible: true,
      isLoading: false,
      reason: null,
    });

    render(
      <PermissionGate permission="stammdaten">
        <div data-testid="protected-content">Geschuetzter Inhalt</div>
      </PermissionGate>,
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.getByText('Geschuetzter Inhalt')).toBeInTheDocument();
    expect(mockUseCanAccess).toHaveBeenCalledWith('stammdaten');
  });

  it('rendert Fallback wenn Permission verweigert ist', () => {
    mockUseCanAccess.mockReturnValue({
      accessible: false,
      isLoading: false,
      reason: 'Kein Zugang',
    });

    render(
      <PermissionGate permission="admin" fallback={<div data-testid="fallback">Kein Zugang</div>}>
        <div data-testid="protected-content">Admin-Bereich</div>
      </PermissionGate>,
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('rendert null als Default wenn verweigert und kein Fallback angegeben', () => {
    mockUseCanAccess.mockReturnValue({
      accessible: false,
      isLoading: false,
      reason: 'Nur Administratoren',
    });

    const { container } = render(
      <PermissionGate permission="admin">
        <div data-testid="protected-content">Admin-Bereich</div>
      </PermissionGate>,
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(container.innerHTML).toBe('');
  });

  it('rendert null waehrend des Ladens', () => {
    mockUseCanAccess.mockReturnValue({
      accessible: false,
      isLoading: true,
      reason: null,
    });

    const { container } = render(
      <PermissionGate permission="stammdaten">
        <div data-testid="protected-content">Inhalt</div>
      </PermissionGate>,
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(container.innerHTML).toBe('');
  });

  it('uebergibt den korrekten Permission-String an useCanAccess', () => {
    mockUseCanAccess.mockReturnValue({
      accessible: true,
      isLoading: false,
      reason: null,
    });

    render(
      <PermissionGate permission="einsaetze">
        <div>Einsaetze</div>
      </PermissionGate>,
    );

    expect(mockUseCanAccess).toHaveBeenCalledWith('einsaetze');
  });

  it('rendert keine children waehrend des Ladens auch wenn accessible true waere', () => {
    // Edge-Case: isLoading=true hat Vorrang
    mockUseCanAccess.mockReturnValue({
      accessible: true,
      isLoading: true,
      reason: null,
    });

    const { container } = render(
      <PermissionGate permission="stammdaten">
        <div data-testid="protected-content">Inhalt</div>
      </PermissionGate>,
    );

    // PermissionGate gibt null zurueck bei isLoading, unabhaengig von accessible
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(container.innerHTML).toBe('');
  });
});
