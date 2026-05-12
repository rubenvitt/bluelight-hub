/**
 * Spec für `SicherheitsregelCard` (Goal G3 / Story 415-2-6-UI).
 *
 * Fokus:
 * - Render aller Metadaten (Status, Version, Zuordnung, Zeitstempel).
 * - Klick/Enter/Space auf die Card → `onEdit`-Callback.
 * - Inline-Aktion „Bearbeiten" stoppt Propagation, ruft `onEdit` einmal.
 * - Inline-Aktion „Quittungs-Status" delegiert an `onShowQuittungen`.
 */

import { renderWithProviders } from '@/test/utils';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SicherheitsregelCard } from '../SicherheitsregelCard';

const EINSATZ_ID = 'cl1einsatzidforsicherheit';
const REGEL_ID = 'cl1sicherheitsregelxxxxxxxxxx';
const EINHEIT_ID = 'cl1einheitrettungstrupp1';

vi.mock('@/features/eigenschutz/api/queries', () => ({
  useSicherheitsregelQuittungen: () => ({ data: [], isPending: false, isError: false }),
}));

function makeRegel(overrides: Partial<{ version: number; einheitId: string | null }> = {}) {
  return {
    id: REGEL_ID,
    einsatzId: EINSATZ_ID,
    einheitId: null,
    einsatzweit: true,
    titel: 'Absperrung 20 m',
    inhalt: 'Rund um die Einsatzstelle 20 m Abstand halten.',
    version: 1,
    erstelltAm: '2026-04-24T10:00:00.000Z',
    erstelltVonUserId: 'u1',
    aktualisiertAm: '2026-04-24T12:00:00.000Z',
    aktualisiertVonUserId: 'u1',
    propagationGroupId: 'g1',
    ...overrides,
  };
}

describe('SicherheitsregelCard', () => {
  it('rendert Titel, Status-Bekanntgabe (Version 1), Versions-Chip und „Gesamter Einsatz"', () => {
    renderWithProviders(<SicherheitsregelCard einsatzId={EINSATZ_ID} regel={makeRegel()} onEdit={vi.fn()} />);

    expect(screen.getByText('Absperrung 20 m')).toBeInTheDocument();
    expect(screen.getByTestId('sicherheitsregel-status-badge')).toHaveAttribute('data-status', 'info');
    expect(screen.getByTestId(`sicherheitsregel-version-${REGEL_ID}`)).toHaveTextContent('V1');
    expect(screen.getByTestId(`sicherheitsregel-zuordnung-${REGEL_ID}`)).toHaveTextContent('Gesamter Einsatz');
  });

  it('rendert Status „Aktualisiert" ab Version 2 und zeigt den Einheit-Namen', () => {
    renderWithProviders(<SicherheitsregelCard einsatzId={EINSATZ_ID} regel={makeRegel({ version: 3, einheitId: EINHEIT_ID })} einheitName="Rettungstrupp 1" onEdit={vi.fn()} />);

    expect(screen.getByTestId('sicherheitsregel-status-badge')).toHaveAttribute('data-status', 'warning');
    expect(screen.getByTestId(`sicherheitsregel-version-${REGEL_ID}`)).toHaveTextContent('V3');
    expect(screen.getByTestId(`sicherheitsregel-zuordnung-${REGEL_ID}`)).toHaveTextContent('Einheit: Rettungstrupp 1');
  });

  it('Klick auf die Card ruft onEdit mit der Regel', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<SicherheitsregelCard einsatzId={EINSATZ_ID} regel={makeRegel()} onEdit={onEdit} />);
    await user.click(screen.getByTestId(`sicherheitsregel-zeile-${REGEL_ID}`));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: REGEL_ID }));
  });

  it('Klick auf den Bearbeiten-Button ruft onEdit (und nicht doppelt durch Propagation)', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<SicherheitsregelCard einsatzId={EINSATZ_ID} regel={makeRegel()} onEdit={onEdit} />);
    await user.click(screen.getByTestId(`sicherheitsregel-edit-action-${REGEL_ID}`));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('rendert „Quittungs-Status"-Aktion nur, wenn onShowQuittungen gesetzt ist', async () => {
    const onShowQuittungen = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<SicherheitsregelCard einsatzId={EINSATZ_ID} regel={makeRegel()} onEdit={vi.fn()} onShowQuittungen={onShowQuittungen} />);
    const button = screen.getByTestId(`sicherheitsregel-quittungen-action-${REGEL_ID}`);
    await user.click(button);
    expect(onShowQuittungen).toHaveBeenCalledTimes(1);
  });

  it('rendert keinen „Quittungs-Status"-Button, wenn onShowQuittungen fehlt', () => {
    renderWithProviders(<SicherheitsregelCard einsatzId={EINSATZ_ID} regel={makeRegel()} onEdit={vi.fn()} />);
    expect(screen.queryByTestId(`sicherheitsregel-quittungen-action-${REGEL_ID}`)).toBeNull();
  });

  it('Enter auf der Card öffnet den Edit-Drawer', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<SicherheitsregelCard einsatzId={EINSATZ_ID} regel={makeRegel()} onEdit={onEdit} />);
    const card = screen.getByTestId(`sicherheitsregel-zeile-${REGEL_ID}`);
    card.focus();
    await user.keyboard('{Enter}');
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
