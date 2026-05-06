/**
 * Spec für `SicherungspostenList` (Story 4.1, T6).
 *
 * Schwerpunkte:
 * - Tab-Switch lädt die Liste mit korrektem Status-Filter.
 * - Empty-State pro Tab.
 * - Edit-/Auflösen-Aktionen werden nur im AKTIV-Tab gerendert.
 * - „+ Sicherungsposten" nur im AKTIV-Tab sichtbar.
 */

import { renderWithProviders } from '@/test/utils';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMock } = vi.hoisted(() => ({
  listMock: { current: vi.fn() },
}));

vi.mock('../../../api/use-sicherungsposten', () => ({
  useListSicherungsposten: (einsatzId: string, status: 'AKTIV' | 'AUFGELOEST') => listMock.current(einsatzId, status),
}));

import { SicherungspostenList } from '../SicherungspostenList';

const POSTEN_AKTIV = {
  id: 'posten-1',
  einsatzId: 'einsatz-1',
  bezeichnung: 'Eingang Hörsaal C',
  standort: { kind: 'address', text: 'Hörsaal C' },
  personal: [{ kind: 'freitext', name: 'Max Müller' }],
  version: 2,
  erstelltAm: '2026-05-01T10:00:00.000Z',
  erstelltVonUserId: 'user-1',
  aktualisiertAm: '2026-05-01T10:00:00.000Z',
  aktualisiertVonUserId: 'user-1',
};

const POSTEN_AUFGELOEST = {
  ...POSTEN_AKTIV,
  id: 'posten-2',
  bezeichnung: 'Notausgang Süd',
  aufgeloestAm: '2026-05-02T10:00:00.000Z',
};

beforeEach(() => {
  listMock.current = vi.fn((_einsatzId: string, status: 'AKTIV' | 'AUFGELOEST') => {
    if (status === 'AKTIV') return { data: [POSTEN_AKTIV], isPending: false, isError: false };
    return { data: [POSTEN_AUFGELOEST], isPending: false, isError: false };
  });
});

function setup() {
  const onEdit = vi.fn();
  const onAufloesen = vi.fn();
  const onCreate = vi.fn();
  renderWithProviders(<SicherungspostenList einsatzId="einsatz-1" onEdit={onEdit} onAufloesen={onAufloesen} onCreate={onCreate} />);
  return { onEdit, onAufloesen, onCreate };
}

describe('SicherungspostenList', () => {
  it('rendert die AKTIV-Liste initial mit Tab und Tabelle', () => {
    setup();
    expect(screen.getByTestId('sicherungsposten-list')).toBeInTheDocument();
    expect(screen.getByTestId('sicherungsposten-tab-aktiv')).toBeInTheDocument();
    expect(screen.getByTestId('sicherungsposten-tab-aufgeloest')).toBeInTheDocument();
    expect(screen.getByTestId(`sicherungsposten-row-${POSTEN_AKTIV.id}`)).toBeInTheDocument();
  });

  it('zeigt Empty-State wenn keine aktiven Posten existieren', () => {
    listMock.current = vi.fn(() => ({ data: [], isPending: false, isError: false }));
    setup();
    expect(screen.getByTestId('sicherungsposten-empty')).toBeInTheDocument();
  });

  it('Edit-Button im AKTIV-Tab triggert onEdit-Callback mit dem Posten', async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();
    await user.click(screen.getByTestId(`sicherungsposten-edit-${POSTEN_AKTIV.id}`));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: POSTEN_AKTIV.id }));
  });

  it('Auflösen-Button im AKTIV-Tab triggert onAufloesen-Callback', async () => {
    const user = userEvent.setup();
    const { onAufloesen } = setup();
    await user.click(screen.getByTestId(`sicherungsposten-aufloesen-${POSTEN_AKTIV.id}`));
    expect(onAufloesen).toHaveBeenCalledWith(expect.objectContaining({ id: POSTEN_AKTIV.id }));
  });

  it('Create-Button ist nur im AKTIV-Tab sichtbar, nicht im AUFGELOEST-Tab', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByTestId('sicherungsposten-create-button')).toBeInTheDocument();

    await user.click(screen.getByTestId('sicherungsposten-tab-aufgeloest'));
    await waitFor(() => {
      expect(screen.queryByTestId('sicherungsposten-create-button')).not.toBeInTheDocument();
    });
  });

  it('zeigt im AUFGELOEST-Tab keine Edit-Buttons', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByTestId('sicherungsposten-tab-aufgeloest'));
    await waitFor(() => {
      expect(screen.queryByTestId(`sicherungsposten-edit-${POSTEN_AUFGELOEST.id}`)).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId(`sicherungsposten-aufloesen-${POSTEN_AUFGELOEST.id}`)).not.toBeInTheDocument();
  });

  it('zeigt im AKTIV-Tab den „Kein Standort"-Hinweis für address-only Sicherungsposten', () => {
    setup();
    const hint = screen.getByTestId(`sicherungsposten-no-coordinate-hint-${POSTEN_AKTIV.id}`);
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent('Kein Standort — auf Karte nicht sichtbar');
  });

  it('rendert den „Kein Standort"-Hinweis NICHT für coordinate-Sicherungsposten', () => {
    const coordinatePosten = {
      ...POSTEN_AKTIV,
      id: 'posten-coord',
      bezeichnung: 'Koordinaten-Posten',
      standort: { kind: 'coordinate', longitude: 10.5, latitude: 50.3 },
    };
    listMock.current = vi.fn((_einsatzId: string, status: 'AKTIV' | 'AUFGELOEST') => {
      if (status === 'AKTIV') return { data: [coordinatePosten], isPending: false, isError: false };
      return { data: [], isPending: false, isError: false };
    });
    setup();
    expect(screen.queryByTestId('sicherungsposten-no-coordinate-hint-posten-coord')).toBeNull();
  });
});
