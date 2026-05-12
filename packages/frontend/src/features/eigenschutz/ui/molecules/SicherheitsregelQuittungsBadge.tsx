/**
 * SicherheitsregelQuittungsBadge — Quittungs-Counter mit Popover-Detail
 * (Goal G3 / Story 415-2-6-UI).
 *
 * Mirror der `AcknowledgmentStatusBadge`-Komponente für PSA, aber für
 * Sicherheitsregeln. Rendert einen Badge mit Counter `{ack}/{total}` und
 * öffnet bei Klick ein Headless-UI-Popover mit der Empfänger-Liste pro
 * Einheit.
 *
 * **Lazy-Loading (N+1-Schutz):** Die Quittungs-Query
 * (`useSicherheitsregelQuittungen`) ist pro Regel-ID granular und würde
 * bei N gleichzeitig sichtbaren Karten N parallele HTTP-Calls erzeugen.
 * Das Badge hält den Hook deshalb deaktiviert (`enabled: false`) bis das
 * Popover zum ersten Mal geöffnet wird; sichtbar bleibt ein Placeholder
 * (`?/?`), der den Hint „Quittungen anzeigen" rendert.
 *
 * **Einsatzweite Regeln** propagiert das Backend an N Einheiten — die
 * Quittungs-Liste deckt diesen Fanout ab. Einheiten-scoped Regeln haben
 * genau eine Quittungs-Zeile.
 */

import type { SicherheitsregelDto } from '@/features/eigenschutz/schemas/sicherheitsregel.schema';
import { useSicherheitsregelQuittungen } from '@/features/eigenschutz/api/queries';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { cn } from '@/shared/ui/cn';
import { useState } from 'react';
import { PiCheckCircleDuotone, PiCircleDashedDuotone, PiCircleHalfDuotone } from 'react-icons/pi';

type Status = 'pending' | 'partial' | 'complete' | 'unknown';

interface StatusView {
  readonly badgeClassName: string;
  readonly icon: React.ReactNode;
  readonly description: (ack: number, total: number) => string;
}

const STATUS_VIEWS: Record<Status, StatusView> = {
  unknown: {
    badgeClassName: 'border-border-subtle bg-surface-panel text-text-muted',
    icon: <PiCircleDashedDuotone className="h-4 w-4" aria-hidden="true" />,
    description: () => 'Quittungs-Stand laden',
  },
  pending: {
    badgeClassName: 'border-status-warning-border bg-status-warning-surface text-status-warning-text',
    icon: <PiCircleDashedDuotone className="h-4 w-4" aria-hidden="true" />,
    description: (_ack, total) => `0 von ${total} quittiert`,
  },
  partial: {
    badgeClassName: 'border-status-warning-border bg-status-warning-surface text-status-warning-text',
    icon: <PiCircleHalfDuotone className="h-4 w-4" aria-hidden="true" />,
    description: (ack, total) => `${ack} von ${total} quittiert`,
  },
  complete: {
    badgeClassName: 'border-status-success-border bg-status-success-surface text-status-success-text',
    icon: <PiCheckCircleDuotone className="h-4 w-4" aria-hidden="true" />,
    description: (ack, total) => `${ack} von ${total} quittiert`,
  },
};

function deriveStatus(ack: number, total: number): Status {
  if (total === 0) return 'unknown';
  if (ack === 0) return 'pending';
  if (ack < total) return 'partial';
  return 'complete';
}

/**
 * Formatiert einen ISO-Zeitstempel auf „HH:mm" — analog zur
 * `AcknowledgmentStatusBadge`-Variante (Story 3.4 AC8).
 */
function formatHoursMinutes(input: string | undefined): string {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export interface SicherheitsregelQuittungsBadgeProps {
  readonly einsatzId: string;
  readonly regel: Pick<SicherheitsregelDto, 'id' | 'einheitId' | 'einsatzweit'>;
  readonly className?: string;
  /**
   * Erwartete Empfänger-Anzahl, falls schon bekannt (für scoped Regeln
   * immer `1`). Wird genutzt, um eine Hint-Zahl noch vor dem ersten Fetch
   * anzuzeigen.
   */
  readonly hintTotal?: number;
}

export function SicherheitsregelQuittungsBadge({ einsatzId, regel, className, hintTotal }: SicherheitsregelQuittungsBadgeProps) {
  // Lazy: Hook bleibt deaktiviert bis zum ersten Popover-Open. Verhindert
  // den N+1-Fetch beim Rendern einer ganzen Card-Liste.
  const [enabled, setEnabled] = useState(false);
  const quittungenQuery = useSicherheitsregelQuittungen(einsatzId, regel.id, { enabled });
  const data = enabled ? (quittungenQuery.data ?? []) : [];
  const ack = data.length; // jeder Eintrag in `Quittungen` ist eine quittierte Zeile
  // Total: Bei einheits-scoped Regel ist Total = 1; bei einsatzweit ist
  // Total = (alle Einheiten, an die fanout-ed wurde). Backend liefert die
  // Empfängerliste nicht als „pending"-Variante, daher kann das UI ohne
  // weiteren Endpoint nur den ack-Count zeigen. `hintTotal` ist optional
  // und liefert eine bekannte Obergrenze.
  const total = enabled ? Math.max(ack, hintTotal ?? ack) : (hintTotal ?? 0);
  const status: Status = enabled ? deriveStatus(ack, total) : 'unknown';
  const view = STATUS_VIEWS[status];
  const counter = enabled ? `${ack}/${total}` : hintTotal !== undefined ? `?/${hintTotal}` : '?/?';
  const ariaLabel = enabled ? `Quittungsstand: ${view.description(ack, total)}` : 'Quittungs-Stand anzeigen';

  return (
    <Popover className="relative inline-block">
      <PopoverButton
        as="button"
        type="button"
        data-testid={`sicherheitsregel-quittungen-badge-${regel.id}`}
        data-status={status}
        aria-label={ariaLabel}
        onClick={() => {
          // Lazy-Flip: erst beim Erst-Klick wird die Quittungs-Query aktiviert.
          // Weitere Klicks (toggle close → open) bleiben no-ops.
          if (!enabled) setEnabled(true);
        }}
        className={cn(
          'inline-flex min-h-[36px] items-center gap-1.5 rounded-control border px-2 py-1 text-xs font-semibold',
          'focus:outline-none focus-visible:shadow-focus-ring',
          view.badgeClassName,
          className,
        )}
      >
        <span className="inline-flex shrink-0 items-center">{view.icon}</span>
        <span className="tabular-nums">{counter}</span>
      </PopoverButton>
      <PopoverPanel
        transition
        anchor={{ to: 'bottom end', gap: 4 }}
        className={cn(
          'z-30 w-72 rounded-panel border border-border-subtle bg-surface-panel shadow-panel',
          'ring-1 ring-border-subtle/50 focus:outline-none',
          'transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0',
        )}
        data-testid={`sicherheitsregel-quittungen-panel-${regel.id}`}
      >
        <div className="p-3 text-sm">
          {!enabled || quittungenQuery.isPending ? (
            <p className="text-text-muted">Lade Quittungen…</p>
          ) : quittungenQuery.isError ? (
            <p className="text-status-danger-text">Quittungen konnten nicht geladen werden.</p>
          ) : data.length === 0 ? (
            <p className="text-text-muted">Noch keine Quittungen vorhanden.</p>
          ) : (
            <ul role="list" className="max-h-64 space-y-2 overflow-y-auto" aria-label="Quittierende Einheiten">
              {data.map((entry) => (
                <li key={entry.einheitId} className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium text-text-primary">{entry.einheitName}</span>
                    <span className="text-xs text-text-muted">
                      <span className="tabular-nums">{formatHoursMinutes(entry.quittiertAm)}</span>
                      {entry.quittiertVonUserName ? <span> · {entry.quittiertVonUserName}</span> : null}
                    </span>
                  </div>
                  <span className="inline-flex items-center rounded-control border border-status-success-border bg-status-success-surface px-2 py-0.5 text-xs font-semibold text-status-success-text">
                    quittiert
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverPanel>
    </Popover>
  );
}
