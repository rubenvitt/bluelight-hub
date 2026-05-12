import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { Button } from '@/shared/ui/atoms/button.atom';
import { EinheitCombobox } from '@/features/kraefte/ui/molecules';
import { useReportVorfall } from '../../api/use-report-vorfall';
import type { ReportVorfallDto } from '@bluelight-hub/shared/client';
import { reportVorfallFormSchema } from '../../schemas/vorfall.schema';
import { PersonCombobox } from '../molecules/PersonCombobox';

const MAX_WAS_LENGTH = 80;
const MAX_MASSNAHMEN_LENGTH = 4000;
const MAX_FREITEXT_WO_LENGTH = 480;

export interface VorfallMeldenDrawerProps {
  readonly einsatzId: string;
  readonly einheitId: string | null;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: () => void;
}

type WoMode = 'none' | 'coordinate' | 'freitext';

interface BeteiligterRow {
  readonly key: string;
  readonly kind: 'user' | 'freitext';
  readonly userId: string;
  readonly name: string;
  readonly rolle: string;
}

function nowLocalIsoMinute(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function localToIsoUtc(localValue: string): string | null {
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Stabile Row-Keys via crypto.randomUUID, mit Counter-Fallback für non-secure Contexts. */
let beteiligterRowCounter = 0;
function nextBeteiligterRowKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  beteiligterRowCounter += 1;
  return `beteiligter-${beteiligterRowCounter}-${Date.now()}`;
}

/**
 * Drawer „Vorfall melden" (Story 5.1, AC10).
 *
 * **UX-Anker:** Inline-Drawer mit Pflichtfeldern Was/Wann + optionalen
 * Wo/Beteiligte/Maßnahmen + Toggle „Unfallkasse-relevant". Cmd/Ctrl+Enter
 * triggert Submit; Esc schließt. Pattern: `MeldeLueckeDialog` + `SicherungspostenDrawer`.
 *
 * **Zero-Toast** (UX-DR21): Mutation-Fehler werden inline gerendert.
 *
 * **Offline-Pfad (AC11, FR48/FR49):** Identisch zum bestehenden Eigenschutz-
 * Pattern — TanStack-Query `useMutation` ohne dedizierte Pending-Command-
 * Queue. Bei Netzwerk-Fehler zeigt der Drawer den Inline-Error.
 *
 * **Inline-Einheit-Picker:** Wenn keine *aktive* Einheit (Story-2.7-MVP via
 * localStorage) gewählt ist, rendert der Drawer ein Dropdown mit allen
 * Einsatz-Einheiten. Backend verlangt weiterhin `einheitId` — der Picker
 * entkoppelt die Vorfallmeldung nur von der globalen UX-Auswahl, sodass der
 * User die Einheit ad-hoc pro Meldung bestimmen kann.
 */
export function VorfallMeldenDrawer({ einsatzId, einheitId, open, onClose, onSuccess }: VorfallMeldenDrawerProps) {
  const reportVorfall = useReportVorfall(einsatzId);
  const wasInputRef = useRef<HTMLInputElement | null>(null);
  // Submit-Re-Entry-Guard: schützt gegen Doppel-Klick / Cmd+Enter-Burst, bevor
  // der React-State `isPending` per Render durchgepropagiert wird.
  const submittingRef = useRef<boolean>(false);
  const labelId = useId();
  const helpId = useId();

  const [was, setWas] = useState<string>('');
  const [wann, setWann] = useState<string>(nowLocalIsoMinute());
  const [woMode, setWoMode] = useState<WoMode>('none');
  const [woCoordinate, setWoCoordinate] = useState<{ longitude: string; latitude: string; addressHint: string }>({ longitude: '', latitude: '', addressHint: '' });
  const [woFreitext, setWoFreitext] = useState<string>('');
  const [beteiligte, setBeteiligte] = useState<BeteiligterRow[]>([]);
  const [massnahmen, setMassnahmen] = useState<string>('');
  const [unfallkasseRelevant, setUnfallkasseRelevant] = useState<boolean>(false);
  const [pickedEinheitId, setPickedEinheitId] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'was' | 'wann' | 'wo' | 'beteiligte' | 'massnahmen', string>>>({});

  useEffect(() => {
    if (open) {
      setWas('');
      setWann(nowLocalIsoMinute());
      setWoMode('none');
      setWoCoordinate({ longitude: '', latitude: '', addressHint: '' });
      setWoFreitext('');
      setBeteiligte([]);
      setMassnahmen('');
      setUnfallkasseRelevant(false);
      setPickedEinheitId('');
      setSubmitError(null);
      setFieldErrors({});
      submittingRef.current = false;
    }
  }, [open]);

  // Wirksame Einheit-ID: aktive Einheit aus localStorage hat Vorrang; ohne sie
  // greift die im Drawer ad-hoc gewählte Einheit.
  const effectiveEinheitId = einheitId ?? (pickedEinheitId.length > 0 ? pickedEinheitId : null);
  const showEinheitPicker = einheitId === null;

  const isPending = reportVorfall.isPending;
  const trimmedWas = was.trim();
  const wasValid = trimmedWas.length >= 1 && trimmedWas.length <= MAX_WAS_LENGTH;
  const wannValid = wann.length > 0;
  const einheitValid = effectiveEinheitId !== null;
  const isSubmitDisabled = !wasValid || !wannValid || !einheitValid || isPending;
  // Dirty-Tracking: Esc / Cancel verlangen Bestätigung, sobald irgendein Feld
  // vom initialen Reset abweicht. `wann` schließen wir bewusst aus, weil der
  // Reset-Effect immer eine neue Default-Wallclock setzt.
  const isDirty =
    was.length > 0 ||
    woMode !== 'none' ||
    woCoordinate.longitude.length > 0 ||
    woCoordinate.latitude.length > 0 ||
    woCoordinate.addressHint.length > 0 ||
    woFreitext.length > 0 ||
    beteiligte.length > 0 ||
    massnahmen.length > 0 ||
    unfallkasseRelevant ||
    pickedEinheitId.length > 0;

  const buildBody = useCallback((): ReportVorfallDto | null => {
    if (effectiveEinheitId === null) return null;
    let wo: ReportVorfallDto['wo'] = null;
    if (woMode === 'coordinate') {
      const longitude = Number.parseFloat(woCoordinate.longitude);
      const latitude = Number.parseFloat(woCoordinate.latitude);
      if (Number.isNaN(longitude) || Number.isNaN(latitude)) {
        setFieldErrors((prev) => ({ ...prev, wo: 'Koordinaten sind erforderlich' }));
        return null;
      }
      wo = {
        kind: 'coordinate',
        longitude,
        latitude,
        ...(woCoordinate.addressHint.trim().length > 0 ? { addressHint: woCoordinate.addressHint.trim() } : {}),
      };
    } else if (woMode === 'freitext') {
      const text = woFreitext.trim();
      if (text.length === 0) {
        setFieldErrors((prev) => ({ ...prev, wo: 'Freitext darf nicht leer sein' }));
        return null;
      }
      wo = { kind: 'freitext', text };
    }

    const beteiligteOut: ReportVorfallDto['beteiligte'] = beteiligte.map((row) =>
      row.kind === 'user'
        ? { kind: 'user' as const, userId: row.userId.trim(), ...(row.rolle.trim() ? { rolle: row.rolle.trim() } : {}) }
        : { kind: 'freitext' as const, name: row.name.trim(), ...(row.rolle.trim() ? { rolle: row.rolle.trim() } : {}) },
    );

    const wannIso = localToIsoUtc(wann);
    if (wannIso === null) {
      setFieldErrors((prev) => ({ ...prev, wann: 'Zeitstempel ist ungültig — bitte korrigieren.' }));
      return null;
    }
    return {
      einheitId: effectiveEinheitId,
      was: trimmedWas,
      wann: wannIso,
      vorfallZeit: wannIso,
      wo,
      beteiligte: beteiligteOut,
      massnahmen: massnahmen.trim(),
      unfallkasseRelevant,
    };
  }, [effectiveEinheitId, woMode, woCoordinate, woFreitext, beteiligte, wann, trimmedWas, massnahmen, unfallkasseRelevant]);

  const submit = useCallback(async () => {
    if (isSubmitDisabled) return;
    // Re-Entry-Guard gegen Doppel-Klick / Cmd+Enter-Burst, bevor `isPending`
    // per React-Render durchpropagiert. Schützt die append-only Vorfall-Liste
    // vor identischen Duplikat-Insertions.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitError(null);
    setFieldErrors({});
    const body = buildBody();
    if (!body) {
      submittingRef.current = false;
      return;
    }
    const validation = reportVorfallFormSchema.safeParse({ ...body, beteiligte: body.beteiligte });
    if (!validation.success) {
      const issues = validation.error.issues;
      const next: typeof fieldErrors = {};
      for (const issue of issues) {
        const field = issue.path[0];
        if (field === 'was' || field === 'wann' || field === 'massnahmen' || field === 'wo' || field === 'beteiligte') {
          next[field] = issue.message;
        }
      }
      setFieldErrors(next);
      submittingRef.current = false;
      return;
    }
    try {
      await reportVorfall.mutateAsync(body);
      onSuccess?.();
      onClose();
    } catch (error) {
      const status = (error as { response?: { status?: number } } | null)?.response?.status;
      if (status === 403) {
        setSubmitError('Keine Berechtigung — Permission `eigenschutz:vorfall:report` fehlt.');
      } else if (status === 422) {
        const data = (error as { response?: { data?: { context?: { field?: string; index?: number } } } } | null)?.response?.data;
        const ctx = data?.context;
        if (ctx?.field === 'wo') {
          setFieldErrors((prev) => ({ ...prev, wo: 'Server lehnt den Ort-Wert ab.' }));
        } else if (ctx?.field === 'beteiligte') {
          setFieldErrors((prev) => ({ ...prev, beteiligte: `Beteiligter #${(ctx.index ?? 0) + 1} ungültig.` }));
        } else {
          setSubmitError('Eingabe verletzt eine Konsistenz-Regel — bitte prüfen.');
        }
      } else {
        setSubmitError('Vorfall-Meldung fehlgeschlagen — bitte erneut versuchen (Offline?).');
      }
    } finally {
      submittingRef.current = false;
    }
  }, [buildBody, isSubmitDisabled, onClose, onSuccess, reportVorfall]);

  const handleClose = useCallback(() => {
    if (isPending) return;
    if (isDirty) {
      const confirmed = typeof window !== 'undefined' && window.confirm('Es gibt noch nicht gespeicherte Änderungen. Wirklich verwerfen?');
      if (!confirmed) return;
    }
    onClose();
  }, [isDirty, isPending, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!isSubmitDisabled) void submit();
      }
    },
    [submit, isSubmitDisabled],
  );

  const addBeteiligterRow = useCallback((kind: BeteiligterRow['kind']) => {
    setBeteiligte((prev) => [...prev, { key: nextBeteiligterRowKey(), kind, userId: '', name: '', rolle: '' }]);
  }, []);

  const removeBeteiligterRow = useCallback((key: string) => {
    setBeteiligte((prev) => prev.filter((row) => row.key !== key));
  }, []);

  const updateBeteiligter = useCallback((key: string, patch: Partial<Omit<BeteiligterRow, 'key' | 'kind'>>) => {
    setBeteiligte((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }, []);

  const counterClass = useMemo(() => (was.length > MAX_WAS_LENGTH * 0.85 ? 'text-status-warning-text' : 'text-text-muted'), [was.length]);

  if (!open) return null;

  return (
    <Dialog isOpen={true} onClose={handleClose} size="lg" closeOnEscape={!isPending} closeOnClickOutside={!isPending} initialFocus={wasInputRef as React.RefObject<HTMLElement>}>
      <div data-testid="vorfall-melden-drawer" data-vorfall-error={submitError !== null ? 'true' : undefined} className="flex flex-col gap-4" onKeyDown={handleKeyDown}>
        <Dialog.Title className="text-lg">Vorfall melden</Dialog.Title>
        <Dialog.Body className="space-y-4">
          <p id={helpId} className="text-sm text-text-muted">
            Erfasse den Vorfall mit Pflichtfeldern „Was" und „Wann" sowie optionalen Angaben zu Ort, Beteiligten und Maßnahmen. Der Vorfall wird unmittelbar im Audit-Trail protokolliert.
          </p>

          {showEinheitPicker && (
            <div data-testid="vorfall-einheit-picker" className="flex flex-col gap-1 rounded-md border border-border-subtle bg-surface-panel px-3 py-2">
              <p className="text-xs text-text-muted">Keine aktive Einheit gewählt — bitte für diesen Vorfall eine Einheit auswählen.</p>
              <EinheitCombobox
                einsatzId={einsatzId}
                value={pickedEinheitId}
                onChange={setPickedEinheitId}
                disabled={isPending}
                label="Einheit für diese Meldung *"
                placeholder="Einheit suchen…"
                allowEmpty
              />
            </div>
          )}

          {/* Was */}
          <div className="flex flex-col gap-1">
            <label id={labelId} htmlFor="vorfall-was" className="text-sm font-medium text-text-primary">
              Was passiert / passierte?{' '}
              <span className="text-status-danger-text" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="vorfall-was"
              ref={wasInputRef}
              data-testid="vorfall-was-input"
              type="text"
              value={was}
              onChange={(e) => setWas(e.target.value.slice(0, MAX_WAS_LENGTH))}
              maxLength={MAX_WAS_LENGTH}
              aria-required="true"
              aria-invalid={fieldErrors.was ? true : undefined}
              placeholder="z. B. Sturz beim Aufstieg"
              className="border-border-default bg-surface-base focus:border-border-focus w-full rounded-md border px-3 py-2 text-sm text-text-primary focus:outline-none"
              disabled={isPending}
            />
            <div className="flex items-center justify-between text-xs">
              <span className={fieldErrors.was ? 'text-status-danger-text' : 'text-text-muted'}>{fieldErrors.was ?? 'Kurzbeschreibung (1–80 Zeichen)'}</span>
              <span data-testid="vorfall-was-counter" className={`tabular-nums ${counterClass}`}>
                {was.length}/{MAX_WAS_LENGTH}
              </span>
            </div>
          </div>

          {/* Wann */}
          <div className="flex flex-col gap-1">
            <label htmlFor="vorfall-wann" className="text-sm font-medium text-text-primary">
              Wann?{' '}
              <span className="text-status-danger-text" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="vorfall-wann"
              data-testid="vorfall-wann-input"
              type="datetime-local"
              value={wann}
              onChange={(e) => setWann(e.target.value)}
              aria-required="true"
              aria-invalid={fieldErrors.wann ? true : undefined}
              className="border-border-default bg-surface-base focus:border-border-focus w-full rounded-md border px-3 py-2 text-sm text-text-primary focus:outline-none"
              disabled={isPending}
            />
            {fieldErrors.wann && <span className="text-xs text-status-danger-text">{fieldErrors.wann}</span>}
          </div>

          {/* Wo Toggle */}
          <fieldset className="flex flex-col gap-2 rounded-md border border-border-subtle p-3">
            <legend className="px-1 text-sm font-medium text-text-primary">Ort (optional)</legend>
            <div className="flex flex-wrap gap-2 text-sm">
              <label className="inline-flex items-center gap-1.5">
                <input type="radio" name="vorfall-wo-mode" data-testid="vorfall-wo-mode-none" checked={woMode === 'none'} onChange={() => setWoMode('none')} disabled={isPending} />
                <span>kein Ort</span>
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="radio" name="vorfall-wo-mode" data-testid="vorfall-wo-mode-coordinate" checked={woMode === 'coordinate'} onChange={() => setWoMode('coordinate')} disabled={isPending} />
                <span>Koordinate</span>
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="radio" name="vorfall-wo-mode" data-testid="vorfall-wo-mode-freitext" checked={woMode === 'freitext'} onChange={() => setWoMode('freitext')} disabled={isPending} />
                <span>Freitext</span>
              </label>
            </div>
            {woMode === 'coordinate' && (
              <div data-testid="vorfall-wo-coordinate-section" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="number"
                  data-testid="vorfall-wo-longitude"
                  placeholder="Längengrad"
                  value={woCoordinate.longitude}
                  onChange={(e) => setWoCoordinate((p) => ({ ...p, longitude: e.target.value }))}
                  className="border-border-default rounded-md border px-2 py-1 text-sm"
                  disabled={isPending}
                />
                <input
                  type="number"
                  data-testid="vorfall-wo-latitude"
                  placeholder="Breitengrad"
                  value={woCoordinate.latitude}
                  onChange={(e) => setWoCoordinate((p) => ({ ...p, latitude: e.target.value }))}
                  className="border-border-default rounded-md border px-2 py-1 text-sm"
                  disabled={isPending}
                />
                <input
                  type="text"
                  data-testid="vorfall-wo-addresshint"
                  placeholder="Adress-Hinweis (≤ 300)"
                  maxLength={300}
                  value={woCoordinate.addressHint}
                  onChange={(e) => setWoCoordinate((p) => ({ ...p, addressHint: e.target.value }))}
                  className="border-border-default rounded-md border px-2 py-1 text-sm"
                  disabled={isPending}
                />
              </div>
            )}
            {woMode === 'freitext' && (
              <input
                type="text"
                data-testid="vorfall-wo-freitext"
                placeholder="Eingang Süd, Halle 3"
                maxLength={MAX_FREITEXT_WO_LENGTH}
                value={woFreitext}
                onChange={(e) => setWoFreitext(e.target.value)}
                className="border-border-default rounded-md border px-3 py-2 text-sm"
                disabled={isPending}
              />
            )}
            {fieldErrors.wo && (
              <span data-testid="vorfall-wo-error" className="text-xs text-status-danger-text">
                {fieldErrors.wo}
              </span>
            )}
          </fieldset>

          {/* Beteiligte */}
          <fieldset className="flex flex-col gap-2 rounded-md border border-border-subtle p-3">
            <legend className="px-1 text-sm font-medium text-text-primary">Beteiligte (optional)</legend>
            {beteiligte.map((row) => (
              <div key={row.key} data-testid={`vorfall-beteiligter-row-${row.key}`} className="grid grid-cols-12 gap-2">
                <span className="col-span-2 text-xs text-text-muted">{row.kind === 'user' ? 'Person' : 'Freitext'}</span>
                {row.kind === 'user' ? (
                  <div className="col-span-5" data-testid={`vorfall-beteiligter-userid-${row.key}`}>
                    <PersonCombobox value={row.userId} onChange={(userId) => updateBeteiligter(row.key, { userId })} label="" placeholder="Person auswählen…" disabled={isPending} />
                  </div>
                ) : (
                  <input
                    data-testid={`vorfall-beteiligter-name-${row.key}`}
                    type="text"
                    placeholder="Name"
                    value={row.name}
                    onChange={(e) => updateBeteiligter(row.key, { name: e.target.value })}
                    className="border-border-default col-span-5 rounded-md border px-2 py-1 text-sm"
                    disabled={isPending}
                  />
                )}
                <input
                  data-testid={`vorfall-beteiligter-rolle-${row.key}`}
                  type="text"
                  placeholder="Rolle (optional)"
                  maxLength={100}
                  value={row.rolle}
                  onChange={(e) => updateBeteiligter(row.key, { rolle: e.target.value })}
                  className="border-border-default col-span-4 rounded-md border px-2 py-1 text-sm"
                  disabled={isPending}
                />
                <button
                  type="button"
                  data-testid={`vorfall-beteiligter-remove-${row.key}`}
                  onClick={() => removeBeteiligterRow(row.key)}
                  disabled={isPending}
                  className="col-span-1 text-sm text-status-danger-text hover:underline"
                >
                  Entfernen
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button data-testid="vorfall-beteiligter-add-user" intent="secondary" onClick={() => addBeteiligterRow('user')} disabled={isPending}>
                + Person
              </Button>
              <Button data-testid="vorfall-beteiligter-add-freitext" intent="secondary" onClick={() => addBeteiligterRow('freitext')} disabled={isPending}>
                + Freitext
              </Button>
            </div>
            {fieldErrors.beteiligte && (
              <span data-testid="vorfall-beteiligte-error" className="text-xs text-status-danger-text">
                {fieldErrors.beteiligte}
              </span>
            )}
          </fieldset>

          {/* Maßnahmen */}
          <div className="flex flex-col gap-1">
            <label htmlFor="vorfall-massnahmen" className="text-sm font-medium text-text-primary">
              Maßnahmen (optional)
            </label>
            <textarea
              id="vorfall-massnahmen"
              data-testid="vorfall-massnahmen-input"
              rows={4}
              value={massnahmen}
              onChange={(e) => setMassnahmen(e.target.value.slice(0, MAX_MASSNAHMEN_LENGTH))}
              maxLength={MAX_MASSNAHMEN_LENGTH}
              placeholder="Erstversorgung durchgeführt, RTW alarmiert"
              className="border-border-default bg-surface-base focus:border-border-focus w-full rounded-md border px-3 py-2 text-sm text-text-primary focus:outline-none"
              disabled={isPending}
            />
            <div className="flex items-center justify-end text-xs">
              <span data-testid="vorfall-massnahmen-counter" className="text-text-muted tabular-nums">
                {massnahmen.length}/{MAX_MASSNAHMEN_LENGTH}
              </span>
            </div>
          </div>

          {/* Unfallkasse-relevant */}
          <label className="inline-flex items-start gap-2 rounded-md border border-border-subtle bg-surface-panel px-3 py-2">
            <input
              type="checkbox"
              data-testid="vorfall-unfallkasse-checkbox"
              checked={unfallkasseRelevant}
              onChange={(e) => setUnfallkasseRelevant(e.target.checked)}
              disabled={isPending}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="font-medium text-text-primary">Unfallkasse-relevant</span>
              <span className="block text-xs text-text-muted">Markiert den Vorfall für die Unfallkassen-Aufbereitung</span>
            </span>
          </label>

          {submitError !== null && (
            <p data-testid="vorfall-error-text" role="alert" className="bg-status-danger-bg rounded-md border border-status-danger-border px-3 py-2 text-sm text-status-danger-text">
              {submitError}
            </p>
          )}
        </Dialog.Body>
        <Dialog.Footer loading={isPending}>
          <Button data-testid="vorfall-cancel" intent="secondary" onClick={handleClose} disabled={isPending}>
            Abbrechen
          </Button>
          <Button data-testid="vorfall-submit" intent="primary" onClick={() => void submit()} disabled={isSubmitDisabled}>
            Vorfall melden
          </Button>
        </Dialog.Footer>
        <p className="text-right text-xs text-text-muted">Tipp: Cmd/Ctrl + Enter sendet die Meldung.</p>
      </div>
    </Dialog>
  );
}
