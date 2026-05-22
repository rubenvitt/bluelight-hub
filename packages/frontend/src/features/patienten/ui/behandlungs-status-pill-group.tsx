/**
 * `BehandlungsStatusPillGroup` — Inline-Update des Behandlungsstatus
 * (Story 1.4, AC5, FR18). Pattern: `SkUpgradePillGroup` aus Story 1.3.
 *
 * **Bedienfluss:**
 *  1. Aktive Pill ist hervorgehoben (`aria-pressed=true`) und disabled.
 *  2. Tap auf eine Pill mit erlaubtem Übergang öffnet Inline-Confirm
 *     (kein Modal).
 *  3. Pills mit illegalem Übergang sind `aria-disabled=true` mit Tooltip.
 *  4. Bestätigen löst die Mutation aus (Optimistic-UI via
 *     `useBehandlungAktualisieren`); Fehler rendern eine Inline-Fehler-Pill
 *     (`aria-live="assertive"`).
 *
 * **Verbote:** Keine Toasts, keine algorithmische Empfehlung (MDR-Grenze ADR-015).
 */
import type { BehandlungsstatusEnum } from '@bluelight-hub/shared/client';
import { clsx } from 'clsx';
import { useCallback, useMemo, useState } from 'react';
import { BEHANDLUNG_COLOR_MAP } from '../constants/patient-status-color-map';
import { BEHANDLUNG_LABELS } from '../constants/behandlungs-status-labels';
import { BEHANDLUNG_DISPLAY_ORDER, isBehandlungsTransitionAllowed } from '../constants/behandlungs-status-transitions';
import { useBehandlungAktualisieren } from '../api/use-behandlung-aktualisieren';
import { extractErrorCode, extractErrorMessage } from '../api/extract-error-code';

/**
 * Discriminated Union (Story 1.6, AC8):
 *  - Default: voller interaktiver Pill-Group-Modus (Story 1.4-Vertrag, unverändert).
 *  - `readOnly=true`: zeigt nur die aktive Pill an, keine Mutation, kein Loading,
 *    keine `einsatzId`/`patientId` nötig — für Listen-Konsumenten (PatientListRow).
 */
type BehandlungsStatusPillGroupProps =
  | {
      readOnly?: false;
      einsatzId: string;
      patientId: string;
      currentStatus: BehandlungsstatusEnum;
      patientennummer: string;
      size?: 'sm' | 'md';
    }
  | {
      readOnly: true;
      currentStatus: BehandlungsstatusEnum;
      size?: 'sm' | 'md';
      einsatzId?: never;
      patientId?: never;
      patientennummer?: string;
    };

export function BehandlungsStatusPillGroup(props: BehandlungsStatusPillGroupProps) {
  if (props.readOnly) {
    return <BehandlungsStatusReadOnlyPill currentStatus={props.currentStatus} size={props.size ?? 'md'} />;
  }
  return <BehandlungsStatusInteractivePillGroup einsatzId={props.einsatzId} patientId={props.patientId} currentStatus={props.currentStatus} patientennummer={props.patientennummer} />;
}

function BehandlungsStatusReadOnlyPill({ currentStatus, size }: { currentStatus: BehandlungsstatusEnum; size: 'sm' | 'md' }) {
  const colors = BEHANDLUNG_COLOR_MAP[currentStatus];
  const label = BEHANDLUNG_LABELS[currentStatus];
  return (
    <span
      role="status"
      aria-label={label.label}
      data-testid={`behandlungs-pill-readonly-${currentStatus}`}
      className={clsx('inline-flex items-center rounded-full border-2 font-semibold', colors.klass, size === 'sm' ? 'min-h-8 px-3 py-1 text-xs' : 'min-h-12 px-4 py-2 text-sm')}
    >
      <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: colors.fill }} />
      {label.shortLabel}
    </span>
  );
}

function BehandlungsStatusInteractivePillGroup({
  einsatzId,
  patientId,
  currentStatus,
  patientennummer,
}: {
  einsatzId: string;
  patientId: string;
  currentStatus: BehandlungsstatusEnum;
  patientennummer: string;
}) {
  const [pending, setPending] = useState<BehandlungsstatusEnum | null>(null);
  const mutation = useBehandlungAktualisieren({ einsatzId, patientId });

  const isPending = mutation.isPending;
  const errorMessage = useMemo(() => extractError(mutation.error), [mutation.error]);

  const handlePillTap = useCallback(
    (status: BehandlungsstatusEnum) => {
      if (status === currentStatus || isPending) return;
      if (!isBehandlungsTransitionAllowed(currentStatus, status)) return;
      setPending(status);
      mutation.reset();
    },
    [currentStatus, isPending, mutation],
  );

  const cancel = useCallback(() => {
    setPending(null);
    mutation.reset();
  }, [mutation]);

  const confirm = useCallback(async () => {
    if (!pending) return;
    try {
      await mutation.mutateAsync({ neuerStatus: pending });
    } catch {
      // Fehler wird via `mutation.error` als Inline-Pill gerendert; Confirm-Pill schließt trotzdem
      // (Lessons-Learned 1.3: Confirm-Pill darf bei Server-Reject nicht offen bleiben).
    } finally {
      setPending(null);
    }
  }, [mutation, pending]);

  return (
    <div className="flex flex-col gap-3" data-testid="behandlungs-status-pill-group">
      <div role="group" aria-label={`Behandlungsstatus für Patient ${patientennummer}`} className="flex flex-wrap gap-2">
        {BEHANDLUNG_DISPLAY_ORDER.map((status) => {
          const active = status === currentStatus;
          const allowed = active || isBehandlungsTransitionAllowed(currentStatus, status);
          const isPendingSelection = pending === status;
          const colors = BEHANDLUNG_COLOR_MAP[status];
          const label = BEHANDLUNG_LABELS[status];

          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              aria-disabled={!allowed}
              aria-label={`${label.label}${active ? ' (aktuell)' : ''}`}
              title={!allowed && !active ? 'Übergang nicht erlaubt — bitte vorherigen Status setzen oder Korrektur nutzen' : undefined}
              data-testid={`behandlungs-pill-${status}`}
              disabled={active || !allowed || isPending}
              onClick={() => handlePillTap(status)}
              className={clsx(
                'min-h-12 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                colors.klass,
                active ? 'cursor-default opacity-100 shadow-sm ring-2 ring-offset-2' : 'opacity-70 hover:opacity-100',
                !allowed && !active && 'cursor-not-allowed opacity-40',
                isPendingSelection && 'ring-2 ring-offset-2',
                isPending && !active && 'cursor-not-allowed opacity-50',
              )}
            >
              <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: colors.fill }} />
              {label.shortLabel}
            </button>
          );
        })}
      </div>

      {pending ? (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-label={`Behandlungsstatus bestätigen: ${BEHANDLUNG_LABELS[pending].label}`}
          className="flex flex-col gap-2 rounded-md border-2 border-gray-300 bg-gray-50 p-3"
          data-testid="behandlungs-confirm"
        >
          <p className="text-sm text-gray-800">
            Neuer Behandlungsstatus für Patient <strong>{patientennummer}</strong>: <strong>{BEHANDLUNG_LABELS[pending].label}</strong> (aktuell {BEHANDLUNG_LABELS[currentStatus].label})
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={isPending}
              className="min-h-12 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
              data-testid="behandlungs-confirm-button"
            >
              {isPending ? 'Wird übernommen…' : 'Bestätigen'}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={isPending}
              className="min-h-12 rounded-md border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
              data-testid="behandlungs-cancel-button"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <p role="alert" aria-live="assertive" data-testid="behandlungs-error" className="rounded-md border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Story 1.4 Code-Review Feature 1: Match auf den stabilen `code`-Stem
 * (gesetzt durch `enrichResponseErrorWithCode` im Mutation-Hook), nicht mehr
 * auf den lokalisierten `message`-Klartext.
 */
function extractError(error: unknown): string | null {
  if (!error) return null;
  const code = extractErrorCode(error);
  if (code === 'BusinessRule:BehandlungUngueltigerUebergang') return 'Ungültiger Übergang im Behandlungsstatus.';
  if (code === 'BusinessRule:BehandlungUnveraendert') return 'Neuer Behandlungsstatus entspricht dem aktuellen.';
  if (code === 'NotFound:PatientNichtGefunden') return 'Patient wurde zwischenzeitlich geändert oder entfernt, bitte Detail neu laden.';
  const message = extractErrorMessage(error);
  if (message && message !== 'Response returned an error code') {
    return `Behandlungs-Update fehlgeschlagen: ${message}`;
  }
  return 'Behandlungs-Update fehlgeschlagen.';
}
