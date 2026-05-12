import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { useMemo } from 'react';
import { PiClockCounterClockwise, PiInfo, PiWarningFill } from 'react-icons/pi';
import { useEigenschutzSyncStatus, type EigenschutzSyncStatus } from '@/features/eigenschutz/hooks/useEigenschutzSyncStatus';
import { cn } from '@/shared/ui/cn';
import { SyncStatusBadge } from './SyncStatusBadge';

export interface EigenschutzSyncStatusPopoverProps {
  readonly einsatzId: string;
  readonly syncStatus?: EigenschutzSyncStatus;
  readonly onOpenConflicts?: () => void;
}

function formatTimestamp(input: string | null): string {
  if (!input) return 'Noch nicht bekannt';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'Unbekannter Zeitpunkt';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatPendingLabel(count: number): string {
  if (count === 0) return 'Keine lokalen Änderungen';
  if (count === 1) return '1 lokale Änderung';
  return `${count} lokale Änderungen`;
}

function formatConflictLabel(count: number): string {
  if (count === 0) return 'Keine offenen Konflikte';
  if (count === 1) return '1 offener Konflikt';
  return `${count} offene Konflikte`;
}

export function EigenschutzSyncStatusPopover({ einsatzId, syncStatus, onOpenConflicts }: EigenschutzSyncStatusPopoverProps) {
  if (syncStatus !== undefined) {
    return <EigenschutzSyncStatusPopoverView einsatzId={einsatzId} syncStatus={syncStatus} onOpenConflicts={onOpenConflicts} />;
  }
  return <LiveEigenschutzSyncStatusPopover einsatzId={einsatzId} onOpenConflicts={onOpenConflicts} />;
}

function LiveEigenschutzSyncStatusPopover({ einsatzId, onOpenConflicts }: Omit<EigenschutzSyncStatusPopoverProps, 'syncStatus'>) {
  const liveSyncStatus = useEigenschutzSyncStatus(einsatzId);
  return <EigenschutzSyncStatusPopoverView einsatzId={einsatzId} syncStatus={liveSyncStatus} onOpenConflicts={onOpenConflicts} />;
}

function EigenschutzSyncStatusPopoverView({
  einsatzId,
  syncStatus,
  onOpenConflicts,
}: Required<Pick<EigenschutzSyncStatusPopoverProps, 'einsatzId' | 'syncStatus'>> & Pick<EigenschutzSyncStatusPopoverProps, 'onOpenConflicts'>) {
  // Goal G6: Konflikte werden nicht mehr als eigene Seite, sondern als Drawer
  // an der Eigenschutz-Layout-Route geöffnet. Der `href` ist ein
  // No-JS-Fallback; mit JS überschreibt der `onClick`-Handler die Navigation
  // und ruft `onOpenConflicts` auf, der den Drawer öffnet.
  const conflictHref = useMemo(() => `/app/einsatz/${encodeURIComponent(einsatzId)}/sicherheit/eigenschutz?openConflicts=1`, [einsatzId]);

  return (
    <Popover className="relative inline-flex max-w-full">
      <PopoverButton
        as="button"
        type="button"
        data-testid="eigenschutz-sync-status-trigger"
        className={cn('inline-flex max-w-full rounded-control text-left focus:outline-none focus-visible:shadow-focus-ring')}
      >
        <SyncStatusBadge status={syncStatus.status} pendingCount={syncStatus.pendingCount} />
      </PopoverButton>
      <PopoverPanel
        transition
        anchor={{ to: 'bottom end', gap: 6, padding: 8 }}
        className={cn(
          'z-30 w-[min(22rem,calc(100vw-2rem))] rounded-panel border border-border-subtle bg-surface-panel p-3 text-text-primary shadow-panel',
          'ring-1 ring-border-subtle/50 focus:outline-none',
          'transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0',
        )}
        data-testid="eigenschutz-sync-status-popover"
      >
        {({ close }) => (
          <div className="flex flex-col gap-3 text-body-sm">
            <header className="flex items-start gap-2">
              <PiInfo className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-body-sm font-semibold text-text-primary">Sync-Status</h2>
                <p className="text-body-xs text-text-secondary">Lokale Änderungen und Konflikte bleiben sichtbar.</p>
              </div>
            </header>

            {syncStatus.hasStorageReadError ? (
              <div
                role="status"
                className="rounded-control border border-sync-pending-border bg-sync-pending-surface px-3 py-2 text-body-xs text-sync-pending-text"
                data-testid="eigenschutz-sync-status-storage-error"
              >
                Lokaler Sync-Status konnte nicht vollständig gelesen werden.
              </div>
            ) : null}

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
              <dt className="text-text-muted">Lokal</dt>
              <dd className="font-medium text-text-primary">{formatPendingLabel(syncStatus.pendingCount)}</dd>

              <dt className="text-text-muted">Älteste lokale Änderung</dt>
              <dd className="font-medium text-text-primary">{formatTimestamp(syncStatus.oldestPendingAt)}</dd>

              <dt className="text-text-muted">Letzte Sync-Zeit</dt>
              <dd className="font-medium text-text-primary">{formatTimestamp(syncStatus.lastSyncAt)}</dd>

              <dt className="text-text-muted">Konflikte</dt>
              <dd className="font-medium text-text-primary">{formatConflictLabel(syncStatus.conflictCount)}</dd>
            </dl>

            {syncStatus.hasPausedConflictQuery ? (
              <p className="rounded-control border border-sync-pending-border bg-sync-pending-surface px-3 py-2 text-body-xs text-sync-pending-text">
                Sync-Prüfung pausiert. Der Status wird aktualisiert, sobald die Verbindung wieder steht.
              </p>
            ) : null}

            {syncStatus.conflictCount > 0 ? (
              <a
                href={conflictHref}
                data-testid="eigenschutz-sync-conflicts-link"
                onClick={(event) => {
                  if (onOpenConflicts !== undefined) {
                    event.preventDefault();
                    onOpenConflicts();
                    close();
                  }
                }}
                className={cn(
                  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-sync-conflict-border px-3 py-2 text-body-sm font-medium text-sync-conflict-text',
                  'hover:bg-sync-conflict-surface focus:outline-none focus-visible:shadow-focus-ring',
                )}
              >
                <PiWarningFill className="h-4 w-4" aria-hidden="true" />
                Konflikte auflösen
              </a>
            ) : null}

            <footer className="flex items-center gap-2 border-t border-border-subtle pt-2 text-body-xs text-text-muted">
              <PiClockCounterClockwise className="h-4 w-4" aria-hidden="true" />
              <span>{syncStatus.isOnline ? 'Verbindung aktiv' : 'Verbindung unterbrochen'}</span>
            </footer>
          </div>
        )}
      </PopoverPanel>
    </Popover>
  );
}
