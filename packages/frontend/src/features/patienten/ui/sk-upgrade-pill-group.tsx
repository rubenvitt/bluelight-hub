/**
 * `SkUpgradePillGroup` — Inline-Reevaluierung der SK eines Patienten
 * (Story 1.3, AC5, UX-DR10).
 *
 * **Bedienfluss:**
 *  1. Aktive SK-Pill ist hervorgehoben (`aria-pressed=true`) und disabled.
 *  2. Tap auf eine inaktive Pill öffnet einen Inline-`Confirm-Pill`-Block
 *     („Bestätigen" + „Abbrechen") — kein Modal (analog `SkSelector`).
 *  3. Optionaler `grund`-Freitext (Disclosure) wird mitgesendet.
 *  4. Bestätigen löst die Mutation aus (Optimistic-UI via
 *     `useSichtungAktualisieren`); Fehler rendern eine Inline-Fehler-Pill
 *     (`aria-live="assertive"`).
 *
 * **Verbote (UX-Spec „Feedback Patterns" + CLAUDE.md):**
 *  - Kein `toast.success` / `toast.error` im Patienten-Modul.
 *  - Kein Modal (Inline-Bestätigung, Pattern Story 1.2 `SkSelector`).
 *  - Keine algorithmische Empfehlung („Empfohlene neue SK") — MDR-Grenze (ADR-015).
 */
import type { SkEnum } from '@bluelight-hub/shared/client';
import { clsx } from 'clsx';
import { useCallback, useMemo, useState } from 'react';
import { SK_COLOR_MAP } from '../constants/sk-color-map';
import { SK_DISPLAY_ORDER, SK_LABELS } from '../constants/sk-labels';
import { useSichtungAktualisieren } from '../api/use-sichtung-aktualisieren';
import type { SichtungArt } from '../schemas/aktualisiere-sichtung.schema';

interface SkUpgradePillGroupProps {
  einsatzId: string;
  patientId: string;
  currentSk: SkEnum;
  patientennummer: string;
  /** Default-Sichtungsart für die Reevaluierung (ärztlich oder Vorsichtung). */
  defaultSichtungArt?: SichtungArt;
}

interface PendingSelection {
  neueSk: SkEnum;
  grund: string;
  grundExpanded: boolean;
}

export function SkUpgradePillGroup({ einsatzId, patientId, currentSk, patientennummer, defaultSichtungArt = 'aerztlich' }: SkUpgradePillGroupProps) {
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [sichtungArt, setSichtungArt] = useState<SichtungArt>(defaultSichtungArt);
  const mutation = useSichtungAktualisieren({ einsatzId, patientId });

  const isPending = mutation.isPending;
  const errorMessage = useMemo(() => extractError(mutation.error), [mutation.error]);

  const handlePillTap = useCallback(
    (sk: SkEnum) => {
      if (sk === currentSk || isPending) return;
      setPending({ neueSk: sk, grund: '', grundExpanded: false });
      mutation.reset();
    },
    [currentSk, isPending, mutation],
  );

  const cancel = useCallback(() => {
    setPending(null);
    mutation.reset();
  }, [mutation]);

  const confirm = useCallback(async () => {
    if (!pending) return;
    const trimmedGrund = pending.grund.trim();
    try {
      await mutation.mutateAsync({
        neueSk: pending.neueSk,
        sichtungArt,
        grund: trimmedGrund.length > 0 ? trimmedGrund : undefined,
      });
      setPending(null);
    } catch {
      // Fehler wird über mutation.error Zustand abgehandelt
    }
  }, [mutation, pending, sichtungArt]);

  return (
    <div className="flex flex-col gap-3" data-testid="sk-upgrade-pill-group">
      <div role="group" aria-label={`Sichtungs-Reevaluierung für Patient ${patientennummer}`} className="flex flex-wrap gap-2">
        {SK_DISPLAY_ORDER.map((sk) => {
          const active = sk === currentSk;
          const isPendingSelection = pending?.neueSk === sk;
          const colors = SK_COLOR_MAP[sk];
          const label = SK_LABELS[sk];

          return (
            <button
              key={sk}
              type="button"
              aria-pressed={active}
              aria-label={`${label.label}${active ? ' (aktuell)' : ''}`}
              data-testid={`sk-upgrade-pill-${sk}`}
              disabled={active || isPending}
              onClick={() => handlePillTap(sk)}
              className={clsx(
                'min-h-12 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                colors.klass,
                active ? 'cursor-default opacity-100 shadow-sm ring-2 ring-offset-2' : 'opacity-70 hover:opacity-100',
                isPendingSelection && 'ring-2 ring-offset-2',
                isPending && !active && 'cursor-not-allowed opacity-50',
              )}
              style={active ? { boxShadow: `inset 0 0 0 2px ${colors.border}` } : undefined}
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
          aria-label={`Reevaluierung bestätigen: ${SK_LABELS[pending.neueSk].label}`}
          className="flex flex-col gap-2 rounded-md border-2 border-gray-300 bg-gray-50 p-3"
          data-testid="sk-upgrade-confirm"
        >
          <p className="text-sm text-gray-800">
            Neue Sichtungskategorie für Patient <strong>{patientennummer}</strong>: <strong>{SK_LABELS[pending.neueSk].label}</strong> (aktuell {SK_LABELS[currentSk].label})
          </p>

          <fieldset className="flex flex-wrap gap-3 text-sm text-gray-700">
            <legend className="sr-only">Sichtungsart</legend>
            {(['aerztlich', 'vorsichtung'] as const).map((art) => (
              <label key={art} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name={`sk-upgrade-sichtungart-${patientId}`}
                  value={art}
                  checked={sichtungArt === art}
                  onChange={() => setSichtungArt(art)}
                  data-testid={`sk-upgrade-sichtungart-${art}`}
                />
                <span>{art === 'aerztlich' ? 'ärztliche Sichtung' : 'Vorsichtung'}</span>
              </label>
            ))}
          </fieldset>

          <button
            type="button"
            onClick={() => setPending((prev) => (prev ? { ...prev, grundExpanded: !prev.grundExpanded } : prev))}
            aria-expanded={pending.grundExpanded}
            aria-controls={`sk-upgrade-grund-${patientId}`}
            className="self-start text-sm font-medium text-blue-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            data-testid="sk-upgrade-grund-toggle"
          >
            {pending.grundExpanded ? 'Grund ausblenden' : 'Grund hinzufügen (optional)'}
          </button>

          {pending.grundExpanded ? (
            <label htmlFor={`sk-upgrade-grund-${patientId}`} className="flex flex-col gap-1 text-sm text-gray-700">
              <span>Grund (max. 500 Zeichen)</span>
              <textarea
                id={`sk-upgrade-grund-${patientId}`}
                value={pending.grund}
                maxLength={500}
                rows={2}
                onChange={(event) => setPending((prev) => (prev ? { ...prev, grund: event.target.value } : prev))}
                className="rounded border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                data-testid="sk-upgrade-grund-input"
              />
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={isPending}
              className="min-h-12 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
              data-testid="sk-upgrade-confirm-button"
            >
              {isPending ? 'Wird übernommen…' : 'Bestätigen'}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={isPending}
              className="min-h-12 rounded-md border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
              data-testid="sk-upgrade-cancel-button"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <p role="alert" aria-live="assertive" data-testid="sk-upgrade-error" className="rounded-md border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

function extractError(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    const message = (error as { message: string }).message;
    if (message.includes('SichtungVonTotNichtErlaubt')) {
      return 'Konflikt — Patient ist als TOT markiert. Sichtungs-Korrektur nur via Korrektur-Event (Story 1.4).';
    }
    if (message.includes('SichtungUnveraendert')) {
      return 'Neue Sichtung entspricht der aktuellen — keine Änderung.';
    }
    if (message.includes('PatientNichtGefunden')) {
      return 'Konflikt — Patient wurde zwischenzeitlich geändert oder entfernt, bitte Detail neu laden.';
    }
    return `Reevaluierung fehlgeschlagen: ${message}`;
  }
  return 'Reevaluierung fehlgeschlagen.';
}
