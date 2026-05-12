/**
 * SicherheitsregelCard — Card-Darstellung einer einzelnen Sicherheitsregel
 * (Goal G3 / Story 415-2-6-UI).
 *
 * **Aufbau:**
 * - Linker Akzent-Streifen kodiert den abgeleiteten Status (`info`/`warning`).
 * - Header: Status-Badge, Versions-Chip, Zuordnungs-Chip (Einsatz-/Einheit-
 *   weit), Zeitstempel-Footer rechts.
 * - Body: Titel + 2-Zeilen-Anriss des Inhalts (line-clamp).
 * - Footer: Quittungs-Counter-Badge (lazy) + zwei Inline-Aktionen
 *   („Bearbeiten" als Primary-Klickziel auf der ganzen Card, sowie
 *   explizite Sekundäraktionen). Die Aktionen sind eigenständige
 *   `<button>`s und stoppen `propagation`, damit der Klick auf die Card
 *   selbst weiterhin den Edit-Drawer öffnet — kompatibel zu den
 *   bestehenden Spec-Erwartungen (`sicherheitsregel-zeile-${id}` öffnet
 *   Edit).
 *
 * **Out-of-Scope:** Eine „Auflösen"-Aktion existiert im Backend (Stand
 * 2026-05-12) noch nicht — `DELETE /sicherheitsregeln/:id` ist nicht
 * implementiert. Die Card bietet daher kein „Auflösen"-Affordance; die
 * Aktion ist als Follow-up-Story dokumentiert.
 */

import type { SicherheitsregelDto } from '@/features/eigenschutz/schemas/sicherheitsregel.schema';
import { SicherheitsregelStatusBadge, deriveSicherheitsregelStatus, getStatusStripeClassName } from '@/features/eigenschutz/ui/molecules/SicherheitsregelStatusBadge';
import { SicherheitsregelQuittungsBadge } from '@/features/eigenschutz/ui/molecules/SicherheitsregelQuittungsBadge';
import { Heading } from '@/shared/ui/atoms/heading.atom';
import { cn } from '@/shared/ui/cn';
import { useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import { PiBuildingsDuotone, PiPencilSimpleDuotone, PiUsersThreeDuotone } from 'react-icons/pi';

/**
 * Liefert ein vollständig lokalisiertes Datum/Zeit-Label, fällt bei
 * ungültigem Input auf den Originalstring zurück (analog zum bisherigen
 * `formatDate` der Page).
 */
function formatDateTime(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function truncate(value: string, max = 220): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export interface SicherheitsregelCardProps {
  readonly einsatzId: string;
  readonly regel: SicherheitsregelDto;
  /** Anzeige-Name der zugeordneten Einheit (bei `einheitId === null` ignoriert). */
  readonly einheitName?: string;
  /**
   * Erwartete Empfänger-Anzahl als optionaler Hint für das Quittungs-Badge.
   * - `einsatzweit === false` → 1.
   * - `einsatzweit === true` → bekannte Empfänger-Liste (z. B. `einheitenAnzahl`).
   * Wenn `undefined`, rendert das Badge nur den ack-Counter ohne Total-Hint.
   */
  readonly quittungenHintTotal?: number;
  /** Klick/Enter/Space auf der Card → Edit-Drawer. */
  readonly onEdit: (regel: SicherheitsregelDto) => void;
  /**
   * Optionaler Quittungs-Status-Trigger. Wenn gesetzt, rendert eine eigene
   * Inline-Aktion „Status öffnen"; sonst übernimmt der Badge die
   * Popover-Darstellung allein.
   */
  readonly onShowQuittungen?: (regel: SicherheitsregelDto) => void;
}

export function SicherheitsregelCard({ einsatzId, regel, einheitName, quittungenHintTotal, onEdit, onShowQuittungen }: SicherheitsregelCardProps) {
  const status = deriveSicherheitsregelStatus(regel);
  const stripeClassName = getStatusStripeClassName(status);
  const isEinsatzweit = regel.einheitId === null;
  const zuordnungLabel = isEinsatzweit ? 'Gesamter Einsatz' : einheitName ? `Einheit: ${einheitName}` : `Einheit: ${regel.einheitId}`;

  const handleCardClick = useCallback(() => {
    onEdit(regel);
  }, [onEdit, regel]);

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onEdit(regel);
      }
    },
    [onEdit, regel],
  );

  const stopPropagation = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  }, []);

  return (
    // `data-testid="sicherheitsregel-zeile-${id}"` bleibt erhalten, weil
    // die bestehenden Specs (`SicherheitsregelnPage.spec.tsx`) auf diesem
    // Hook klicken; semantisch ist die Card jetzt ein Click-Target mit
    // `role="button"` (statt einem `<button>`-Wrapper, der keine internen
    // Inline-Aktionen schachteln darf).
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      data-testid={`sicherheitsregel-zeile-${regel.id}`}
      data-status={status}
      aria-label={`${regel.titel} — ${zuordnungLabel}, Version ${regel.version}, Stand ${formatDateTime(regel.aktualisiertAm)}`}
      className={cn(
        'group relative flex flex-col gap-3 overflow-hidden rounded-panel border border-border-subtle bg-surface-panel py-4 pr-4 pl-4',
        'text-left transition-colors duration-150',
        'hover:border-border-strong focus:outline-none focus-visible:shadow-focus-ring',
        'cursor-pointer',
      )}
    >
      {/* Linker Akzent-Streifen — visualisiert den abgeleiteten Status. */}
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', stripeClassName)} />

      <div className="flex flex-wrap items-center gap-2">
        <SicherheitsregelStatusBadge status={status} />
        <span
          className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-surface-panel-elevated px-2 py-0.5 text-xs font-medium text-text-secondary"
          data-testid={`sicherheitsregel-version-${regel.id}`}
          title={`${regel.version === 1 ? 'Erste Version' : `${regel.version} Versionen bisher`}`}
        >
          V{regel.version}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-surface-panel-elevated px-2 py-0.5 text-xs font-medium text-text-secondary"
          data-testid={`sicherheitsregel-zuordnung-${regel.id}`}
        >
          {isEinsatzweit ? <PiBuildingsDuotone className="h-3.5 w-3.5" aria-hidden="true" /> : <PiUsersThreeDuotone className="h-3.5 w-3.5" aria-hidden="true" />}
          <span>{zuordnungLabel}</span>
        </span>
        <span className="ml-auto text-xs text-text-muted" data-testid={`sicherheitsregel-zeitstempel-${regel.id}`}>
          Stand <span className="font-medium text-text-secondary">{formatDateTime(regel.aktualisiertAm)}</span>
        </span>
      </div>

      <div>
        <Heading as="h2" size="md">
          {regel.titel}
        </Heading>
        <p className="mt-1 text-sm whitespace-pre-line text-text-secondary">{truncate(regel.inhalt)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span onClick={stopPropagation} onKeyDown={(event) => event.stopPropagation()}>
          <SicherheitsregelQuittungsBadge einsatzId={einsatzId} regel={regel} hintTotal={quittungenHintTotal} />
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {onShowQuittungen ? (
            <button
              type="button"
              onClick={(event) => {
                stopPropagation(event);
                onShowQuittungen(regel);
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-control border border-border-subtle bg-surface-panel-elevated px-3 py-1 text-xs font-medium text-text-primary transition-colors hover:border-border-strong focus:outline-none focus-visible:shadow-focus-ring"
              data-testid={`sicherheitsregel-quittungen-action-${regel.id}`}
            >
              Quittungs-Status
            </button>
          ) : null}
          <button
            type="button"
            onClick={(event) => {
              stopPropagation(event);
              onEdit(regel);
            }}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-control border border-transparent bg-action-primary px-3 py-1 text-xs font-medium text-text-inverse shadow-button-primary transition-colors hover:bg-action-primary-hover focus:outline-none focus-visible:shadow-focus-ring"
            data-testid={`sicherheitsregel-edit-action-${regel.id}`}
          >
            <PiPencilSimpleDuotone className="h-3.5 w-3.5" aria-hidden="true" />
            Bearbeiten
          </button>
        </div>
      </div>
    </div>
  );
}
