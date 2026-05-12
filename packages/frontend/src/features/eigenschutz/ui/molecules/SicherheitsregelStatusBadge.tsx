/**
 * SicherheitsregelStatusBadge — Status-Indikator für eine Sicherheitsregel
 * (Goal G3 / Story 415-2-6-UI).
 *
 * **Scope-Entscheidung:** Das Datenmodell trägt heute keinen persistierten
 * `severity`-Wert (`SicherheitsregelDtoSchemaV1` kennt nur Titel, Inhalt,
 * Zuordnung und Version). Bis ein eigenes Feld nachgezogen ist (Follow-up
 * Story), leitet die UI den Status aus zwei vorhandenen Signalen ab und
 * spricht bewusst von „Status" statt „Severity":
 *
 * - `warning` — Regel wurde mindestens einmal aktualisiert (`version > 1`).
 *   Spiegelt das Vorbild aus `useSicherheitsregelLiveBanner`: Änderungen an
 *   einer aktiven Regel werden als orange Bekanntgabe propagiert.
 * - `info` — frisch angelegte Erst-Bekanntgabe (`version === 1`). Analog zum
 *   blauen Live-Banner-Tone.
 *
 * Eine echte „kritische" Severity bleibt absichtlich aus, weil sie ohne
 * Backend-Persistierung keinen verlässlichen Trigger hätte (eine
 * Keyword-Heuristik auf Titel/Inhalt wäre fragil).
 */

import type { SicherheitsregelDto } from '@/features/eigenschutz/schemas/sicherheitsregel.schema';
import { cn } from '@/shared/ui/cn';
import type { ReactNode } from 'react';
import { PiInfoDuotone, PiWarningDuotone } from 'react-icons/pi';

/**
 * Aus dem Live-Banner-Mapping abgeleitete UI-Stufen.
 *
 * `info` und `warning` decken alle heute persistierbaren Zustände ab; ein
 * dritter Wert `critical` bleibt für künftige Schema-Erweiterungen
 * reserviert, wird aktuell aber nicht produziert.
 */
export type SicherheitsregelStatus = 'info' | 'warning' | 'critical';

interface StatusView {
  readonly label: string;
  readonly badgeClassName: string;
  readonly stripeClassName: string;
  readonly icon: ReactNode;
}

/**
 * Leitet den UI-Status aus der Regel ab.
 *
 * Reihenfolge bewusst:
 * 1. Mehrfach aktualisierte Regel → `warning` (Änderung einer aktiven Regel).
 * 2. Andernfalls → `info` (Erst-Bekanntgabe).
 *
 * Sobald das Datenmodell ein eigenes `severity`-Feld trägt, sollte dieses
 * hier vorgezogen werden (`regel.severity ?? deriveFromVersion()`).
 */
export function deriveSicherheitsregelStatus(regel: Pick<SicherheitsregelDto, 'version'>): SicherheitsregelStatus {
  if (regel.version > 1) return 'warning';
  return 'info';
}

const STATUS_VIEWS: Record<SicherheitsregelStatus, StatusView> = {
  info: {
    label: 'Bekanntgabe',
    badgeClassName: 'border-status-info-border bg-status-info-surface text-status-info-text',
    stripeClassName: 'bg-status-info-border',
    icon: <PiInfoDuotone className="h-4 w-4" aria-hidden="true" />,
  },
  warning: {
    label: 'Aktualisiert',
    badgeClassName: 'border-status-warning-border bg-status-warning-surface text-status-warning-text',
    stripeClassName: 'bg-status-warning-border',
    icon: <PiWarningDuotone className="h-4 w-4" aria-hidden="true" />,
  },
  critical: {
    label: 'Kritisch',
    badgeClassName: 'border-status-danger-border bg-status-danger-surface text-status-danger-text',
    stripeClassName: 'bg-status-danger-border',
    icon: <PiWarningDuotone className="h-4 w-4" aria-hidden="true" />,
  },
};

/**
 * Liefert die Tailwind-Klasse für den vertikalen Akzent-Streifen einer Card.
 * Wird vom `SicherheitsregelCard`-Organism für die linke Kante genutzt.
 */
export function getStatusStripeClassName(status: SicherheitsregelStatus): string {
  return STATUS_VIEWS[status].stripeClassName;
}

export interface SicherheitsregelStatusBadgeProps {
  readonly status: SicherheitsregelStatus;
  readonly className?: string;
}

/**
 * Pill-Badge mit Status-Icon und Klartext. Wird in der Card-Header-Zeile
 * gerendert; reine Anzeige-Komponente ohne Interaktion.
 */
export function SicherheitsregelStatusBadge({ status, className }: SicherheitsregelStatusBadgeProps) {
  const view = STATUS_VIEWS[status];
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-xs font-semibold', view.badgeClassName, className)}
      data-testid="sicherheitsregel-status-badge"
      data-status={status}
    >
      {view.icon}
      <span>{view.label}</span>
    </span>
  );
}
