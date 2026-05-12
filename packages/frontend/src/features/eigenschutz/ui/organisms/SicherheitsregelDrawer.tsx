/**
 * SicherheitsregelDrawer — Drawer-Organism zum Anlegen und Bearbeiten einer
 * Sicherheitsregel (Story 2.6, AC1 + AC5 + AC11).
 *
 * **Feature-Scope:**
 * - Create-Modus (kein `regel`-Prop): Form startet leer, POST → Fanout-IDs zurück.
 * - Edit-Modus (`regel`-Prop gesetzt): Form ist mit Titel, Inhalt und
 *   Zuordnung vorgefüllt; PUT mit `expectedVersion`.
 * - Zuordnung ist exklusiv-oder: „gesamter Einsatz" ODER eine Menge
 *   `EinsatzEinheit`-IDs.
 * - Character-Count-Indikator ab 80 % der Feld-Grenze (64 Zeichen Titel,
 *   1600 Zeichen Inhalt).
 * - 409-Konflikte rendern einen Inline-Banner mit `currentVersion`; 422-
 *   BusinessRule-Fehler werden übersetzt; KEIN Success-Toast (Zero-Toast-
 *   Policy UX-DR21, konsistent zu Story 2.5 AC4).
 *
 * **Form-Architektur:**
 * - `@tanstack/react-form` mit `zodValidator()`-Adapter.
 * - Die Pflichtfeld- und Längen-Invarianten liegen im Shared-Zod-Schema
 *   (`SicherheitsregelCreateSchemaV1`) — wir runnen es im `onSubmit`-Handler
 *   über `safeParse`, analog zum Muster im `GefaehrdungseditorDrawer`.
 * - Die Zuordnungs-Seite bildet UI-seitig einen flachen Zustand
 *   (`einsatzweit`-Bool + `einheitIds[]`) und wird beim Submit in die
 *   diskriminierte Union des Shared-Schemas transformiert.
 */

import { SicherheitsregelCreateSchemaV1, type SicherheitsregelDto } from '@/features/eigenschutz/schemas/sicherheitsregel.schema';
import { SicherheitsregelConflictError, useCreateSicherheitsregel, useSicherheitsregel, useUpdateSicherheitsregel } from '@/features/eigenschutz/api/queries';
import { useEinsatzEinheiten } from '@/features/kraefte/api';
import { EinheitMultiCombobox } from '@/features/kraefte/ui/molecules';
import { Button } from '@/shared/ui/atoms/button.atom';
import { Input } from '@/shared/ui/atoms/input.atom';
import { Textarea } from '@/shared/ui/atoms/textarea.atom';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Business-Limit Titel (Epic 2.6) — DB-Spalte erlaubt 200 Zeichen als Safety-Net. */
const TITEL_MAX_LENGTH = 80;
/** Character-Count-Indikator erscheint ab 80 % Füllung (Story 2.6 AC5). */
const TITEL_COUNT_THRESHOLD = Math.floor(TITEL_MAX_LENGTH * 0.8);
/**
 * Amber-Warnstufe ab 95 % Füllung: Hinweis an den User, dass das Limit
 * gleich erreicht ist (Story 2.6 Code-Review-Patch #24).
 */
const TITEL_COUNT_WARN_THRESHOLD = Math.floor(TITEL_MAX_LENGTH * 0.95);
/** Business-Limit Inhalt (Epic 2.6). */
const INHALT_MAX_LENGTH = 2000;
/** Character-Count-Indikator erscheint ab 80 % Füllung. */
const INHALT_COUNT_THRESHOLD = Math.floor(INHALT_MAX_LENGTH * 0.8);
/** Amber-Warnstufe ab 95 % Füllung (Story 2.6 Code-Review-Patch #24). */
const INHALT_COUNT_WARN_THRESHOLD = Math.floor(INHALT_MAX_LENGTH * 0.95);

export interface SicherheitsregelDrawerProps {
  readonly einsatzId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  /** Optional — Callback mit den IDs der gespeicherten Regeln (Fanout oder Einzel-Row). */
  readonly onSaved?: (regelIds: string[]) => void;
  /**
   * Regel für Edit-Modus. Wenn `undefined` → Create-Modus. `id`, `version` und
   * `einheitId` der Regel werden als `expectedVersion` bzw. Default-Zuordnung
   * verwendet.
   */
  readonly regel?: SicherheitsregelDto;
}

interface FormValues {
  titel: string;
  inhalt: string;
  einsatzweit: boolean;
  einheitIds: string[];
}

/**
 * Übersetzt Backend-Sentinel-Codes in deutschsprachige Inline-Texte.
 * Parallel zu `mapMutationError` im `GefaehrdungseditorDrawer`, aber mit
 * den Sicherheitsregel-spezifischen Sentinels.
 */
async function mapMutationError(error: unknown): Promise<string> {
  if (error instanceof SicherheitsregelConflictError) {
    if (error.currentVersion !== undefined) {
      return `Die Regel wurde zwischenzeitlich in Version ${error.currentVersion} gespeichert. Bitte Drawer schließen und neu laden.`;
    }
    return 'Die Regel wurde zwischenzeitlich von einer anderen Stelle gespeichert. Bitte Drawer schließen und neu laden.';
  }
  if (!error || typeof error !== 'object') {
    return 'Unbekannter Fehler beim Speichern der Sicherheitsregel.';
  }
  const response = (error as { response?: Response }).response;
  const status = response?.status;
  let code: string | undefined;
  let message: string | undefined;
  if (response && typeof response.clone === 'function') {
    try {
      const body = (await response.clone().json()) as { message?: unknown; code?: unknown; context?: { rule?: unknown; resource?: unknown } };
      code = typeof body.code === 'string' ? body.code : typeof body.message === 'string' ? body.message : undefined;
      message = typeof body.message === 'string' ? body.message : undefined;
    } catch {
      // Body nicht parsebar → Status-Fallback.
    }
  }
  if (status === 403) {
    return 'Dieser Einsatz ist für den aktuellen Nutzer nicht freigegeben.';
  }
  if (code?.startsWith('NotFound:Einheit') || message?.includes('NotFound:Einheit')) {
    return 'Eine oder mehrere gewählte Einheiten existieren nicht mehr. Bitte Liste aktualisieren und neu wählen.';
  }
  if (code?.includes('BusinessRule:NoChangesDetected') || message?.includes('NoChangesDetected')) {
    return 'Keine Änderungen erkannt — bitte mindestens ein Feld anpassen, bevor gespeichert wird.';
  }
  if (code?.startsWith('BusinessRule:') || message?.startsWith('BusinessRule:')) {
    return 'Die Regel erfüllt nicht alle Eingabe-Regeln. Bitte Felder prüfen.';
  }
  if (code?.startsWith('ValidationFailed:') || message?.startsWith('ValidationFailed:')) {
    return 'Die Eingaben sind ungültig. Bitte Titel und Inhalt prüfen.';
  }
  if (status === 500) {
    return 'Serverfehler beim Speichern der Regel. Bitte erneut versuchen.';
  }
  return message ?? 'Regel konnte nicht gespeichert werden. Bitte erneut versuchen.';
}

function buildDefaults(regel?: SicherheitsregelDto): FormValues {
  if (!regel) {
    return { titel: '', inhalt: '', einsatzweit: true, einheitIds: [] };
  }
  // `== null` (lockerer Vergleich) fängt `null` UND `undefined`. Sonst
  // landet eine API-Antwort mit fehlendem `einheitId` (undefined) in der
  // „nicht einsatzweit"-Branch, was zu `einheitIds: [undefined]` führt
  // und beim Submit gegen das CUID-Schema fehlschlägt.
  const einsatzweit = regel.einheitId == null;
  return {
    titel: regel.titel,
    inhalt: regel.inhalt,
    einsatzweit,
    einheitIds: einsatzweit ? [] : [regel.einheitId as string],
  };
}

export function SicherheitsregelDrawer({ einsatzId, open, onClose, onSaved, regel }: SicherheitsregelDrawerProps) {
  const isEditMode = regel !== undefined;
  const einheitenQuery = useEinsatzEinheiten(einsatzId);
  const createMutation = useCreateSicherheitsregel(einsatzId);
  const updateMutation = useUpdateSicherheitsregel(einsatzId);

  // Story 2.6 Code-Review-Patch #17: Im Edit-Modus laden wir die Regel
  // beim Öffnen des Drawers frisch nach. `regel` aus dem Listen-Cache
  // zeigt sonst u. U. einen veralteten Stand (z. B. wenn ein anderer User
  // zwischenzeitlich bearbeitet hat) — der Drawer würde gegen
  // `expectedVersion = stale` posten und mit 409 enden.
  const freshRegelQuery = useSicherheitsregel(einsatzId, regel?.id ?? '', { enabled: open && isEditMode });

  const einheiten = useMemo(() => einheitenQuery.data ?? [], [einheitenQuery.data]);
  const einheitenLeer = !einheitenQuery.isPending && einheiten.length === 0;

  const [inlineError, setInlineError] = useState<string | null>(null);
  // Story 2.6 Code-Review-Patch (AC11): Save-Button per Ref ansprechbar,
  // damit Cmd/Ctrl+Enter aus dem Inhalt-Textarea Submit triggern kann.
  // Inhalt-Textarea: Plain Enter bleibt Newline (Multi-Line-Konvention).
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);
  const titelInputRef = useRef<HTMLInputElement | null>(null);
  const inhaltTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  /**
   * Story 2.6 Code-Review-Patch #17: Sobald frische Server-Daten vorliegen,
   * resetten wir das Form auf den frischen Stand — aber nur einmal pro
   * `open`-Zyklus (über `lastAppliedVersionRef`) und nur, wenn der User
   * noch nichts manuell geändert hat. Sonst würde ein langsamer Refetch
   * die User-Eingabe stumm überschreiben.
   */
  const lastAppliedVersionRef = useRef<number | null>(null);
  // Originale Einheit-Auswahl im Edit-Modus, damit Toggle „Einsatzweit" →
  // „Einheiten" die Vorauswahl restoriert (Code-Review-Patch).
  // Bevorzugt wird die frische Server-Antwort, fallback ist die Listen-
  // Cache-Prop.
  const effectiveRegel = freshRegelQuery.data ?? regel;
  const initialEinheitIds = useMemo<string[]>(() => (effectiveRegel?.einheitId ? [effectiveRegel.einheitId] : []), [effectiveRegel?.einheitId]);

  const form = useForm<FormValues>({
    defaultValues: buildDefaults(regel),
    validatorAdapter: zodValidator(),
    onSubmit: async ({ value }) => {
      // Wenn keine Einheiten im Einsatz existieren → einsatzweit erzwingen.
      const einsatzweit = einheitenLeer ? true : value.einsatzweit;
      // Defensiv `undefined`/leere Strings filtern, damit ein verschluckter
      // Combobox-Quirk oder eine stale Vorauswahl nicht über das CUID-Schema
      // mit einer kryptischen Message scheitert.
      const einheitIds = einsatzweit ? [] : value.einheitIds.filter((id): id is string => typeof id === 'string' && id.length > 0);

      // Schema-Parse über die Zod-Diskriminante — wirft valide Fehlerpfade.
      const candidate = einsatzweit ? { titel: value.titel, inhalt: value.inhalt, einsatzweit: true as const } : { titel: value.titel, inhalt: value.inhalt, einsatzweit: false as const, einheitIds };
      const parsed = SicherheitsregelCreateSchemaV1.safeParse(candidate);
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        const pathKey = firstIssue?.path.join('.');
        if (pathKey?.startsWith('titel')) {
          setInlineError(firstIssue?.message ?? 'Titel ist ungültig.');
        } else if (pathKey?.startsWith('inhalt')) {
          setInlineError(firstIssue?.message ?? 'Inhalt ist ungültig.');
        } else if (pathKey?.startsWith('einheitIds')) {
          // Generische Fallback-Message nur, wenn die min(1)-Regel des
          // Array-Schemas selbst gegriffen hat (Pfad ist exakt „einheitIds").
          // Für Element-Fehler (z. B. „einheitIds.0" → ungültige CUID) die
          // echte Zod-Message durchreichen, sonst maskiert die generische
          // Variante echte Validierungsprobleme.
          if (pathKey === 'einheitIds') {
            setInlineError(firstIssue?.message ?? 'Bitte mindestens eine Einheit wählen oder „Gesamter Einsatz" auswählen.');
          } else {
            setInlineError(`Einheit-Auswahl ungültig: ${firstIssue?.message ?? 'unbekannter Fehler'}`);
          }
        } else {
          setInlineError(firstIssue?.message ?? 'Eingaben sind ungültig.');
        }
        return;
      }
      setInlineError(null);

      try {
        if (isEditMode && regel) {
          // OCC-Version: Wenn der Refetch frische Daten geliefert hat,
          // posten wir gegen die frische Version (Code-Review-Patch #17 —
          // verhindert 409-Schleifen, wenn die Listen-Cache-Prop stale war).
          const expectedVersion = freshRegelQuery.data?.version ?? regel.version;
          const result = await updateMutation.mutateAsync({
            id: regel.id,
            expectedVersion,
            ...(einsatzweit
              ? { titel: parsed.data.titel, inhalt: parsed.data.inhalt, einsatzweit: true as const }
              : { titel: parsed.data.titel, inhalt: parsed.data.inhalt, einsatzweit: false as const, einheitIds }),
          });
          onSaved?.(result.map((row) => row.id));
        } else {
          const result = await createMutation.mutateAsync(parsed.data);
          onSaved?.(result.map((row) => row.id));
        }
        form.reset();
        onClose();
      } catch (error) {
        const mapped = await mapMutationError(error);
        setInlineError(mapped);
      }
    },
  });

  const handleClose = useCallback(() => {
    // Reset auf den zuletzt bekannten Server-Stand (frisch, falls geladen)
    // statt auf die ursprünglichen `defaultValues`, sodass ein erneutes
    // Öffnen keinen veralteten Zwischen-Stand zeigt (Code-Review-Patch #17).
    form.reset(buildDefaults(freshRegelQuery.data ?? regel));
    setInlineError(null);
    lastAppliedVersionRef.current = null;
    onClose();
  }, [form, freshRegelQuery.data, regel, onClose]);

  useEffect(() => {
    if (!open) {
      setInlineError(null);
      lastAppliedVersionRef.current = null;
    }
  }, [open]);

  // Code-Review-Patch #17: Wenn der Refetch im Edit-Modus frische Daten
  // liefert, das Form einmalig auf diese Daten zurücksetzen — aber nur,
  // wenn der User noch nichts manuell verändert hat. Wir tracken die
  // angewandte `version` per Ref, damit ein Refresh nach Submit (z. B.
  // Hintergrund-Invalidate) keinen Reset-Loop auslöst.
  useEffect(() => {
    if (!open || !isEditMode) return;
    const fresh = freshRegelQuery.data;
    if (!fresh) return;
    if (lastAppliedVersionRef.current === fresh.version) return;
    if (form.state.isDirty) {
      lastAppliedVersionRef.current = fresh.version;
      return;
    }
    form.reset(buildDefaults(fresh));
    lastAppliedVersionRef.current = fresh.version;
  }, [open, isEditMode, freshRegelQuery.data, form]);

  // Wenn keine Einheiten im Einsatz verfügbar sind, erzwingen wir einsatzweit.
  // Conditional auf den aktuellen Form-State, damit kein Render-Loop entsteht
  // und der User-Klick auf das Radio nicht stumm überschrieben wird.
  useEffect(() => {
    if (!einheitenLeer) return;
    const currentEinsatzweit = form.getFieldValue('einsatzweit');
    if (currentEinsatzweit !== true) {
      form.setFieldValue('einsatzweit', true);
    }
    const currentIds = form.getFieldValue('einheitIds');
    if (Array.isArray(currentIds) && currentIds.length > 0) {
      form.setFieldValue('einheitIds', []);
    }
  }, [einheitenLeer, form]);

  /**
   * Submit ist nur dann von der Einheiten-Query abhängig, wenn der User
   * tatsächlich auf den „Einheiten"-Modus geschaltet hat — bei einsatzweit
   * darf das ladende Listing nicht den Submit blockieren (UX-DR21).
   */
  const isSubmitDisabled = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog.SlideIn
      isOpen={open}
      onClose={handleClose}
      title={isEditMode ? 'Sicherheitsregel bearbeiten' : 'Neue Sicherheitsregel'}
      description={isEditMode ? 'Titel, Inhalt oder Zuordnung anpassen und speichern.' : 'Regel für den gesamten Einsatz oder einzelne Einheiten anlegen.'}
      size="lg"
      position="right"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button intent="secondary" appearance="ghost" type="button" onClick={handleClose} disabled={createMutation.isPending || updateMutation.isPending}>
            Abbrechen
          </Button>
          <Button
            intent="primary"
            type="submit"
            form="sicherheitsregel-form"
            ref={saveButtonRef}
            disabled={isSubmitDisabled}
            loading={createMutation.isPending || updateMutation.isPending}
            data-testid="sicherheitsregel-submit"
          >
            {isEditMode ? 'Speichern' : 'Anlegen'}
          </Button>
        </div>
      }
    >
      <form
        id="sicherheitsregel-form"
        aria-describedby={inlineError ? 'sicherheitsregel-inline-error' : undefined}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
        className="flex flex-col gap-5"
      >
        <section className="space-y-3">
          <form.Field name="titel">
            {(field) => {
              const length = field.state.value.length;
              const showCount = length >= TITEL_COUNT_THRESHOLD;
              const isNearLimit = length >= TITEL_COUNT_WARN_THRESHOLD;
              return (
                <label htmlFor="sicherheitsregel-titel" className="block text-sm">
                  <span className="block font-medium text-text-primary">
                    Titel <span className="text-status-danger-text">*</span>
                  </span>
                  <Input
                    id="sicherheitsregel-titel"
                    ref={titelInputRef}
                    type="text"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    onKeyDown={(event) => {
                      // AC11: Enter im Titel-Feld springt zur Inhalt-Textarea
                      // (statt das HTML-Form-Default-Submit auszulösen).
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        inhaltTextareaRef.current?.focus();
                      }
                    }}
                    maxLength={TITEL_MAX_LENGTH}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="mt-1 min-h-[2.75rem] py-2"
                    data-testid="sicherheitsregel-titel"
                    aria-describedby={showCount ? 'sicherheitsregel-titel-count' : undefined}
                  />
                  {showCount ? (
                    <span
                      id="sicherheitsregel-titel-count"
                      className={`mt-1 block text-xs ${isNearLimit ? 'text-status-warning-text' : 'text-text-muted'}`}
                      data-testid="sicherheitsregel-titel-count"
                      data-near-limit={isNearLimit ? 'true' : 'false'}
                    >
                      {length} / {TITEL_MAX_LENGTH} Zeichen
                    </span>
                  ) : null}
                </label>
              );
            }}
          </form.Field>

          <form.Field name="inhalt">
            {(field) => {
              const length = field.state.value.length;
              const showCount = length >= INHALT_COUNT_THRESHOLD;
              const isNearLimit = length >= INHALT_COUNT_WARN_THRESHOLD;
              return (
                <label htmlFor="sicherheitsregel-inhalt" className="block text-sm">
                  <span className="block font-medium text-text-primary">
                    Inhalt <span className="text-status-danger-text">*</span>
                  </span>
                  <Textarea
                    id="sicherheitsregel-inhalt"
                    ref={inhaltTextareaRef}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    onKeyDown={(event) => {
                      // AC11: Cmd/Ctrl+Enter triggert Submit; Plain Enter
                      // bleibt Newline (Multi-Line-Konvention).
                      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                        event.preventDefault();
                        saveButtonRef.current?.focus();
                        void form.handleSubmit();
                      }
                    }}
                    maxLength={INHALT_MAX_LENGTH}
                    textareaSize="lg"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="mt-1"
                    data-testid="sicherheitsregel-inhalt"
                    aria-describedby={showCount ? 'sicherheitsregel-inhalt-count' : undefined}
                  />
                  {showCount ? (
                    <span
                      id="sicherheitsregel-inhalt-count"
                      className={`mt-1 block text-xs ${isNearLimit ? 'text-status-warning-text' : 'text-text-muted'}`}
                      data-testid="sicherheitsregel-inhalt-count"
                      data-near-limit={isNearLimit ? 'true' : 'false'}
                    >
                      {length} / {INHALT_MAX_LENGTH} Zeichen
                    </span>
                  ) : null}
                </label>
              );
            }}
          </form.Field>
        </section>

        <section aria-labelledby="sicherheitsregel-zuordnung-heading" className="space-y-3">
          <h2 id="sicherheitsregel-zuordnung-heading" className="text-sm font-semibold text-text-primary">
            Zuordnung
          </h2>
          <form.Field name="einsatzweit">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <input
                    type="radio"
                    name="sicherheitsregel-zuordnung"
                    value="einsatzweit"
                    checked={field.state.value === true}
                    // Während laufender Mutation IMMER disabled. Das Radio
                    // war vorher invertiert — Klick wurde stumm vom
                    // Erzwingungs-Effekt überschrieben (Code-Review-Patch).
                    disabled={createMutation.isPending || updateMutation.isPending}
                    onChange={() => {
                      field.handleChange(true);
                      form.setFieldValue('einheitIds', []);
                    }}
                    data-testid="sicherheitsregel-zuordnung-einsatzweit"
                  />
                  <span>Gesamter Einsatz</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <input
                    type="radio"
                    name="sicherheitsregel-zuordnung"
                    value="einheiten"
                    checked={field.state.value === false}
                    disabled={einheitenLeer || createMutation.isPending || updateMutation.isPending}
                    onChange={() => {
                      field.handleChange(false);
                      // Im Edit-Modus die ursprüngliche Auswahl wiederherstellen,
                      // damit der User nicht jeden Toggle erneut suchen muss
                      // (Code-Review-Patch).
                      const currentIds = form.getFieldValue('einheitIds');
                      if ((!Array.isArray(currentIds) || currentIds.length === 0) && initialEinheitIds.length > 0) {
                        form.setFieldValue('einheitIds', initialEinheitIds);
                      }
                    }}
                    data-testid="sicherheitsregel-zuordnung-einheiten"
                  />
                  <span>Einheiten auswählen</span>
                </label>
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.values.einsatzweit}>
            {(einsatzweit) =>
              einsatzweit === false ? (
                <form.Field name="einheitIds">
                  {(field) => (
                    <div className="mt-2">
                      <EinheitMultiCombobox
                        einsatzId={einsatzId}
                        values={field.state.value}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                        disabled={createMutation.isPending || updateMutation.isPending}
                        label="Einheiten (Mehrfachauswahl möglich)"
                        testId="sicherheitsregel-einheiten-combobox"
                      />
                    </div>
                  )}
                </form.Field>
              ) : null
            }
          </form.Subscribe>

          {einheitenLeer ? (
            <p className="rounded-control border border-border-subtle bg-surface-panel-elevated px-3 py-2 text-xs text-text-muted" data-testid="sicherheitsregel-keine-einheiten-hinweis">
              Keine Einheiten vorhanden — Regel wird einsatzweit angelegt.
            </p>
          ) : null}
        </section>

        {inlineError ? (
          <p
            id="sicherheitsregel-inline-error"
            // Story 2.6 Code-Review-Patch: `aria-live="polite"` statt
            // `role="alert"` — bei wiederholter identischer Message liest
            // der Screen-Reader nur dann erneut, wenn der React-Key
            // wechselt; das verhindert Spam bei wiederholtem Submit.
            aria-live="polite"
            aria-atomic="true"
            key={`inline-error:${inlineError}`}
            className="rounded-control border border-status-danger-border bg-status-danger-surface px-3 py-2 text-sm text-status-danger-text"
            data-testid="sicherheitsregel-inline-error"
          >
            {inlineError}
          </p>
        ) : null}
      </form>
    </Dialog.SlideIn>
  );
}
