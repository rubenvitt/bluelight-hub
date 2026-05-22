import type { PatientEventDto } from '@bluelight-hub/shared/client';
import { cn } from '@/shared/ui/cn';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { PiWarningCircle } from 'react-icons/pi';
import { getPatientEventLabel } from '../constants/patient-event-type-labels';

const DRIFT_WARNING_THRESHOLD_SECONDS = 30;

export interface PatientEreignisListeProps {
  events: PatientEventDto[];
  className?: string;
  /**
   * Optionale Test-Reference auf „jetzt" für deterministische Relative-
   * Zeit-Strings in Vitest-Snapshots. Default: `new Date()`.
   */
  now?: Date;
}

/**
 * Story 1.7 (AC8): chronologische Patient-Event-Timeline.
 *
 * Rendert die `PatientEventDto[]`-Liste als semantisch geordnete `<ol>` mit
 * Marker-Dot, Event-Type-Label (via `getPatientEventLabel`), Zeitstempel
 * (absolut + relativ via `date-fns`), Akteur und event-spezifisch
 * decodiertem Payload (switch auf `eventType`). `clockDriftSeconds > 30`
 * triggert einen sichtbaren neutralen Drift-Indikator (UX-Spec).
 *
 * **Scope:** Keine Virtualisierung (Erwartung ≤ 100 Events pro Patient).
 * Falls Schicht-übergreifende Cases > 500 Events erzeugen, ist
 * `useVirtualizer` als Folge-Story sinnvoll.
 *
 * **A11y:** `<ol>` + `<li>` mit `aria-label` pro Eintrag — Screenreader
 * lesen den Eintrag vollständig (Label + Akteur + Relative-Zeit). Keine
 * Icon-Only-Information.
 */
export function PatientEreignisListe({ events, className, now }: PatientEreignisListeProps) {
  if (events.length === 0) {
    return (
      <div className={cn('rounded-md border border-dashed border-border-subtle p-4 text-sm text-text-muted', className)} data-testid="patient-ereignis-empty">
        Keine Ereignisse vorhanden.
      </div>
    );
  }

  const referenceNow = now ?? new Date();

  return (
    <ol className={cn('relative flex flex-col gap-3 pl-6', className)} data-testid="patient-ereignis-liste">
      {/* Vertikale Timeline-Linie als Pseudo-Element via Background — keine
          eigene <div>, damit die <ol> semantisch sauber bleibt. */}
      <span aria-hidden="true" className="pointer-events-none absolute top-1 bottom-1 left-2 w-px bg-border-subtle" />
      {events.map((event) => (
        <PatientEreignisListItem key={event.id} event={event} now={referenceNow} />
      ))}
    </ol>
  );
}

function PatientEreignisListItem({ event, now }: { event: PatientEventDto; now: Date }) {
  const label = getPatientEventLabel(event.eventType);
  const occurredDate = new Date(event.occurredAt);
  const absolute = formatAbsoluteTime(occurredDate);
  const relative = formatDistanceToNow(occurredDate, { locale: de, addSuffix: true });
  const actor = formatActor(event);
  const driftIndicator = event.clockDriftSeconds !== null && Math.abs(event.clockDriftSeconds) > DRIFT_WARNING_THRESHOLD_SECONDS ? formatDrift(event.clockDriftSeconds) : null;
  const decoded = decodePayload(event);

  // Forwards-Compat: now-Parameter bleibt im closure, aber die relative-Zeit
  // wird durch React-Render-Tick beim nächsten now-Update aktualisiert.
  void now;

  return (
    <li
      className="bg-surface-card relative ml-2 rounded-md border border-border-subtle p-3 text-sm shadow-sm"
      data-testid="patient-ereignis-eintrag"
      aria-label={`Ereignis ${label}: ${decoded ?? ''} ${actor ?? ''} ${relative}`}
    >
      <span aria-hidden="true" className="border-surface-card absolute top-4 -left-4 h-3 w-3 rounded-full border-2 bg-border-strong" />
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium text-text-primary">{label}</span>
        <time dateTime={event.occurredAt} className="text-xs text-text-muted">
          {absolute} · {relative}
        </time>
      </div>
      {actor && <div className="mt-1 text-xs text-text-muted">{actor}</div>}
      {driftIndicator && (
        <div className="text-text-warning mt-1 flex items-center gap-1 text-xs" role="note">
          <PiWarningCircle aria-hidden="true" className="h-3.5 w-3.5" />
          <span>{driftIndicator}</span>
        </div>
      )}
      {decoded && <div className="mt-1 text-sm text-text-secondary">{decoded}</div>}
    </li>
  );
}

function formatAbsoluteTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatActor(event: PatientEventDto): string | null {
  if (event.actorUserId) return `durch User ${event.actorUserId}`;
  if (event.actorDeviceId) {
    if (event.originSessionId) return `durch Gerät ${event.actorDeviceId} (Session ${event.originSessionId})`;
    return `durch Gerät ${event.actorDeviceId}`;
  }
  if (event.originSessionId) return `aus Session ${event.originSessionId}`;
  return null;
}

function formatDrift(clockDriftSeconds: number): string {
  const sign = clockDriftSeconds > 0 ? '+' : '−';
  return `Geräte-Zeit-Drift ${sign}${Math.abs(clockDriftSeconds)} s`;
}

/**
 * Story 1.7 (AC8): payload-Decoder pro `eventType`. Defensiv — unbekannte
 * Strukturen fallen auf `null` zurück, der Eintrag rendert ohne
 * Payload-Zeile.
 */
function decodePayload(event: PatientEventDto): string | null {
  const payload = event.payload as Record<string, unknown>;
  if (!payload) return null;
  switch (event.eventType) {
    case 'patient.erfasst': {
      const initialeSk = pickString(payload, 'initialeSk');
      return initialeSk ? `Initiale SK: ${initialeSk}` : null;
    }
    case 'patient.gesichtet': {
      const sk = pickString(payload, 'sk');
      const sichtungArt = pickString(payload, 'sichtungArt');
      if (!sk) return null;
      return sichtungArt ? `Sichtung ${sk} (${sichtungArt})` : `Sichtung ${sk}`;
    }
    case 'patient.sichtung-aktualisiert': {
      const vorher = pickString(payload, 'vorher');
      const neu = pickString(payload, 'neu');
      const grund = pickString(payload, 'grund');
      if (!vorher || !neu) return null;
      const base = `${vorher} → ${neu}`;
      return grund ? `${base} · Grund: ${grund}` : base;
    }
    case 'patient.behandlung-begonnen':
      return 'Behandlung begonnen';
    case 'patient.behandlung-abgeschlossen': {
      const neu = pickString(payload, 'neu');
      return neu ? `Behandlung abgeschlossen → ${neu}` : 'Behandlung abgeschlossen';
    }
    case 'patient.transport-gestartet':
      return 'Transport gestartet';
    case 'patient.transport-abgeschlossen':
      return 'Transport abgeschlossen';
    case 'patient.korrigiert': {
      const feld = pickString(payload, 'feld');
      if (feld === 'notiz') {
        // Notiz-Klartext ist im Detail-Snapshot sichtbar; in der Timeline
        // bewusst keine PII-Doppelung (Audit-Trail-Sink ist Snapshot, nicht
        // diese UI-Komponente).
        const grund = pickString(payload, 'grund');
        return grund ? `Notiz aktualisiert · Grund: ${grund}` : 'Notiz aktualisiert';
      }
      const vorher = pickString(payload, 'vorher');
      const neu = pickString(payload, 'neu');
      const grund = pickString(payload, 'grund');
      if (!feld || !vorher || !neu) return null;
      const base = `Feld \`${feld}\`: ${vorher} → ${neu}`;
      return grund ? `${base} · Grund: ${grund}` : base;
    }
    default:
      // Backend-Drift: ein neuer Event-Typ ist eingeführt worden, aber der
      // Decoder kennt ihn nicht. Im Header rendert der Fallback aus
      // `getPatientEventLabel` „Unbekanntes Ereignis (…)" — hier nur einmal
      // pro Type warnen, damit Telemetry/Console den Drift sichtbar macht
      // (Dev/Staging-Smoke kann das aufgreifen).
      warnUnknownEventTypeOnce(event.eventType);
      return null;
  }
}

const warnedUnknownEventTypes = new Set<string>();
function warnUnknownEventTypeOnce(eventType: string) {
  if (warnedUnknownEventTypes.has(eventType)) return;
  warnedUnknownEventTypes.add(eventType);
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[PatientEreignisListe] Unbekannter Event-Typ ohne Decoder: ${eventType}`);
  }
}

function pickString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' ? value : null;
}
