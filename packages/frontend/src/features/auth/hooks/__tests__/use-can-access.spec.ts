/**
 * Unit Tests fuer useCanAccess Hook
 *
 * Verifiziert:
 * - Gibt accessible=true fuer zugaengliche Bereiche zurueck
 * - Gibt accessible=false mit reason fuer gesperrte Bereiche zurueck
 * - Gibt isLoading=true waehrend des Ladens zurueck
 * - Gibt accessible=false wenn keine Daten vorhanden
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock fuer useNavigationPermissions
const { mockUseNavigationPermissions } = vi.hoisted(() => ({
  mockUseNavigationPermissions: vi.fn(),
}));

vi.mock('../use-navigation-permissions', () => ({
  useNavigationPermissions: () => mockUseNavigationPermissions(),
}));

import { useCanAccess } from '../use-can-access';

const mockPermissions = [
  { area: 'stammdaten', accessible: true, reason: null },
  { area: 'einsaetze', accessible: true, reason: null },
  { area: 'admin', accessible: false, reason: 'Nur fuer Administratoren' },
  { area: 'monitoring', accessible: false, reason: null },
];

describe('useCanAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gibt accessible=true fuer zugaengliche Bereiche zurueck', () => {
    mockUseNavigationPermissions.mockReturnValue({
      data: mockPermissions,
      isLoading: false,
    });

    const { result } = renderHook(() => useCanAccess('stammdaten'));

    expect(result.current.accessible).toBe(true);
    expect(result.current.reason).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('gibt accessible=false mit reason fuer gesperrte Bereiche zurueck', () => {
    mockUseNavigationPermissions.mockReturnValue({
      data: mockPermissions,
      isLoading: false,
    });

    const { result } = renderHook(() => useCanAccess('admin'));

    expect(result.current.accessible).toBe(false);
    expect(result.current.reason).toBe('Nur fuer Administratoren');
    expect(result.current.isLoading).toBe(false);
  });

  it('gibt accessible=false mit reason=null fuer gesperrte Bereiche ohne Begruendung zurueck', () => {
    mockUseNavigationPermissions.mockReturnValue({
      data: mockPermissions,
      isLoading: false,
    });

    const { result } = renderHook(() => useCanAccess('monitoring'));

    expect(result.current.accessible).toBe(false);
    expect(result.current.reason).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('gibt isLoading=true waehrend des Ladens zurueck', () => {
    mockUseNavigationPermissions.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { result } = renderHook(() => useCanAccess('stammdaten'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.accessible).toBe(false);
    expect(result.current.reason).toBeNull();
  });

  it('gibt accessible=false wenn keine Daten vorhanden sind', () => {
    mockUseNavigationPermissions.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    const { result } = renderHook(() => useCanAccess('stammdaten'));

    expect(result.current.accessible).toBe(false);
    expect(result.current.reason).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('gibt accessible=false fuer unbekannte Bereiche zurueck', () => {
    mockUseNavigationPermissions.mockReturnValue({
      data: mockPermissions,
      isLoading: false,
    });

    const { result } = renderHook(() => useCanAccess('unbekannt'));

    expect(result.current.accessible).toBe(false);
    expect(result.current.reason).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('gibt accessible=true fuer mehrere zugaengliche Bereiche zurueck', () => {
    mockUseNavigationPermissions.mockReturnValue({
      data: mockPermissions,
      isLoading: false,
    });

    const { result: stammdaten } = renderHook(() => useCanAccess('stammdaten'));
    const { result: einsaetze } = renderHook(() => useCanAccess('einsaetze'));

    expect(stammdaten.current.accessible).toBe(true);
    expect(einsaetze.current.accessible).toBe(true);
  });
});
