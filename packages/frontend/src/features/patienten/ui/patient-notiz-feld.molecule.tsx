import { SyncStatusBadge, type SyncStatusBadgeStatus } from '@/features/eigenschutz/ui/molecules/SyncStatusBadge';
import { useAutoSave, type AutoSaveStatus } from '@/features/eigenschutz/hooks/useAutoSave';
import { cn } from '@/shared/ui/cn';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useAktualisiereNotiz } from '../api/use-aktualisiere-notiz';

const MAX_NOTIZ_LENGTH = 500;

export interface PatientNotizFeldProps {
  einsatzId: string;
  patientId: string;
  /** Aktueller Snapshot-Wert aus `PatientDetailDto.notiz` (`null` = noch nie gesetzt). */
  initialValue: string | null;
  className?: string;
}

/**
 * Story 1.7 (AC9, UX-DR13): Freie Pflege-/Übergabe-Notiz mit Auto-Save.
 *
 * 2-s-Debounce über `useAutoSave` (Vorbild Eigenschutz). Der Save-Pfad ruft
 * `useAktualisiereNotiz` auf, der wiederum den Korrektur-Endpoint mit
 * `feld='notiz'` triggert. Server-Wahrheit nach Settled invalidiert
 * `PATIENT_QUERY_KEYS.detail`, sodass die Timeline das neue `patient.korrigiert`-
 * Event direkt sieht.
 *
 * **Scope-Note 1.7:** `onLocalSave` (IndexedDB für Offline-Edits) ist defer
 * — Tablet-Offline-Mode kommt mit Story 3.x. Für 1.7 reicht die direkte
 * Server-Persistierung.
 *
 * **A11y:** `<label htmlFor>` + `aria-describedby` (Hint + Status-Region);
 * Status-Region ist `aria-live="polite"`. Max-Length hart auf 500.
 */
export function PatientNotizFeld({ einsatzId, patientId, initialValue, className }: PatientNotizFeldProps) {
  const mutation = useAktualisiereNotiz({ einsatzId, patientId });
  const initialNormalized = useMemo(() => normalizeNotiz(initialValue), [initialValue]);
  const initialValueRef = useRef(initialNormalized);
  const committedDraftRef = useRef<string | null>(initialNormalized);
  const [draft, setDraft] = useState<string>(initialNormalized ?? '');

  // `initialValue`-Wechsel (z. B. Patient-Switch im Split-View oder Refetch
  // nach erfolgreichem Save): den lokalen Draft synchronisieren NUR wenn
  // (a) keine Mutation läuft UND (b) der Nutzer keine ungespeicherten Edits
  // im Buffer hat. Sonst überschreibt jede Server-Antwort die laufende Eingabe.
  useEffect(() => {
    if (initialValueRef.current === initialNormalized) return;
    if (mutation.isPending) return;
    const localDirty = normalizeNotiz(draft) !== committedDraftRef.current;
    if (localDirty) return;
    initialValueRef.current = initialNormalized;
    committedDraftRef.current = initialNormalized;
    setDraft(initialNormalized ?? '');
  }, [initialNormalized, mutation.isPending, draft]);

  const autoSave = useAutoSave<string | null, unknown>({
    entityId: patientId,
    entityType: 'patient.notiz',
    debounceMs: 2000,
    enabled: Boolean(einsatzId && patientId),
    saveFn: async (next) => {
      const previousBaseline = initialValueRef.current;
      const normalizedNext = normalizeNotiz(next);
      try {
        const result = await mutation.mutateAsync({ neueNotiz: next });
        initialValueRef.current = normalizedNext;
        committedDraftRef.current = normalizedNext;
        return result;
      } catch (error) {
        // Server-Reject: optimistisches Baseline-Update zurückrollen, sonst
        // glaubt `hasChanges` fälschlicherweise „nichts geändert" beim
        // nächsten Tipp-Versuch.
        initialValueRef.current = previousBaseline;
        committedDraftRef.current = previousBaseline;
        throw error;
      }
    },
    hasChanges: (next) => normalizeNotiz(next) !== initialValueRef.current,
  });

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setDraft(next);
    autoSave.scheduleSave(normalizeNotiz(next));
  };

  // Story 1.7 Code-Review-Patch: Unmount mit pending Debounce verliert
  // sonst Eingaben (Drawer-Close auf Tablet im BHP — klinisches Risiko).
  // `flushNow` cancelt den Debounce und triggert sofort `saveFn`, sodass
  // der Mutation-Pfad noch durchläuft. Status `dirty`/`debouncing` ist der
  // Indikator für „pending Save".
  useEffect(() => {
    return () => {
      if (autoSave.status === 'dirty' || autoSave.status === 'debouncing') {
        void autoSave.flushNow();
      }
    };
    // Bewusst nur einmal beim Unmount; `autoSave`-Referenz bleibt stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLabelId = `patient-notiz-status-${patientId}`;
  const hintId = `patient-notiz-hint-${patientId}`;
  const inputId = `patient-notiz-${patientId}`;
  const charsLeft = MAX_NOTIZ_LENGTH - draft.length;
  const badgeStatus = mapStatusToBadge(autoSave.status);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
        Notiz
      </label>
      <textarea
        id={inputId}
        value={draft}
        onChange={handleChange}
        maxLength={MAX_NOTIZ_LENGTH}
        rows={4}
        aria-describedby={`${hintId} ${statusLabelId}`}
        className="bg-surface-input focus:border-border-focus min-h-[88px] w-full rounded-md border border-border-subtle p-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        placeholder={'Optionale Pflege-/Übergabe-Notiz (z. B. „Verdacht SHT, Begleitperson: Mutter")'}
        data-testid="patient-notiz-feld"
      />
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span id={hintId}>{`Max. ${MAX_NOTIZ_LENGTH} Zeichen, Auto-Save nach 2 s Pause (noch ${charsLeft}).`}</span>
        <SyncStatusBadge status={badgeStatus} className="text-xs" />
        <span id={statusLabelId} className="sr-only" aria-live="polite">
          {humanReadableStatus(autoSave.status)}
        </span>
      </div>
    </div>
  );
}

function normalizeNotiz(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function mapStatusToBadge(status: AutoSaveStatus): SyncStatusBadgeStatus {
  // `useAutoSave` und `SyncStatusBadge` teilen denselben Status-Wertebereich
  // bis auf `idle/local-saved` — wir reichen 1:1 durch.
  return status;
}

function humanReadableStatus(status: AutoSaveStatus): string {
  switch (status) {
    case 'idle':
    case 'synced':
      return 'Notiz gespeichert';
    case 'dirty':
    case 'debouncing':
      return 'Eingabe wird verarbeitet';
    case 'syncing':
      return 'Wird gespeichert';
    case 'local-saved':
      return 'Lokal gespeichert';
    case 'offline-queued':
      return 'Offline gespeichert — Synchronisation wartet';
    case 'conflict':
      return 'Konflikt — bitte erneut prüfen';
    case 'error':
      return 'Fehler beim Speichern';
    default:
      return status;
  }
}
