/**
 * `PatientListRow` Molecule (Story 1.6, AC8).
 *
 * Tabellen-Zeile für die `PatientenListe`-Organism. Komponiert die bestehenden
 * Status-Atoms/Molecules im Read-Only-Modus:
 *  - `SkBadge` (Atom, Story 1.2) — `size='sm'` für kompakte Zeilen-Höhe.
 *  - `BehandlungsStatusPillGroup` mit `readOnly` (Story 1.4 → 1.6-Erweiterung).
 *  - `TransportStatusPillGroup` mit `readOnly` (Story 1.4 → 1.6-Erweiterung).
 *
 * Click-Verhalten: leitet `onClick` an den Parent durch — die Detail-Drawer-
 * Wiring kommt in Story 1.7. Die `highlighted`-Prop ist Forward-Compat für
 * WS-Push-Highlighting (Story 3.1).
 */
import type { BehandlungsstatusEnum, PatientListItemDto, SkEnum, TransportstatusEnum } from '@bluelight-hub/shared/client';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useMemo } from 'react';
import { clsx } from 'clsx';
import { BEHANDLUNG_LABELS } from '../constants/behandlungs-status-labels';
import { SK_LABELS } from '../constants/sk-labels';
import { TRANSPORT_LABELS } from '../constants/transport-status-labels';
import { BehandlungsStatusPillGroup } from './behandlungs-status-pill-group';
import { SkBadge } from './sk-badge';
import { TransportStatusPillGroup } from './transport-status-pill-group';

export interface PatientListRowProps {
  patient: PatientListItemDto;
  onClick?: () => void;
  /**
   * Highlight-Animation nach Echtzeit-Update (Story 3.1, WS-Reconcile).
   * In Story 1.6 nur als Prop verfügbar — die Verdrahtung folgt später.
   */
  highlighted?: boolean;
}

export function PatientListRow({ patient, onClick, highlighted }: PatientListRowProps) {
  const relativeTime = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(patient.erfasstAm), { addSuffix: true, locale: de });
    } catch {
      return patient.erfasstAm;
    }
  }, [patient.erfasstAm]);

  const skLabel = SK_LABELS[patient.aktuelleSk as SkEnum]?.label ?? patient.aktuelleSk;
  const behandlungLabel = BEHANDLUNG_LABELS[patient.behandlungsstatus as BehandlungsstatusEnum]?.label ?? patient.behandlungsstatus;
  const transportLabel = TRANSPORT_LABELS[patient.transportstatus as TransportstatusEnum]?.label ?? patient.transportstatus;

  const ariaLabel = `Patient ${patient.patientennummer}, ${skLabel}, Behandlung ${behandlungLabel}, Transport ${transportLabel}, erfasst ${relativeTime}`;

  const Element = onClick ? 'button' : 'div';

  return (
    <Element
      type={onClick ? 'button' : undefined}
      role="row"
      aria-label={ariaLabel}
      data-testid={`patient-list-row-${patient.id}`}
      onClick={onClick}
      className={clsx(
        'grid w-full grid-cols-[7rem_minmax(5rem,_8rem)_minmax(8rem,_1fr)_minmax(8rem,_10rem)_minmax(8rem,_10rem)_minmax(7rem,_9rem)] items-center gap-3 border-b border-border-subtle px-4 py-3 text-left text-sm transition-colors',
        onClick ? 'hover:bg-surface-elevated focus-visible:bg-surface-elevated focus-visible:shadow-focus-ring focus-visible:outline-none' : '',
        highlighted ? 'animate-highlight-updated motion-reduce:animate-none' : '',
      )}
      style={{ minHeight: 56 }}
    >
      <span className="font-mono text-body-md tabular-nums" data-testid="patient-list-row-nummer">
        {patient.patientennummer}
      </span>

      <span data-testid="patient-list-row-sk">
        <SkBadge sk={patient.aktuelleSk as SkEnum} size="sm" />
      </span>

      <span className={clsx('truncate', patient.name ? 'text-text-primary' : 'text-text-muted')} data-testid="patient-list-row-name" title={patient.name ?? undefined}>
        {patient.name ?? '—'}
      </span>

      <span data-testid="patient-list-row-behandlung">
        <BehandlungsStatusPillGroup readOnly currentStatus={patient.behandlungsstatus as BehandlungsstatusEnum} size="sm" />
      </span>

      <span data-testid="patient-list-row-transport">
        <TransportStatusPillGroup readOnly currentStatus={patient.transportstatus as TransportstatusEnum} size="sm" />
      </span>

      <span className="text-text-secondary tabular-nums" data-testid="patient-list-row-zeit">
        {relativeTime}
      </span>
    </Element>
  );
}
