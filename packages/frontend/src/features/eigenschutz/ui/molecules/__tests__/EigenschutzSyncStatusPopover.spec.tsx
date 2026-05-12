import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { EigenschutzSyncStatus } from '../../../hooks/useEigenschutzSyncStatus';

vi.mock('../../../hooks/useEigenschutzSyncStatus', () => ({
  useEigenschutzSyncStatus: () => status(),
}));

import { EigenschutzSyncStatusPopover } from '../EigenschutzSyncStatusPopover';

function status(overrides: Partial<EigenschutzSyncStatus> = {}): EigenschutzSyncStatus {
  return {
    status: 'synced',
    isLoaded: true,
    isOnline: true,
    pendingCount: 0,
    conflictCount: 0,
    oldestPendingAt: null,
    lastSyncAt: null,
    hasStorageReadError: false,
    hasPausedConflictQuery: false,
    ...overrides,
  };
}

describe('EigenschutzSyncStatusPopover', () => {
  it('öffnet Details per Klick und zeigt Pending, Konflikte, letzte Sync-Zeit und Link', async () => {
    const user = userEvent.setup();

    render(
      <EigenschutzSyncStatusPopover
        einsatzId="einsatz-1"
        syncStatus={status({
          status: 'conflict',
          pendingCount: 2,
          conflictCount: 1,
          oldestPendingAt: '2026-05-09T10:00:00.000Z',
          lastSyncAt: '2026-05-09T10:05:00.000Z',
        })}
      />,
    );

    await user.click(screen.getByTestId('eigenschutz-sync-status-trigger'));

    expect(await screen.findByTestId('eigenschutz-sync-status-popover')).toHaveTextContent('2 lokale Änderungen');
    expect(screen.getByTestId('eigenschutz-sync-status-popover')).toHaveTextContent('1 offener Konflikt');
    expect(screen.getByTestId('eigenschutz-sync-status-popover')).toHaveTextContent(/älteste lokale Änderung/i);
    expect(screen.getByTestId('eigenschutz-sync-conflicts-link')).toHaveAttribute('href', '/app/einsatz/einsatz-1/sicherheit/eigenschutz?openConflicts=1');
  });

  it('schließt mit Escape und gibt den Fokus an den Trigger zurück', async () => {
    const user = userEvent.setup();

    render(<EigenschutzSyncStatusPopover einsatzId="einsatz-1" syncStatus={status({ status: 'pending', pendingCount: 1 })} />);

    const trigger = screen.getByTestId('eigenschutz-sync-status-trigger');
    await user.click(trigger);
    expect(await screen.findByTestId('eigenschutz-sync-status-popover')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByTestId('eigenschutz-sync-status-popover')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('zeigt einen ruhigen Fehlerhinweis bei Storage-Lesefehlern', async () => {
    const user = userEvent.setup();

    render(<EigenschutzSyncStatusPopover einsatzId="einsatz-1" syncStatus={status({ status: 'pending', hasStorageReadError: true })} />);

    expect(screen.getByTestId('sync-status-badge')).toHaveTextContent('Sync wird geprüft');

    await user.click(screen.getByTestId('eigenschutz-sync-status-trigger'));

    expect(await screen.findByRole('status')).toHaveTextContent(/lokaler sync-status konnte nicht vollständig gelesen werden/i);
  });

  it('rendert keine Konflikt-Aktion ohne offene Konflikte', async () => {
    const user = userEvent.setup();

    render(<EigenschutzSyncStatusPopover einsatzId="einsatz-1" syncStatus={status({ status: 'pending', pendingCount: 1 })} />);

    await user.click(screen.getByTestId('eigenschutz-sync-status-trigger'));

    expect(screen.queryByTestId('eigenschutz-sync-conflicts-link')).toBeNull();
  });

  it('nutzt stabile Test-IDs für Badge, Trigger und Popover', async () => {
    const user = userEvent.setup();

    render(<EigenschutzSyncStatusPopover einsatzId="einsatz-1" syncStatus={status({ status: 'offline' })} />);

    expect(screen.getByTestId('sync-status-badge')).toBeInTheDocument();
    expect(screen.getByTestId('eigenschutz-sync-status-trigger')).toBeInTheDocument();
    await user.click(screen.getByTestId('eigenschutz-sync-status-trigger'));
    expect(await screen.findByTestId('eigenschutz-sync-status-popover')).toBeInTheDocument();
  });

  it('ruft optionalen Navigate-Handler auf, statt eine zweite Konflikt-Route zu erfinden', async () => {
    const user = userEvent.setup();
    const onOpenConflicts = vi.fn();

    render(<EigenschutzSyncStatusPopover einsatzId="einsatz-1" syncStatus={status({ status: 'conflict', conflictCount: 1 })} onOpenConflicts={onOpenConflicts} />);

    await user.click(screen.getByTestId('eigenschutz-sync-status-trigger'));
    await user.click(await screen.findByTestId('eigenschutz-sync-conflicts-link'));

    expect(onOpenConflicts).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('eigenschutz-sync-status-popover')).not.toBeInTheDocument());
  });
});
