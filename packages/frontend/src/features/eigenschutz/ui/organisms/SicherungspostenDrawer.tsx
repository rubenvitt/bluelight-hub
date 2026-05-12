/**
 * SicherungspostenDrawer — Drawer-Organism zum Anlegen und Bearbeiten eines
 * Sicherungspostens (Story 4.1, T6 + Story 4.2 T4/T5).
 *
 * Felder:
 * - **Bezeichnung** (Pflicht, 1–200 Zeichen).
 * - **Standort** als discriminated Union: `coordinate` (longitude/latitude
 *   + optional `addressHint`) ODER `address` (Freitext). RadioGroup-Toggle.
 * - **Personal**: Liste discriminated Unions (`einsatzPerson` mit
 *   einsatzPersonId ODER `freitext` mit name + optional rolle).
 *   Hinzufügen/Entfernen via Buttons; Toggle pro Eintrag zwischen
 *   Person-Auswahl und Freitext.
 * - **Zuständigkeitsbereich** (optional, Textarea ≤ 4000 Zeichen).
 * - **Ablösezeiten** (Story 4.2): Freitext-Editor ≤ 2000 Zeichen mit
 *   Auto-Save (`useAutoSave`, Debounce 2 s, online-only). Im Edit-Mode
 *   eigener Persistenz-Pfad: Footer-Submit lässt das Feld weg
 *   (Race-Vermeidung) — Auto-Save besitzt `abloesezeiten` exklusiv.
 *
 * 409-Konflikt-Pfad: typsierter {@link SicherungspostenConflictError} →
 * Inline-Banner mit `currentVersion` und „Neu laden"-CTA (Story 4.2).
 * Submit bleibt blockiert, bis der User den Drawer schließt
 * (Pattern aus `SicherheitsregelDrawer`).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import type { CreateSicherungspostenDto, SicherungspostenDto, UpdateSicherungspostenDto } from '@bluelight-hub/shared/client';
import { Button } from '@/shared/ui/atoms/button.atom';
import { Input } from '@/shared/ui/atoms/input.atom';
import { Textarea } from '@/shared/ui/atoms/textarea.atom';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { SicherungspostenConflictError, sicherungspostenQueryKeys, useCreateSicherungsposten, useUpdateSicherungsposten } from '../../api/use-sicherungsposten';
import { PersonCombobox } from '../molecules/PersonCombobox';
import { useAutoSave, type AutoSaveStatus, type UseAutoSaveReturn } from '../../hooks/useAutoSave';
import { sicherungspostenFormSchema, type SicherungspostenFormValues, type Standort, type PersonalEntry } from '../../schemas/sicherungsposten.schema';

/**
 * Normalisiert Ablösezeiten-Drafts: trimmt Whitespace und behandelt
 * `null`/`undefined`/`""` als äquivalent (alle drei → `null`). Verhindert
 * No-Op-Versions-Inflation, wenn der User den Cursor ohne Änderung in den
 * Textarea setzt. Persistierter Wert ist getrimmt — Backend `@Length(0,2000)`
 * validiert ohne Trim.
 */
function normalizeAbloesezeiten(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Status-Badge-Mapping für den Auto-Save-FSM (AC7-Tabelle).
 * `idle`/`local-saved`/`offline-queued` rendern `null` (Story 4.2 ist
 * online-only ohne `onLocalSave`/`onOfflineSave`).
 */
type BadgeStatus = AutoSaveStatus | 'conflict';
const AUTO_SAVE_BADGE_TONES: Record<string, { readonly text: string; readonly className: string }> = {
  dirty: { text: 'Nicht gespeichert', className: 'bg-status-warning-surface text-status-warning-text' },
  debouncing: { text: 'Wird gespeichert…', className: 'bg-surface-panel-elevated text-text-muted' },
  syncing: { text: 'Wird synchronisiert…', className: 'bg-surface-panel-elevated text-text-muted' },
  synced: { text: 'Gespeichert', className: 'bg-status-success-surface text-status-success-text' },
  conflict: { text: 'Konflikt — bitte neu laden', className: 'bg-status-warning-surface text-status-warning-text' },
  error: { text: 'Fehler — Eingabe bleibt erhalten', className: 'bg-status-danger-surface text-status-danger-text' },
};

interface AutoSaveBadgeProps {
  readonly status: BadgeStatus;
}

function AutoSaveBadge({ status }: AutoSaveBadgeProps) {
  const tone = AUTO_SAVE_BADGE_TONES[status];
  if (!tone) return null;
  return (
    <span data-testid="sicherungsposten-abloesezeiten-autosave-status" className={`inline-flex items-center rounded-full border border-border-subtle px-2 py-0.5 text-xs ${tone.className}`}>
      {tone.text}
    </span>
  );
}

// consistency-allow: destructive-pattern - Personal-Entfernen ist eine lokale Formularzeile; Persistenz läuft über den nicht-destruktiven Speichern-Flow.
export interface SicherungspostenDrawerProps {
  readonly einsatzId: string;
  readonly mode: 'create' | 'edit';
  readonly open: boolean;
  readonly onClose: () => void;
  readonly posten?: SicherungspostenDto;
}

function buildDefaults(posten?: SicherungspostenDto): SicherungspostenFormValues {
  if (!posten) {
    return {
      bezeichnung: '',
      standort: { kind: 'address', text: '' },
      personal: [],
      einheitId: undefined,
      zustaendigkeitsbereich: undefined,
      abloesezeiten: undefined,
    };
  }
  // Generierter DTO: `einheitId`, `zustaendigkeitsbereich`, `abloesezeiten`
  // sind als `object | null` typisiert (OpenAPI-Generator-Quirk für nullable
  // Strings). Wir lesen defensiv über `as string | null | undefined`.
  const einheitId = (posten.einheitId as string | null | undefined) ?? undefined;
  const zustaendigkeitsbereich = (posten.zustaendigkeitsbereich as string | null | undefined) ?? undefined;
  const abloesezeiten = (posten.abloesezeiten as string | null | undefined) ?? undefined;

  return {
    bezeichnung: posten.bezeichnung,
    standort: posten.standort as Standort,
    personal: (posten.personal as PersonalEntry[]) ?? [],
    einheitId,
    zustaendigkeitsbereich,
    abloesezeiten,
  };
}

function normalizePersonalForSubmit(personal: PersonalEntry[]): PersonalEntry[] {
  // Trim, aber **nicht** silent-droppen: leere Einträge gehen weiter durch und
  // werden vom Form-Schema (zod `.min(1)` auf einsatzPersonId/name) als
  // Validierungsfehler erkannt — der User sieht eine inline-Meldung statt
  // unbemerkt verlorenem Eintrag.
  return personal.map((entry) => {
    if (entry.kind === 'einsatzPerson') {
      return { kind: 'einsatzPerson' as const, einsatzPersonId: entry.einsatzPersonId.trim() };
    }
    const rolle = entry.rolle?.trim();
    return { kind: 'freitext' as const, name: entry.name.trim(), rolle: rolle && rolle.length > 0 ? rolle : undefined };
  });
}

export function SicherungspostenDrawer({ einsatzId, mode, open, onClose, posten }: SicherungspostenDrawerProps) {
  const isEditMode = mode === 'edit';
  const createMutation = useCreateSicherungsposten(einsatzId);
  const updateMutation = useUpdateSicherungsposten(einsatzId);
  const queryClient = useQueryClient();

  const [conflictError, setConflictError] = useState<SicherungspostenConflictError | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const defaults = useMemo(() => buildDefaults(posten), [posten]);

  // Story 4.2: zentrale Version-Ref als Single-Source-of-Truth für `expectedVersion`.
  // Footer-Submit-Success und Auto-Save-`onSaved` aktualisieren beide diese Ref,
  // damit parallele Mutationen sich nicht gegenseitig 409-en (siehe AC6).
  const latestVersionRef = useRef<number>(posten?.version ?? 1);

  // Story 4.2: Initial-Wert für `hasChanges`-Vergleich. Wird im open-effect
  // re-initialisiert und im Auto-Save-`onSaved` auf den persistierten Wert
  // gesetzt — verhindert No-Op-Re-Saves und Phantom-`dirty`-Status.
  const initialAbloesezeitenRef = useRef<string | null>(normalizeAbloesezeiten((posten?.abloesezeiten as string | null | undefined) ?? null));

  // Forward-Ref für Hook-Order-Stability bei `flushNow`-Aufrufen aus async
  // Pfaden (Drawer-Close, Footer-Submit) — Review-Patches D2/D3/D4.
  const autoSaveRef = useRef<UseAutoSaveReturn<string | null, SicherungspostenDto> | null>(null);

  const form = useForm<SicherungspostenFormValues>({
    defaultValues: defaults,
    onSubmit: async ({ value }) => {
      if (conflictError) return;
      const parsed = sicherungspostenFormSchema.safeParse({
        ...value,
        personal: normalizePersonalForSubmit(value.personal),
      });
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        setInlineError(firstIssue?.message ?? 'Eingaben sind ungültig.');
        return;
      }
      setInlineError(null);

      try {
        if (isEditMode && posten) {
          // Footer-Submit serialisiert vor Auto-Save-Pfad: pending Auto-Save
          // wird zuerst geflusht, damit `latestVersionRef` aktuell ist.
          await autoSaveRef.current?.flushNow(normalizeAbloesezeiten(value.abloesezeiten ?? null));

          // Edit-Mode-Body lässt `abloesezeiten` weg — Auto-Save besitzt das
          // Feld exklusiv; das vermeidet Race-Conditions zwischen den beiden
          // Pfaden (AC5/AC6 + Review-Patch D4).
          const body: UpdateSicherungspostenDto = {
            expectedVersion: latestVersionRef.current,
            bezeichnung: parsed.data.bezeichnung,
            standort: parsed.data.standort,
            personal: parsed.data.personal,
            einheitId: parsed.data.einheitId,
            zustaendigkeitsbereich: parsed.data.zustaendigkeitsbereich,
          };
          const result = await updateMutation.mutateAsync({ postenId: posten.id, body });
          latestVersionRef.current = result.version;
        } else {
          const body: CreateSicherungspostenDto = {
            bezeichnung: parsed.data.bezeichnung,
            standort: parsed.data.standort,
            personal: parsed.data.personal,
            einheitId: parsed.data.einheitId,
            zustaendigkeitsbereich: parsed.data.zustaendigkeitsbereich,
            abloesezeiten: parsed.data.abloesezeiten,
          };
          await createMutation.mutateAsync(body);
        }
        onClose();
      } catch (error) {
        if (error instanceof SicherungspostenConflictError) {
          setConflictError(error);
          return;
        }
        setInlineError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
      }
    },
  });

  // Story 4.2: Auto-Save-Hook für `abloesezeiten` (Edit-Mode, online-only).
  const autoSave = useAutoSave<string | null, SicherungspostenDto>({
    entityId: posten?.id ?? '',
    entityType: 'sicherungsposten.abloesezeiten',
    debounceMs: 2000,
    enabled: isEditMode && !conflictError && !!posten,
    saveFn: async (draft) => {
      if (!posten) throw new Error('saveFn ohne posten aufgerufen');
      const normalized = normalizeAbloesezeiten(draft);
      const dto = await updateMutation.mutateAsync({
        postenId: posten.id,
        body: { expectedVersion: latestVersionRef.current, abloesezeiten: normalized },
      });
      latestVersionRef.current = dto.version;
      return dto;
    },
    isValid: (draft) => (draft?.length ?? 0) <= 2000,
    hasChanges: (draft) => normalizeAbloesezeiten(draft) !== initialAbloesezeitenRef.current,
    isConflictError: (e) => e instanceof SicherungspostenConflictError,
    onSaved: (dto) => {
      initialAbloesezeitenRef.current = normalizeAbloesezeiten((dto.abloesezeiten as string | null | undefined) ?? null);
      void queryClient.invalidateQueries({ queryKey: sicherungspostenQueryKeys.byEinsatz(einsatzId) });
    },
    onConflict: (err) => {
      setConflictError(err as SicherungspostenConflictError);
    },
  });
  autoSaveRef.current = autoSave;

  // Reset form/state, sobald sich der Posten oder der Open-Zustand ändert.
  // `form` und `buildDefaults` sind bewusst **nicht** in den Deps:
  // - `form` ist eine stabile TanStack-Form-Instanz; das Aufnehmen würde den
  //   Effekt bei jedem Render neu feuern und die Form bei jedem Render zurücksetzen.
  // - `buildDefaults` ist eine reine Funktion (keine Closure-Captures außerhalb
  //   der Args), Identität ist hier irrelevant.
  // Posten-Identität wird über `id` + `version` abgedeckt — beide Felder sind
  // monotone Marker (jede Mutation inkrementiert `version`).
  useEffect(() => {
    if (open) {
      // Skip Reset bei pending Auto-Save-Draft — sonst überschreibt
      // `form.reset` den Live-Draft (Review-Patch D3).
      if (autoSaveRef.current?.hasPendingChanges) return;
      form.reset(buildDefaults(posten));
      const nextInitial = normalizeAbloesezeiten((posten?.abloesezeiten as string | null | undefined) ?? null);
      initialAbloesezeitenRef.current = nextInitial;
      latestVersionRef.current = posten?.version ?? 1;
      autoSaveRef.current?.resetSynced(nextInitial);
      setConflictError(null);
      setInlineError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, posten?.id, posten?.version]);

  const handleClose = async () => {
    // Story 4.2: pending Auto-Save vor Close flushen (Promise.race mit
    // 3-s-Timeout, falls Network langsam ist — Drawer schließt trotzdem).
    if (isEditMode && autoSaveRef.current) {
      const draft = normalizeAbloesezeiten((form.getFieldValue('abloesezeiten') as string | undefined) ?? null);
      try {
        await Promise.race([autoSaveRef.current.flushNow(draft), new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000))]);
      } catch {
        // Flush-Fehler sind im Status-Badge sichtbar; Close blockiert nicht.
      }
    }
    setConflictError(null);
    setInlineError(null);
    onClose();
  };

  const handleConflictReload = () => {
    void queryClient.invalidateQueries({ queryKey: sicherungspostenQueryKeys.byEinsatz(einsatzId) });
    setConflictError(null);
    setInlineError(null);
    onClose();
  };

  const isSubmitDisabled = createMutation.isPending || updateMutation.isPending || conflictError !== null;

  return (
    <Dialog.SlideIn
      isOpen={open}
      onClose={() => {
        void handleClose();
      }}
      title={isEditMode ? 'Sicherungsposten bearbeiten' : 'Neuer Sicherungsposten'}
      description={isEditMode ? 'Bezeichnung, Standort, Personal oder Zuständigkeit anpassen.' : 'Posten für den aktuellen Einsatz anlegen.'}
      size="lg"
      position="right"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            intent="secondary"
            appearance="ghost"
            type="button"
            onClick={() => {
              void handleClose();
            }}
          >
            Abbrechen
          </Button>
          <Button
            intent="primary"
            type="submit"
            form="sicherungsposten-form"
            disabled={isSubmitDisabled}
            loading={createMutation.isPending || updateMutation.isPending}
            data-testid="sicherungsposten-drawer-submit"
          >
            {isEditMode ? 'Speichern' : 'Anlegen'}
          </Button>
        </div>
      }
    >
      <form
        id="sicherungsposten-form"
        data-testid="sicherungsposten-drawer"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
        className="flex flex-col gap-5"
      >
        <section className="space-y-3">
          <form.Field name="bezeichnung">
            {(field) => (
              <label htmlFor="sicherungsposten-bezeichnung" className="block text-sm">
                <span className="block font-medium text-text-primary">
                  Bezeichnung <span className="text-status-danger-text">*</span>
                </span>
                <Input
                  id="sicherungsposten-bezeichnung"
                  type="text"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  maxLength={200}
                  data-testid="sicherungsposten-bezeichnung"
                  className="mt-1"
                />
              </label>
            )}
          </form.Field>
        </section>

        <section aria-labelledby="sicherungsposten-standort-heading" className="space-y-3">
          <h2 id="sicherungsposten-standort-heading" className="text-sm font-semibold text-text-primary">
            Standort
          </h2>
          <form.Field name="standort">
            {(field) => {
              const kind = field.state.value.kind;
              return (
                <div className="space-y-3">
                  <fieldset role="radiogroup" aria-labelledby="sicherungsposten-standort-heading" className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2 text-text-primary">
                      <input
                        type="radio"
                        name="sicherungsposten-standort-kind"
                        value="address"
                        checked={kind === 'address'}
                        onChange={() => field.handleChange({ kind: 'address', text: '' })}
                        data-testid="sicherungsposten-standort-toggle-address"
                      />
                      <span>Adresse / Freitext</span>
                    </label>
                    <label className="flex items-center gap-2 text-text-primary">
                      <input
                        type="radio"
                        name="sicherungsposten-standort-kind"
                        value="coordinate"
                        checked={kind === 'coordinate'}
                        // NaN als Initialwert: erzwingt User-Eingabe, sonst rejected `standortSchema.coordinate`
                        // (zod `.finite()`) den Submit. Verhindert versehentliche Null-Insel-Posten (0,0).
                        onChange={() => field.handleChange({ kind: 'coordinate', longitude: Number.NaN, latitude: Number.NaN })}
                        data-testid="sicherungsposten-standort-toggle-coordinate"
                      />
                      <span>Koordinaten (WGS84)</span>
                    </label>
                  </fieldset>

                  {kind === 'address' ? (
                    <label htmlFor="sicherungsposten-standort-text" className="block text-sm">
                      <span className="block font-medium text-text-primary">Beschreibung</span>
                      <Textarea
                        id="sicherungsposten-standort-text"
                        value={field.state.value.kind === 'address' ? field.state.value.text : ''}
                        onChange={(event) => field.handleChange({ kind: 'address', text: event.target.value })}
                        maxLength={500}
                        className="mt-1"
                        data-testid="sicherungsposten-standort-text"
                      />
                    </label>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label htmlFor="sicherungsposten-standort-latitude" className="block text-sm">
                        <span className="block font-medium text-text-primary">
                          Latitude <span className="text-status-danger-text">*</span>
                        </span>
                        <Input
                          id="sicherungsposten-standort-latitude"
                          type="number"
                          step="0.00001"
                          required
                          // Empty-Input → NaN, damit das Zod-Schema (`.finite()`) den Submit ablehnt
                          // und der User keinen Posten auf Null-Insel (0,0) speichert.
                          value={field.state.value.kind === 'coordinate' && Number.isFinite(field.state.value.latitude) ? String(field.state.value.latitude) : ''}
                          onChange={(event) => {
                            const raw = event.target.value;
                            const next = raw === '' ? Number.NaN : Number(raw);
                            const current = field.state.value.kind === 'coordinate' ? field.state.value : { kind: 'coordinate' as const, longitude: Number.NaN, latitude: Number.NaN };
                            field.handleChange({ ...current, latitude: next });
                          }}
                          className="mt-1"
                          data-testid="sicherungsposten-standort-latitude"
                        />
                      </label>
                      <label htmlFor="sicherungsposten-standort-longitude" className="block text-sm">
                        <span className="block font-medium text-text-primary">
                          Longitude <span className="text-status-danger-text">*</span>
                        </span>
                        <Input
                          id="sicherungsposten-standort-longitude"
                          type="number"
                          step="0.00001"
                          required
                          value={field.state.value.kind === 'coordinate' && Number.isFinite(field.state.value.longitude) ? String(field.state.value.longitude) : ''}
                          onChange={(event) => {
                            const raw = event.target.value;
                            const next = raw === '' ? Number.NaN : Number(raw);
                            const current = field.state.value.kind === 'coordinate' ? field.state.value : { kind: 'coordinate' as const, longitude: Number.NaN, latitude: Number.NaN };
                            field.handleChange({ ...current, longitude: next });
                          }}
                          className="mt-1"
                          data-testid="sicherungsposten-standort-longitude"
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            }}
          </form.Field>
        </section>

        <section aria-labelledby="sicherungsposten-personal-heading" className="space-y-3">
          <h2 id="sicherungsposten-personal-heading" className="text-sm font-semibold text-text-primary">
            Personal
          </h2>
          <form.Field name="personal" mode="array">
            {(field) => (
              <div className="space-y-2" data-testid="sicherungsposten-personal-list">
                {field.state.value.length === 0 ? <p className="text-xs text-text-muted">Noch keine Personal-Einträge — über „Eintrag hinzufügen" ergänzen.</p> : null}
                {field.state.value.map((entry, index) => (
                  <div key={`personal-${index}`} className="rounded-control border border-border-subtle bg-surface-panel-elevated p-3" data-testid={`sicherungsposten-personal-row-${index}`}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <fieldset className="flex gap-3 text-sm" role="radiogroup">
                        <label className="flex items-center gap-1 text-text-primary">
                          <input
                            type="radio"
                            name={`personal-kind-${index}`}
                            value="einsatzPerson"
                            checked={entry.kind === 'einsatzPerson'}
                            onChange={() => {
                              const next = [...field.state.value];
                              next[index] = { kind: 'einsatzPerson', einsatzPersonId: '' };
                              field.handleChange(next);
                            }}
                            data-testid={`sicherungsposten-personal-toggle-user-${index}`}
                          />
                          <span>Person</span>
                        </label>
                        <label className="flex items-center gap-1 text-text-primary">
                          <input
                            type="radio"
                            name={`personal-kind-${index}`}
                            value="freitext"
                            checked={entry.kind === 'freitext'}
                            onChange={() => {
                              const next = [...field.state.value];
                              next[index] = { kind: 'freitext', name: '' };
                              field.handleChange(next);
                            }}
                            data-testid={`sicherungsposten-personal-toggle-freitext-${index}`}
                          />
                          <span>Freitext</span>
                        </label>
                      </fieldset>
                      <Button
                        intent="danger"
                        appearance="ghost"
                        size="sm"
                        type="button"
                        onClick={() => {
                          const next = field.state.value.filter((_, idx) => idx !== index);
                          field.handleChange(next);
                        }}
                        data-testid={`sicherungsposten-personal-remove-${index}`}
                      >
                        Entfernen
                      </Button>
                    </div>
                    {entry.kind === 'einsatzPerson' ? (
                      <PersonCombobox
                        einsatzId={einsatzId}
                        value={entry.einsatzPersonId}
                        onChange={(einsatzPersonId) => {
                          const next = [...field.state.value];
                          next[index] = { kind: 'einsatzPerson', einsatzPersonId };
                          field.handleChange(next);
                        }}
                        label="Person"
                        placeholder="Person auswählen…"
                        testId={`sicherungsposten-personal-userid-${index}`}
                      />
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          type="text"
                          value={entry.name}
                          onChange={(event) => {
                            const next = [...field.state.value];
                            next[index] = { ...entry, kind: 'freitext', name: event.target.value };
                            field.handleChange(next);
                          }}
                          maxLength={200}
                          placeholder="Name"
                          data-testid={`sicherungsposten-personal-name-${index}`}
                        />
                        <Input
                          type="text"
                          value={entry.rolle ?? ''}
                          onChange={(event) => {
                            const next = [...field.state.value];
                            next[index] = { ...entry, kind: 'freitext', name: entry.name, rolle: event.target.value };
                            field.handleChange(next);
                          }}
                          maxLength={120}
                          placeholder="Rolle (optional)"
                          data-testid={`sicherungsposten-personal-rolle-${index}`}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <Button
                  intent="secondary"
                  appearance="ghost"
                  size="sm"
                  type="button"
                  onClick={() => field.handleChange([...field.state.value, { kind: 'einsatzPerson', einsatzPersonId: '' }])}
                  data-testid="sicherungsposten-personal-add"
                >
                  + Eintrag hinzufügen
                </Button>
              </div>
            )}
          </form.Field>
        </section>

        <section className="space-y-2">
          <form.Field name="zustaendigkeitsbereich">
            {(field) => (
              <label htmlFor="sicherungsposten-zustaendigkeitsbereich" className="block text-sm">
                <span className="block font-medium text-text-primary">Zuständigkeitsbereich</span>
                <Textarea
                  id="sicherungsposten-zustaendigkeitsbereich"
                  value={field.state.value ?? ''}
                  onChange={(event) => field.handleChange(event.target.value || undefined)}
                  maxLength={4000}
                  className="mt-1"
                  data-testid="sicherungsposten-zustaendigkeitsbereich"
                />
              </label>
            )}
          </form.Field>
        </section>

        <section aria-labelledby="sicherungsposten-abloesezeiten-heading" className="space-y-2">
          <form.Field name="abloesezeiten">
            {(field) => {
              const currentValue = (field.state.value as string | undefined) ?? '';
              const length = currentValue.length;
              const counterClassName = length > 2000 ? 'text-status-danger-text' : 'text-text-muted';
              const badgeStatus: BadgeStatus = conflictError ? 'conflict' : length > 2000 ? 'dirty' : autoSave.status;
              return (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <h2 id="sicherungsposten-abloesezeiten-heading" className="text-sm font-semibold text-text-primary">
                      Ablösezeiten
                    </h2>
                    {isEditMode ? <AutoSaveBadge status={badgeStatus} /> : null}
                  </div>
                  <p className="text-xs text-text-muted">Freitext, z. B. „08:00 – 12:00 Trupp 1, 12:00 – 16:00 Trupp 2". Schichtplanung als strukturierte Eingabe folgt in Phase 2.</p>
                  <div className="space-y-1">
                    <Textarea
                      id="sicherungsposten-abloesezeiten"
                      data-testid="sicherungsposten-abloesezeiten"
                      rows={4}
                      maxLength={2000}
                      value={currentValue}
                      onChange={(event) => {
                        const next = event.target.value;
                        field.handleChange(next.length === 0 ? undefined : next);
                        if (isEditMode) {
                          autoSaveRef.current?.scheduleSave(next.length === 0 ? null : next);
                        }
                      }}
                      className="mt-1"
                    />
                    <span data-testid="sicherungsposten-abloesezeiten-counter" aria-live="polite" className={`block text-right text-xs ${counterClassName}`}>
                      {length} / 2000 Zeichen
                    </span>
                  </div>
                </>
              );
            }}
          </form.Field>
        </section>

        {conflictError ? (
          <div
            role="alert"
            data-testid="sicherungsposten-drawer-conflict-banner"
            className="space-y-2 rounded-control border border-status-warning-border bg-status-warning-surface px-3 py-2 text-sm text-status-warning-text"
          >
            <p>
              {conflictError.currentVersion !== undefined
                ? `Posten wurde zwischenzeitlich aktualisiert (Server-Version: ${conflictError.currentVersion}). Bitte neu laden.`
                : 'Posten wurde zwischenzeitlich aktualisiert. Bitte neu laden.'}
            </p>
            <Button intent="secondary" appearance="ghost" size="sm" type="button" onClick={handleConflictReload} data-testid="sicherungsposten-drawer-conflict-reload">
              Neu laden
            </Button>
          </div>
        ) : null}

        {inlineError ? (
          <p
            role="alert"
            data-testid="sicherungsposten-drawer-inline-error"
            className="rounded-control border border-status-danger-border bg-status-danger-surface px-3 py-2 text-sm text-status-danger-text"
          >
            {inlineError}
          </p>
        ) : null}
      </form>
    </Dialog.SlideIn>
  );
}
