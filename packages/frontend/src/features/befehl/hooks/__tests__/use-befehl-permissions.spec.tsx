/**
 * Unit Tests fuer useBefehlPermissions Hook — Story 4.2
 *
 * Verifiziert rollenbasierte Permission-Ableitung aus useMyEinsatzRolle.
 * Der Hook leitet Permissions 1:1 aus der API-Response ab.
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useBefehlPermissions } from '../use-befehl-permissions';
import { useMyEinsatzRolle } from '../../api/use-my-einsatz-rolle';

vi.mock('../../api/use-my-einsatz-rolle');

const EINSATZ_ID = 'einsatz-1';

/** Hilfsfunktion: baut eine vollstaendige Permission-Response */
function makeRolleResponse(rolle: string, permissions: Partial<{
  canCreate: boolean;
  canQuittieren: boolean;
  canKorrigieren: boolean;
  canManageStatus: boolean;
  canExport: boolean;
  canViewAll: boolean;
  isBeobachter: boolean;
}>) {
  return {
    rolle,
    permissions: {
      canCreate: false,
      canQuittieren: false,
      canKorrigieren: false,
      canManageStatus: false,
      canExport: false,
      canViewAll: false,
      isBeobachter: false,
      ...permissions,
    },
  };
}

describe('useBefehlPermissions Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gibt isLoading=true und alle Permissions false zurueck waehrend des Ladens', () => {
    vi.mocked(useMyEinsatzRolle).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useMyEinsatzRolle>);

    const { result } = renderHook(() => useBefehlPermissions(EINSATZ_ID));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.canCreate).toBe(false);
    expect(result.current.canQuittieren).toBe(false);
    expect(result.current.canKorrigieren).toBe(false);
    expect(result.current.canManageStatus).toBe(false);
    expect(result.current.canExport).toBe(false);
    expect(result.current.canViewAll).toBe(false);
    expect(result.current.isBeobachter).toBe(false);
    expect(result.current.rolle).toBeNull();
  });

  it('gibt alle Permissions false zurueck wenn keine Daten vorhanden (null)', () => {
    vi.mocked(useMyEinsatzRolle).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useMyEinsatzRolle>);

    const { result } = renderHook(() => useBefehlPermissions(EINSATZ_ID));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.canCreate).toBe(false);
    expect(result.current.canQuittieren).toBe(false);
    expect(result.current.canKorrigieren).toBe(false);
    expect(result.current.canManageStatus).toBe(false);
    expect(result.current.canExport).toBe(false);
    expect(result.current.canViewAll).toBe(false);
    expect(result.current.isBeobachter).toBe(false);
    expect(result.current.rolle).toBeNull();
  });

  it('BEFEHLSGEBER erhaelt volle Permissions', () => {
    vi.mocked(useMyEinsatzRolle).mockReturnValue({
      data: makeRolleResponse('BEFEHLSGEBER', {
        canCreate: true,
        canQuittieren: true,
        canKorrigieren: true,
        canManageStatus: true,
        canExport: true,
        canViewAll: true,
        isBeobachter: false,
      }),
      isLoading: false,
    } as ReturnType<typeof useMyEinsatzRolle>);

    const { result } = renderHook(() => useBefehlPermissions(EINSATZ_ID));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.rolle).toBe('BEFEHLSGEBER');
    expect(result.current.canCreate).toBe(true);
    expect(result.current.canQuittieren).toBe(true);
    expect(result.current.canKorrigieren).toBe(true);
    expect(result.current.canManageStatus).toBe(true);
    expect(result.current.canExport).toBe(true);
    expect(result.current.canViewAll).toBe(true);
    expect(result.current.isBeobachter).toBe(false);
  });

  it('ERSTELLER kann erstellen und exportieren, aber nicht quittieren oder korrigieren', () => {
    vi.mocked(useMyEinsatzRolle).mockReturnValue({
      data: makeRolleResponse('ERSTELLER', {
        canCreate: true,
        canQuittieren: false,
        canKorrigieren: false,
        canManageStatus: false,
        canExport: true,
        canViewAll: true,
        isBeobachter: false,
      }),
      isLoading: false,
    } as ReturnType<typeof useMyEinsatzRolle>);

    const { result } = renderHook(() => useBefehlPermissions(EINSATZ_ID));

    expect(result.current.rolle).toBe('ERSTELLER');
    expect(result.current.canCreate).toBe(true);
    expect(result.current.canExport).toBe(true);
    expect(result.current.canViewAll).toBe(true);
    expect(result.current.canQuittieren).toBe(false);
    expect(result.current.canKorrigieren).toBe(false);
    expect(result.current.canManageStatus).toBe(false);
    expect(result.current.isBeobachter).toBe(false);
  });

  it('EMPFAENGER kann nur quittieren', () => {
    vi.mocked(useMyEinsatzRolle).mockReturnValue({
      data: makeRolleResponse('EMPFAENGER', {
        canCreate: false,
        canQuittieren: true,
        canKorrigieren: false,
        canManageStatus: false,
        canExport: false,
        canViewAll: false,
        isBeobachter: false,
      }),
      isLoading: false,
    } as ReturnType<typeof useMyEinsatzRolle>);

    const { result } = renderHook(() => useBefehlPermissions(EINSATZ_ID));

    expect(result.current.rolle).toBe('EMPFAENGER');
    expect(result.current.canQuittieren).toBe(true);
    expect(result.current.canCreate).toBe(false);
    expect(result.current.canKorrigieren).toBe(false);
    expect(result.current.canManageStatus).toBe(false);
    expect(result.current.canExport).toBe(false);
    expect(result.current.canViewAll).toBe(false);
    expect(result.current.isBeobachter).toBe(false);
  });

  it('BEOBACHTER kann nur einsehen und ist als Beobachter markiert', () => {
    vi.mocked(useMyEinsatzRolle).mockReturnValue({
      data: makeRolleResponse('BEOBACHTER', {
        canCreate: false,
        canQuittieren: false,
        canKorrigieren: false,
        canManageStatus: false,
        canExport: false,
        canViewAll: true,
        isBeobachter: true,
      }),
      isLoading: false,
    } as ReturnType<typeof useMyEinsatzRolle>);

    const { result } = renderHook(() => useBefehlPermissions(EINSATZ_ID));

    expect(result.current.rolle).toBe('BEOBACHTER');
    expect(result.current.canViewAll).toBe(true);
    expect(result.current.isBeobachter).toBe(true);
    expect(result.current.canCreate).toBe(false);
    expect(result.current.canQuittieren).toBe(false);
    expect(result.current.canKorrigieren).toBe(false);
    expect(result.current.canManageStatus).toBe(false);
    expect(result.current.canExport).toBe(false);
  });

  it('ADMIN erhaelt volle Permissions', () => {
    vi.mocked(useMyEinsatzRolle).mockReturnValue({
      data: makeRolleResponse('ADMIN', {
        canCreate: true,
        canQuittieren: true,
        canKorrigieren: true,
        canManageStatus: true,
        canExport: true,
        canViewAll: true,
        isBeobachter: false,
      }),
      isLoading: false,
    } as ReturnType<typeof useMyEinsatzRolle>);

    const { result } = renderHook(() => useBefehlPermissions(EINSATZ_ID));

    expect(result.current.rolle).toBe('ADMIN');
    expect(result.current.canCreate).toBe(true);
    expect(result.current.canQuittieren).toBe(true);
    expect(result.current.canKorrigieren).toBe(true);
    expect(result.current.canManageStatus).toBe(true);
    expect(result.current.canExport).toBe(true);
    expect(result.current.canViewAll).toBe(true);
    expect(result.current.isBeobachter).toBe(false);
  });

  it('SUPER_ADMIN erhaelt volle Permissions', () => {
    vi.mocked(useMyEinsatzRolle).mockReturnValue({
      data: makeRolleResponse('SUPER_ADMIN', {
        canCreate: true,
        canQuittieren: true,
        canKorrigieren: true,
        canManageStatus: true,
        canExport: true,
        canViewAll: true,
        isBeobachter: false,
      }),
      isLoading: false,
    } as ReturnType<typeof useMyEinsatzRolle>);

    const { result } = renderHook(() => useBefehlPermissions(EINSATZ_ID));

    expect(result.current.rolle).toBe('SUPER_ADMIN');
    expect(result.current.canCreate).toBe(true);
    expect(result.current.canQuittieren).toBe(true);
    expect(result.current.canKorrigieren).toBe(true);
    expect(result.current.canManageStatus).toBe(true);
    expect(result.current.canExport).toBe(true);
    expect(result.current.canViewAll).toBe(true);
    expect(result.current.isBeobachter).toBe(false);
  });

  it('gibt NO_PERMISSIONS zurueck bei API-Fehler (isError)', () => {
    vi.mocked(useMyEinsatzRolle).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as ReturnType<typeof useMyEinsatzRolle>);

    const { result } = renderHook(() => useBefehlPermissions(EINSATZ_ID));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.rolle).toBeNull();
    expect(result.current.canCreate).toBe(false);
    expect(result.current.canQuittieren).toBe(false);
    expect(result.current.canKorrigieren).toBe(false);
    expect(result.current.canManageStatus).toBe(false);
    expect(result.current.canExport).toBe(false);
    expect(result.current.canViewAll).toBe(false);
    expect(result.current.isBeobachter).toBe(false);
  });
});
