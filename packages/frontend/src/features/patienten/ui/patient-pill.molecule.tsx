import type { PatientListItemDto, SkEnum } from '@bluelight-hub/shared/client';
import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { SK_LABELS } from '../constants/sk-labels';
import { PiClockClockwise } from 'react-icons/pi';
import { cn } from '@/shared/ui/cn';

export interface PatientPillProps {
  patient: PatientListItemDto;
  reevaluationDueIn?: string; // z. B. „vor 24 min"
  onClick?: () => void; // → öffnet PatientDetailPanel
  highlighted?: boolean; // falls extern getriggert
  className?: string;
}

const FILL_CLASS: Record<SkEnum, string> = {
  SK_I: 'bg-sk-rot-fill',
  SK_II: 'bg-sk-gelb-fill',
  SK_III: 'bg-sk-gruen-fill',
  SK_IV: 'bg-sk-blau-fill',
  TOT: 'bg-sk-schwarz-fill',
};

/**
 * Molecule-Component für die PatientPill (Story 1.8, AC4).
 * Zeigt Patientennummer, Pseudonym, SK und Erfassungszeit.
 * Bietet optionalen Reevaluierungs-Indikator.
 *
 * Barrierefrei gestaltet mit vollständigem screenreader-lesbarem Label und
 * Touch-Targets von mindestens 44 px.
 */
export function PatientPill({ patient, reevaluationDueIn, onClick, highlighted = false, className }: PatientPillProps) {
  const hasSk = patient.aktuelleSk !== null && patient.aktuelleSk !== undefined;
  const skLabel = hasSk ? (SK_LABELS[patient.aktuelleSk as SkEnum]?.label ?? 'Ungesichtet') : 'Ungesichtet';
  const shortSkLabel = hasSk ? (SK_LABELS[patient.aktuelleSk as SkEnum]?.shortLabel ?? '–') : '–';

  const formattedTime = useMemo(() => {
    if (!patient.erfasstAm) return '';
    try {
      return new Date(patient.erfasstAm).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [patient.erfasstAm]);

  const relativeTime = useMemo(() => {
    if (!patient.erfasstAm) return null;
    try {
      return formatDistanceToNow(new Date(patient.erfasstAm), { addSuffix: true, locale: de });
    } catch {
      return null;
    }
  }, [patient.erfasstAm]);

  const patientName = typeof patient.name === 'string' ? patient.name : null;

  const ariaLabel = [
    `Patient ${patient.patientennummer}`,
    patientName || 'kein Name',
    skLabel,
    relativeTime ? `erfasst ${relativeTime}` : null,
    reevaluationDueIn ? `Reevaluierung ${reevaluationDueIn}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={`patient-pill-${patient.id}`}
      className={cn(
        'relative flex min-h-[44px] w-full items-center justify-between overflow-hidden rounded-panel border border-border-subtle bg-surface-raised py-2 pr-3 pl-4 text-left text-sm transition-colors hover:bg-surface-elevated focus-visible:shadow-focus-ring focus-visible:outline-none',
        highlighted ? 'animate-highlight-updated motion-reduce:animate-none' : '',
        className,
      )}
    >
      {/* SK-Farbflächel links */}
      <div className={cn('absolute top-0 bottom-0 left-0 w-1', FILL_CLASS[patient.aktuelleSk as SkEnum] || 'bg-text-muted')} aria-hidden="true" />

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="font-mono font-semibold text-text-primary tabular-nums">{patient.patientennummer}</span>
          {patientName && <span className="truncate text-text-secondary">— „{patientName}“</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="font-medium">{shortSkLabel}</span>
          <span>·</span>
          <span className="tabular-nums">{formattedTime}</span>
        </div>
      </div>

      {/* Reevaluation Indicator */}
      {reevaluationDueIn && (
        <div className="ml-2 flex items-center gap-1 rounded border border-status-warning-soft bg-status-warning-soft/20 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-status-warning">
          <PiClockClockwise className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span className="tabular-nums">{reevaluationDueIn}</span>
        </div>
      )}
    </button>
  );
}
