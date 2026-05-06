/**
 * SicherungspostenDrawer — Drawer-Organism zum Anlegen und Bearbeiten eines
 * Sicherungspostens (Story 4.1, T6).
 *
 * Felder:
 * - **Bezeichnung** (Pflicht, 1–200 Zeichen).
 * - **Standort** als discriminated Union: `coordinate` (longitude/latitude
 *   + optional `addressHint`) ODER `address` (Freitext). RadioGroup-Toggle.
 * - **Personal**: Liste discriminated Unions (`user` mit userId ODER
 *   `freitext` mit name + optional rolle). Hinzufügen/Entfernen via
 *   Buttons; Toggle pro Eintrag zwischen User-ID und Freitext.
 * - **Zuständigkeitsbereich** (optional, Textarea ≤ 4000 Zeichen).
 * - **Ablösezeiten**: Freitext-Editor (≤ 2000 Zeichen) mit debounciertem
 *   Auto-Save (2 s) im Edit-Mode (Story 4.2). Im Create-Mode wird der Wert
 *   regulär mit dem Footer-Submit gesendet.
 *
 * 409-Konflikt-Pfad: typsierter {@link SicherungspostenConflictError} →
 * Inline-Banner mit `currentVersion` und „Neu laden"-CTA. Submit und
 * Auto-Save bleiben blockiert, bis der User „Neu laden" wählt oder den
 * Drawer schließt.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import type { CreateSicherungspostenDto, SicherungspostenDto, UpdateSicherungspostenDto } from '@bluelight-hub/shared/client';
import { Button } from '@/shared/ui/atoms/button.atom';
import { Input } from '@/shared/ui/atoms/input.atom';
import { Textarea } from '@/shared/ui/atoms/textarea.atom';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { SicherungspostenConflictError, sicherungspostenQueryKeys, useCreateSicherungsposten, useUpdateSicherungsposten } from '../../api/use-sicherungsposten';
import { useAutoSave, type AutoSaveStatus, type UseAutoSaveReturn } from '../../hooks/useAutoSave';
import { sicherungspostenFormSchema, type SicherungspostenFormValues, type Standort, type PersonalEntry } from '../../schemas/sicherungsposten.schema';

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
  // werden vom Form-Schema (zod `.min(1)` auf userId/name) als Validierungsfehler
  // erkannt — der User sieht eine inline-Meldung statt unbemerkt verlorenem
  // Eintrag.
  return personal.map((entry) => {
    if (entry.kind === 'user') {
      return { kind: 'user' as const, userId: entry.userId.trim() };
    }
    const rolle = entry.rolle?.trim();
    return { kind: 'freitext' as const, name: entry.name.trim(), rolle: rolle && rolle.length > 0 ? rolle : undefined };
  });
}

/**
 * Normalisiert den Ablösezeiten-Freitext: trimmt Whitespace und mappt
 * leere Strings auf `null`. Story 4.2 — wird sowohl im `hasChanges`-Diff
 * als auch im `saveFn`-Body verwendet, damit nur bedeutungsvolle
 * Änderungen einen PATCH auslösen UND der persistierte Wert getrimmt
 * ist (Backend-`@Length(0,2000)` validiert ohne Trim).
 */
function normalizeAbloesezeiten(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Inline-Statusbadge für den Auto-Save-Pfad der Ablösezeiten (Story 4.2).
 * Rendert einen kleinen farbigen Pill-Badge neben der Sektions-Überschrift.
 *
 * Bewusst NICHT gerendert werden `local-saved` und `offline-queued` — beide
 * Stati können in 4.2 nicht auftreten, da kein `onLocalSave`/`onOfflineSave`
 * konfiguriert ist (Online-Only-Pivot).
 */
function AutoSaveBadge({ status }: { status: AutoSaveStatus }) {
  const config: Partial<Record<AutoSaveStatus, { text: string; cls: string }>> = {
    dirty: { text: 'Nicht gespeichert', cls: 'bg-status-warning-surface text-status-warning-text' },
    debouncing: { text: 'Wird gespeichert…', cls: 'bg-surface-panel-elevated text-text-primary' },
    syncing: { text: 'Wird synchronisiert…', cls: 'bg-surface-panel-elevated text-text-primary' },
    synced: { text: 'Gespeichert', cls: 'bg-status-success-surface text-status-success-text' },
    conflict: { text: 'Konflikt — bitte neu laden', cls: 'bg-status-warning-surface text-status-warning-text' },
    error: { text: 'Fehler — Eingabe bleibt erhalten', cls: 'bg-status-danger-surface text-status-danger-text' },
  };
  const entry = config[status];
  if (!entry) return null;
  return (
    <span data-testid="sicherungsposten-abloesezeiten-autosave-status" className={`rounded-full px-2 py-0.5 text-xs font-medium ${entry.cls}`}>
      {entry.text}
    </span>
  );
}

export function SicherungspostenDrawer({ einsatzId, mode, open, onClose, posten }: SicherungspostenDrawerProps) {
  const isEditMode = mode === 'edit';
  const createMutation = useCreateSicherungsposten(einsatzId);
  const updateMutation = useUpdateSicherungsposten(einsatzId);
  const queryClient = useQueryClient();

  const [conflictError, setConflictError] = useState<SicherungspostenConflictError | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const defaults = useMemo(() => buildDefaults(posten), [posten]);

  // Single-Source-of-Truth für die zuletzt bekannte Server-Version (Story 4.2,
  // AC6). Sowohl der Footer-Submit (Edit-Mode) als auch der Auto-Save-Pfad der
  // Ablösezeiten lesen/schreiben in DIESELBE Ref. So können Auto-Save-PATCHes
  // und Footer-Submits beliebig verschachtelt ablaufen, ohne dass eine der
  // beiden Routen mit einer veralteten `expectedVersion` einen falschen
  // 409-Konflikt provoziert.
  const latestVersionRef = useRef<number>(posten?.version ?? 1);
  // Initialer Ablösezeiten-Wert beim Öffnen — Basis für den `hasChanges`-Diff
  // im Auto-Save-Hook. Wird nach jedem erfolgreichen Save aktualisiert.
  const initialAbloesezeitenRef = useRef<string | null>((posten?.abloesezeiten as string | null | undefined) ?? null);
  // Forward-Ref auf den Auto-Save-Hook: der `useEffect` für `open`/`posten`
  // muss vor dem `useAutoSave`-Aufruf stehen (Hook-Order), liest aber den
  // Hook-State (Pending-Draft + `resetSynced`). Wird nach jedem Render auf
  // den frischen Hook gesetzt; `useAutoSave` selbst gibt eine stabile
  // Referenz mit Refs zurück, sodass die Stale-Lese unkritisch ist.
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
          // Story 4.2 / AC6: `expectedVersion` kommt aus der gemeinsamen
          // `latestVersionRef`, NICHT aus `posten.version` — sonst würde ein
          // zwischenzeitlich ausgeführter Auto-Save-PATCH (eigene Version
          // bereits inkrementiert) hier einen falschen 409 erzeugen.
          // `abloesezeiten` wird bewusst NICHT mitgesendet: Im Edit-Mode
          // besitzt der Auto-Save-Pfad das Feld exklusiv und ist die einzige
          // Quelle für PATCHes auf dieses Feld (AC4).
          // Vor dem Footer-PATCH zuerst einen ggf. ausstehenden Auto-Save
          // finalisieren — sonst lesen beide Pfade dieselbe `latestVersionRef`
          // und der zweite Call kassiert einen unnötigen 409.
          if (autoSaveRef.current?.hasPendingChanges) {
            await autoSaveRef.current.flushNow();
          }
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
      // Schutz vor Daten-Verlust: Wenn der Auto-Save-Hook noch ungesaved'te
      // Eingaben hält und das Effect durch eine externe Posten-Version-Änderung
      // ausgelöst wurde (z. B. WS-Invalidate eines anderen Tabs während des
      // Tippens), würde `form.reset` den User-Draft überschreiben. In dem Fall
      // halten wir den Draft und überspringen das Reset; der Auto-Save-Pfad
      // schreibt den Draft bei nächstem Tick auf den frischen Server-Stand,
      // ggf. mit 409-Konflikt-Banner als Recovery.
      if (autoSaveRef.current?.hasPendingChanges) return;
      form.reset(buildDefaults(posten));
      setConflictError(null);
      setInlineError(null);
      // Refs auf den frischen Posten-Snapshot zurücksetzen (Story 4.2):
      // beim Öffnen mit anderem Posten oder neuer Version müssen sowohl die
      // gemeinsame Versions-Ref als auch die Diff-Baseline für `hasChanges`
      // re-initialisiert werden.
      latestVersionRef.current = posten?.version ?? 1;
      initialAbloesezeitenRef.current = (posten?.abloesezeiten as string | null | undefined) ?? null;
      // Auto-Save-Hook-Internal-State zurücksetzen — sonst persistiert
      // `conflictPausedRef` einer vorigen Drawer-Session, und der Hook
      // bleibt nach Reopen permanent paused.
      autoSaveRef.current?.resetSynced(initialAbloesezeitenRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, posten?.id, posten?.version]);

  // Auto-Save-Verdrahtung für die Ablösezeiten (Story 4.2, AC4–AC8). Nur
  // im Edit-Mode aktiv (`enabled`). Während eines aktiven 409-Konflikts wird
  // der Hook deaktiviert, damit nicht weiter gegen die alte Server-Version
  // geschrieben wird — der User muss zunächst „Neu laden" wählen.
  const autoSave = useAutoSave<string | null, SicherungspostenDto>({
    entityId: posten?.id ?? '',
    entityType: 'sicherungsposten.abloesezeiten',
    debounceMs: 2000,
    enabled: isEditMode && !conflictError && !!posten,
    saveFn: async (draft) => {
      if (!posten) {
        throw new Error('saveFn: posten missing');
      }
      const dto = await updateMutation.mutateAsync({
        postenId: posten.id,
        body: { expectedVersion: latestVersionRef.current, abloesezeiten: normalizeAbloesezeiten(draft) },
      });
      latestVersionRef.current = dto.version;
      return dto;
    },
    isValid: (draft) => (draft?.length ?? 0) <= 2000,
    hasChanges: (draft) => normalizeAbloesezeiten(draft) !== normalizeAbloesezeiten(initialAbloesezeitenRef.current),
    isConflictError: (error) => error instanceof SicherungspostenConflictError,
    onSaved: (dto) => {
      initialAbloesezeitenRef.current = (dto.abloesezeiten as string | null | undefined) ?? null;
      void queryClient.invalidateQueries({ queryKey: sicherungspostenQueryKeys.byEinsatz(einsatzId) });
    },
    onConflict: (error) => {
      setConflictError(error as SicherungspostenConflictError);
    },
  });
  // Forward-Ref aktualisieren, damit der zuvor deklarierte Open-Effect den
  // aktuellen Hook-State sehen kann.
  autoSaveRef.current = autoSave;

  // `handleClose` MUSS asynchron sein (Story 4.2, AC5), damit eine noch
  // ausstehende Auto-Save-Schreibung vor dem Schließen finalisiert wird.
  // 3-Sekunden-Race verhindert, dass der Drawer hängen bleibt, falls der
  // Server nicht antwortet — die Eingabe geht dabei nicht verloren, weil
  // der Auto-Save-Hook im Hintergrund weiterläuft (siehe `useAutoSave`).
  const handleClose = useCallback(async () => {
    if (isEditMode && autoSave.hasPendingChanges && posten) {
      const currentValue = form.getFieldValue('abloesezeiten') ?? null;
      const flushPromise = autoSave.flushNow(normalizeAbloesezeiten(currentValue as string | null | undefined));
      const timeoutPromise = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000));
      await Promise.race([flushPromise, timeoutPromise]);
    }
    setConflictError(null);
    setInlineError(null);
    onClose();
  }, [autoSave, isEditMode, posten, form, onClose]);

  const isSubmitDisabled = createMutation.isPending || updateMutation.isPending || conflictError !== null;

  return (
    <Dialog.SlideIn
      isOpen={open}
      onClose={() => void handleClose()}
      title={isEditMode ? 'Sicherungsposten bearbeiten' : 'Neuer Sicherungsposten'}
      description={isEditMode ? 'Bezeichnung, Standort, Personal oder Zuständigkeit anpassen.' : 'Posten für den aktuellen Einsatz anlegen.'}
      size="lg"
      position="right"
    >
      <form
        data-testid="sicherungsposten-drawer"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
        className="flex h-full flex-col gap-5"
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
                            value="user"
                            checked={entry.kind === 'user'}
                            onChange={() => {
                              const next = [...field.state.value];
                              next[index] = { kind: 'user', userId: '' };
                              field.handleChange(next);
                            }}
                            data-testid={`sicherungsposten-personal-toggle-user-${index}`}
                          />
                          <span>User-ID</span>
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
                    {entry.kind === 'user' ? (
                      <Input
                        type="text"
                        value={entry.userId}
                        onChange={(event) => {
                          const next = [...field.state.value];
                          next[index] = { kind: 'user', userId: event.target.value };
                          field.handleChange(next);
                        }}
                        maxLength={40}
                        placeholder="User-ID (CUID)"
                        data-testid={`sicherungsposten-personal-userid-${index}`}
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
                  onClick={() => field.handleChange([...field.state.value, { kind: 'freitext', name: '' }])}
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
          <div className="flex items-start justify-between gap-2">
            <h2 id="sicherungsposten-abloesezeiten-heading" className="text-sm font-semibold text-text-primary">
              Ablösezeiten
            </h2>
            {/* `conflictError` wird auch über den Footer-Submit-Pfad gesetzt
                (nicht nur über `useAutoSave.onConflict`). Der Hook-Status
                allein reicht deshalb nicht — wir überlagern, damit das Badge
                in beiden Konflikt-Quellen „Konflikt — bitte neu laden" zeigt. */}
            {isEditMode ? <AutoSaveBadge status={conflictError ? 'conflict' : autoSave.status} /> : null}
          </div>
          <p className="text-xs text-text-muted">Freitext, z. B. „08:00 – 12:00 Trupp 1, 12:00 – 16:00 Trupp 2". Schichtplanung als strukturierte Eingabe folgt in Phase 2.</p>
          <form.Field name="abloesezeiten">
            {(field) => {
              const value = field.state.value ?? '';
              const length = value.length;
              const overLimit = length > 2000;
              return (
                <>
                  <Textarea
                    id="sicherungsposten-abloesezeiten"
                    data-testid="sicherungsposten-abloesezeiten"
                    value={value}
                    onChange={(event) => {
                      const next = event.target.value;
                      field.handleChange(next || undefined);
                      if (isEditMode && posten) {
                        autoSave.scheduleSave(normalizeAbloesezeiten(next));
                      }
                    }}
                    maxLength={2000}
                    rows={4}
                    className="mt-1"
                    aria-describedby="sicherungsposten-abloesezeiten-counter"
                  />
                  <span
                    id="sicherungsposten-abloesezeiten-counter"
                    data-testid="sicherungsposten-abloesezeiten-counter"
                    aria-live="polite"
                    className={`block text-right text-xs ${overLimit ? 'text-status-danger-text' : 'text-text-muted'}`}
                  >
                    {length} / 2000 Zeichen
                  </span>
                </>
              );
            }}
          </form.Field>
        </section>

        {conflictError ? (
          <div
            role="alert"
            data-testid="sicherungsposten-drawer-conflict-banner"
            className="rounded-control border border-status-warning-border bg-status-warning-surface px-3 py-2 text-sm text-status-warning-text"
          >
            <p>
              {conflictError.currentVersion !== undefined
                ? `Posten wurde zwischenzeitlich aktualisiert (Server-Version: ${conflictError.currentVersion}). Bitte neu laden.`
                : 'Posten wurde zwischenzeitlich aktualisiert. Bitte neu laden.'}
            </p>
            <Button
              intent="primary"
              appearance="ghost"
              size="sm"
              type="button"
              data-testid="sicherungsposten-drawer-conflict-reload"
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: sicherungspostenQueryKeys.byEinsatz(einsatzId) });
                setConflictError(null);
                onClose();
              }}
              className="mt-2"
            >
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

        <footer className="mt-auto flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
          <Button intent="secondary" appearance="ghost" type="button" onClick={() => void handleClose()}>
            Abbrechen
          </Button>
          <Button intent="primary" type="submit" disabled={isSubmitDisabled} loading={createMutation.isPending || updateMutation.isPending} data-testid="sicherungsposten-drawer-submit">
            {isEditMode ? 'Speichern' : 'Anlegen'}
          </Button>
        </footer>
      </form>
    </Dialog.SlideIn>
  );
}
