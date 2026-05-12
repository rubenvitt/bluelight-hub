/**
 * Spec für `SyncConflictsDrawer` (Goal G6 — Ablöser der ehemaligen
 * `SyncConflictsPage`).
 *
 * Schwerpunkte:
 * - Schließt-Verhalten bei `isOpen={false}` (kein Render).
 * - Reicht `einsatzId` + `initialFilter` an `ConflictResolutionList` weiter.
 * - Leitet die Rolle aus `useEinsatzRolleContext` ab (BEFEHLSGEBER → can resolve).
 * - Read-Only-Modus für andere Rollen.
 */

import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import type { MeineEinsatzRolleDto } from '@bluelight-hub/shared/client';

const { mocks, listProps } = vi.hoisted(() => ({
  mocks: {
    rolle: { rolle: 'BEFEHLSGEBER', permissions: {} } as MeineEinsatzRolleDto | null,
  },
  listProps: { current: null as Record<string, unknown> | null },
}));

vi.mock('@/features/einsatz', () => ({
  useEinsatzRolleContext: () => ({ meineRolle: mocks.rolle, isLoading: false }),
}));

vi.mock('../ConflictResolutionList', () => ({
  ConflictResolutionList: (props: Record<string, unknown>) => {
    listProps.current = props;
    return (
      <div
        data-testid="conflict-resolution-list-stub"
        data-einsatz-id={String(props.einsatzId ?? '')}
        data-can-resolve={String(props.canResolve)}
        data-initial-filter={JSON.stringify(props.initialFilter ?? null)}
      />
    );
  },
}));

import { SyncConflictsDrawer } from '../SyncConflictsDrawer';

beforeEach(() => {
  mocks.rolle = { rolle: 'BEFEHLSGEBER', permissions: {} } as MeineEinsatzRolleDto;
  listProps.current = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SyncConflictsDrawer', () => {
  it('rendert die ConflictResolutionList, wenn der Drawer offen ist', () => {
    renderWithProviders(<SyncConflictsDrawer einsatzId="einsatz-1" isOpen onClose={() => {}} />);

    expect(screen.getByTestId('sync-conflicts-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-resolution-list-stub')).toBeInTheDocument();
  });

  it('rendert nichts (kein Drawer-Body), wenn isOpen=false', () => {
    renderWithProviders(<SyncConflictsDrawer einsatzId="einsatz-1" isOpen={false} onClose={() => {}} />);

    expect(screen.queryByTestId('sync-conflicts-drawer')).toBeNull();
    expect(screen.queryByTestId('conflict-resolution-list-stub')).toBeNull();
  });

  it('reicht einsatzId und initialFilter an die Liste weiter', () => {
    renderWithProviders(<SyncConflictsDrawer einsatzId="einsatz-42" isOpen onClose={() => {}} initialFilter={{ entityType: 'PSA_PROFIL_ZUWEISUNG', einheitId: 'einheit-7' }} />);

    expect(listProps.current?.einsatzId).toBe('einsatz-42');
    expect(listProps.current?.initialFilter).toEqual({ entityType: 'PSA_PROFIL_ZUWEISUNG', einheitId: 'einheit-7' });
  });

  it('setzt canResolve=true für die Rolle BEFEHLSGEBER', () => {
    mocks.rolle = { rolle: 'BEFEHLSGEBER', permissions: {} } as MeineEinsatzRolleDto;
    renderWithProviders(<SyncConflictsDrawer einsatzId="einsatz-1" isOpen onClose={() => {}} />);
    expect(listProps.current?.canResolve).toBe(true);
  });

  it('setzt canResolve=false für andere Rollen (Read-Only)', () => {
    mocks.rolle = { rolle: 'EMPFAENGER', permissions: {} } as MeineEinsatzRolleDto;
    renderWithProviders(<SyncConflictsDrawer einsatzId="einsatz-1" isOpen onClose={() => {}} />);
    expect(listProps.current?.canResolve).toBe(false);
  });

  it('setzt canResolve=false, wenn keine Rolle zugewiesen ist', () => {
    mocks.rolle = null;
    renderWithProviders(<SyncConflictsDrawer einsatzId="einsatz-1" isOpen onClose={() => {}} />);
    expect(listProps.current?.canResolve).toBe(false);
  });

  it('rendert den Drawer-Titel und die Beschreibung', () => {
    renderWithProviders(<SyncConflictsDrawer einsatzId="einsatz-1" isOpen onClose={() => {}} />);

    expect(screen.getByText('Sync-Konflikte')).toBeInTheDocument();
    expect(screen.getByText(/Multi-Device-Konflikte/)).toBeInTheDocument();
  });
});
