import { useCreateEtbEntry, useTextbausteine } from '@/features/etb';
import { useMyEinsatzTeilnahme, useEinsatzFahrzeuge, useEinsatzPersonen, useEinsatzTeilnehmer } from '@/features/einsatz/api';
import { logger } from '@/shared/lib/logger';
import { AddEintragDtoKategorieEnum, type EintragDto } from '@bluelight-hub/shared/client';
import { EtbFormActions } from '@/features/etb';
import { EtbTextbausteinPreview } from '@/features/etb';
import { EtbKategorieSelect } from '@/features/etb';
import { EtbTextbausteinSelect } from '@/features/etb';
import { EtbTextInput } from './EtbTextInput';
import { EtbAbsenderInput } from './EtbAbsenderInput';
import { useEtbFormLogic } from '@/features/etb';
import { useForm } from '@tanstack/react-form';
import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

// Zod Schema mit Kategorie als String-Union (Enum-Werte)
const KATEGORIE_VALUES = Object.values(AddEintragDtoKategorieEnum) as [string, ...string[]];

export const etbEntrySchema = z.object({
  kategorie: z.enum(KATEGORIE_VALUES),
  text: z.string().min(1, 'Text ist erforderlich').max(2000, 'Maximal 2000 Zeichen'),
  absender: z.string().max(100, 'Maximal 100 Zeichen').optional(),
  empfaenger: z.string().max(100, 'Maximal 100 Zeichen').optional(),
});

type EtbEntryFormData = z.infer<typeof etbEntrySchema>;

/** Extrahiert die erste Fehlermeldung (kompatibel mit Zod-Issues und String-Errors) */
function getFieldError(errors: Array<unknown>): string | undefined {
  const err = errors[0];
  if (!err) return undefined;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    if ('message' in err) return (err as { message: string }).message;
    if ('issues' in err) {
      const issues = (err as { issues: Array<{ message: string }> }).issues;
      return issues[0]?.message;
    }
  }
  return undefined;
}

interface EtbEntryFormProps {
  etbId: string;
  einsatzId?: string;
  editingEntry?: EintragDto | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
  /** Auto-Fokus auf erstes Eingabeelement beim Mount */
  autoFocus?: boolean;
  /** aria-labelledby für das Form-Element */
  'aria-labelledby'?: string;
  /** Ref für Fokus nach Speichern — wird auf den Kontext-Abschnitt gesetzt */
  afterSaveFocusRef?: React.RefObject<HTMLDivElement | null>;
  /** Geteilte Create-Mutation vom Workspace (für Sync-Status-Integration) */
  createMutation?: ReturnType<typeof useCreateEtbEntry>;
  /** Story 3.5: Callback bei Formular-Wert-Änderung (für Auto-Save) */
  onFormValuesChange?: (values: { text: string; kategorie: string; absender?: string; empfaenger?: string }) => void;
  /** Story 3.5: Wiederhergestellte Draft-Werte (einmalig setzen) */
  restoredDraftValues?: { text: string; kategorie: string; absender?: string; empfaenger?: string } | null;
  /** Story 3.5: Callback nachdem Draft-Werte in Form gesetzt wurden */
  onDraftRestored?: () => void;
}

/**
 * Formular zur Erstellung und Bearbeitung von ETB-Einträgen
 *
 * Unterstützt automatisches Ausfüllen des Absender-Feldes basierend auf
 * dem Funkrufnamen des Users für diesen Einsatz (via EinsatzTeilnehmer).
 */
export function EtbEntryForm({
  etbId,
  einsatzId,
  editingEntry,
  onSuccess,
  onCancel,
  className,
  autoFocus,
  'aria-labelledby': ariaLabelledBy,
  afterSaveFocusRef,
  createMutation,
  onFormValuesChange,
  restoredDraftValues,
  onDraftRestored,
}: EtbEntryFormProps) {
  const internalCreateEintrag = useCreateEtbEntry();
  const createEintrag = createMutation ?? internalCreateEintrag;
  const { data: textbausteineData } = useTextbausteine();
  const { data: teilnahmeData } = useMyEinsatzTeilnahme(einsatzId);
  const { data: fahrzeuge } = useEinsatzFahrzeuge(einsatzId ?? null);
  const { data: personen } = useEinsatzPersonen(einsatzId ?? null);
  const { data: alleTeilnehmer } = useEinsatzTeilnehmer(einsatzId);

  const [selectedKategorie, setSelectedKategorie] = useState<AddEintragDtoKategorieEnum>(editingEntry?.kategorie || AddEintragDtoKategorieEnum.Dokumentation);
  const [pendingTextbaustein, setPendingTextbaustein] = useState<{ id: string; text: string } | null>(null);
  const [lastAppliedTextbausteinText, setLastAppliedTextbausteinText] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Auto-Fill Absender aus Teilnahme-Daten
  const autoFillAbsender = teilnahmeData?.data?.personFunkrufname || `${teilnahmeData?.data?.personVorname ?? ''} ${teilnahmeData?.data?.personNachname ?? ''}`.trim() || '';

  // Funkrufname-Vorschläge aus allen EinsatzKräften (Fahrzeuge + Personen + Teilnehmer)
  const funkrufnameVorschlaege = useMemo(() => {
    const suggestions: Array<{ value: string; label: string }> = [];
    const seen = new Set<string>();

    // Eigener Funkrufname zuerst (wenn vorhanden)
    if (autoFillAbsender) {
      suggestions.push({ value: autoFillAbsender, label: `${autoFillAbsender} (Mein Funkrufname)` });
      seen.add(autoFillAbsender);
    }

    // Alle aktiven Einsatz-Teilnehmer (andere User mit Funkrufnamen)
    alleTeilnehmer?.data?.forEach((teilnehmer) => {
      const teilnehmerName = teilnehmer.personFunkrufname || `${teilnehmer.personVorname} ${teilnehmer.personNachname}`;
      if (teilnehmerName && !seen.has(teilnehmerName)) {
        suggestions.push({ value: teilnehmerName, label: `${teilnehmerName} (Teilnehmer)` });
        seen.add(teilnehmerName);
      }
    });

    // Fahrzeuge (z.B. "Florian Musterstadt 11/1")
    fahrzeuge?.forEach((fz) => {
      if (fz.funkrufname && !seen.has(fz.funkrufname)) {
        suggestions.push({ value: fz.funkrufname, label: `${fz.funkrufname} (Fahrzeug)` });
        seen.add(fz.funkrufname);
      }
    });

    // Personen (z.B. "GF", "ZF")
    personen?.forEach((p) => {
      if (p.funkrufname && !seen.has(p.funkrufname)) {
        suggestions.push({ value: p.funkrufname, label: `${p.funkrufname} (Person)` });
        seen.add(p.funkrufname);
      }
    });

    return suggestions;
  }, [autoFillAbsender, alleTeilnehmer, fahrzeuge, personen]);

  const form = useForm({
    defaultValues: {
      kategorie: editingEntry?.kategorie || AddEintragDtoKategorieEnum.Dokumentation,
      text: editingEntry?.text || '',
      absender: editingEntry?.absender || autoFillAbsender,
      empfaenger: editingEntry?.empfaenger || '',
    } as EtbEntryFormData,
    validators: {
      onSubmit: etbEntrySchema,
    },
    listeners: {
      onChangeDebounceMs: 100,
      onChange: ({ formApi }) => {
        const kategorieValue = formApi.getFieldValue('kategorie') as AddEintragDtoKategorieEnum;
        setSelectedKategorie(kategorieValue);

        // Story 3.5: Auto-Save Callback
        onFormValuesChangeRef.current?.({
          text: formApi.getFieldValue('text'),
          kategorie: kategorieValue,
          absender: formApi.getFieldValue('absender'),
          empfaenger: formApi.getFieldValue('empfaenger'),
        });
      },
    },
    onSubmit: async ({ value }) => {
      try {
        // Create new entry mit absender/empfaenger
        await createEintrag.mutateAsync({
          etbId,
          data: {
            kategorie: value.kategorie as AddEintragDtoKategorieEnum,
            text: value.text.trim(),
            einsatzId,
            absender: value.absender?.trim() || undefined,
            empfaenger: value.empfaenger?.trim() || undefined,
          },
        });

        form.reset();
        resetSelection();
        setPendingTextbaustein(null);
        setLastAppliedTextbausteinText(null);
        onSuccess?.();
      } catch (error) {
        // Fehler wird inline via ContinuityStatusRail angezeigt (kein Toast)
        logger.error('Failed to save ETB entry:', error);
      }
    },
  });

  // Textbausteine extrahieren (API gibt { data: Array<TextbausteinDto> } zurück)
  const textbausteine = (textbausteineData as { data?: unknown[] } | undefined)?.data ?? [];
  const { selectedTextbaustein, setSelectedTextbaustein, filteredTextbausteine, resetSelection } = useEtbFormLogic(textbausteine as import('../../types/etb.types').TextbausteinData[]);

  // Auto-Fill Absender wenn Teilnahme-Daten geladen werden (nur für neue Einträge)
  useEffect(() => {
    if (!editingEntry && autoFillAbsender && !form.getFieldValue('absender')) {
      form.setFieldValue('absender', autoFillAbsender);
    }
  }, [autoFillAbsender, editingEntry, form]);

  // Reset form when editingEntry changes
  useEffect(() => {
    if (editingEntry) {
      form.reset({
        kategorie: editingEntry.kategorie,
        text: editingEntry.text,
        absender: editingEntry.absender || '',
        empfaenger: editingEntry.empfaenger || '',
      });
      setSelectedKategorie(editingEntry.kategorie);
    } else {
      form.reset({
        kategorie: AddEintragDtoKategorieEnum.Dokumentation,
        text: '',
        absender: autoFillAbsender,
        empfaenger: '',
      });
      setSelectedKategorie(AddEintragDtoKategorieEnum.Dokumentation);
    }
    resetSelection();
    setPendingTextbaustein(null);
    setLastAppliedTextbausteinText(null);
    setShowResetConfirm(false);
  }, [editingEntry, form, resetSelection, autoFillAbsender]);

  // Story 3.5: Draft-Werte wiederherstellen (einmalig)
  useEffect(() => {
    if (!restoredDraftValues) return;

    form.setFieldValue('kategorie', restoredDraftValues.kategorie);
    form.setFieldValue('text', restoredDraftValues.text);
    if (restoredDraftValues.absender !== undefined) {
      form.setFieldValue('absender', restoredDraftValues.absender);
    }
    if (restoredDraftValues.empfaenger !== undefined) {
      form.setFieldValue('empfaenger', restoredDraftValues.empfaenger);
    }
    setSelectedKategorie(restoredDraftValues.kategorie as AddEintragDtoKategorieEnum);
    onDraftRestored?.();
  }, [restoredDraftValues, form, onDraftRestored]);

  // Story 3.5: Stable ref für onFormValuesChange
  const onFormValuesChangeRef = useRef(onFormValuesChange);
  onFormValuesChangeRef.current = onFormValuesChange;

  const handleTextbausteinChange = (textbausteinId: string) => {
    setSelectedTextbaustein(textbausteinId);

    const textbaustein = filteredTextbausteine(form.state.values.kategorie as AddEintragDtoKategorieEnum).find((tb) => tb.id === textbausteinId);

    if (textbaustein?.volltext) {
      const currentText = form.state.values.text;

      // Check if text field has been manually modified
      // Show preview only if text exists, is not empty, and is different from the last applied textbaustein
      if (currentText && currentText.trim() !== '' && currentText !== lastAppliedTextbausteinText && currentText !== textbaustein.volltext) {
        // Show preview instead of directly applying
        setPendingTextbaustein({ id: textbausteinId, text: textbaustein.volltext });
      } else {
        // Directly apply if field is empty, same as last textbaustein, or already matches the new textbaustein
        form.setFieldValue('text', textbaustein.volltext);
        setLastAppliedTextbausteinText(textbaustein.volltext);
        setPendingTextbaustein(null);
      }
    }
  };

  const applyPendingTextbaustein = () => {
    if (pendingTextbaustein) {
      form.setFieldValue('text', pendingTextbaustein.text);
      setLastAppliedTextbausteinText(pendingTextbaustein.text);
      setPendingTextbaustein(null);
    }
  };

  const cancelPendingTextbaustein = () => {
    setPendingTextbaustein(null);
    // Reset selection to empty when canceling
    setSelectedTextbaustein('');
  };

  const handleReset = () => {
    if (editingEntry) {
      // If editing, cancel the edit mode
      onCancel?.();
    } else {
      // If creating new, reset the form
      form.reset();
      resetSelection();
      setPendingTextbaustein(null);
      setLastAppliedTextbausteinText(null);
      setShowResetConfirm(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className={className}
      aria-labelledby={ariaLabelledBy}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            {!editingEntry && (
              <div className="rounded-panel border border-border-subtle bg-surface-panel p-4">
                <p className="mb-3 text-sm font-medium text-text-primary">1. Kommunikationsweg festlegen</p>
                {/* Verschachtelte form.Field: EtbAbsenderInput benötigt beide Feld-States gleichzeitig */}
                <form.Field
                  name="absender"
                  validators={{
                    onBlur: ({ value }) => (value && value.length > 100 ? 'Maximal 100 Zeichen' : undefined),
                  }}
                >
                  {(absenderField) => (
                    <form.Field
                      name="empfaenger"
                      validators={{
                        onBlur: ({ value }) => (value && value.length > 100 ? 'Maximal 100 Zeichen' : undefined),
                      }}
                    >
                      {(empfaengerField) => (
                        <EtbAbsenderInput
                          absenderValue={absenderField.state.value || ''}
                          empfaengerValue={empfaengerField.state.value || ''}
                          onAbsenderChange={absenderField.handleChange}
                          onEmpfaengerChange={empfaengerField.handleChange}
                          onAbsenderBlur={absenderField.handleBlur}
                          onEmpfaengerBlur={empfaengerField.handleBlur}
                          absenderError={getFieldError(absenderField.state.meta.errors)}
                          empfaengerError={getFieldError(empfaengerField.state.meta.errors)}
                          absenderSuggestions={funkrufnameVorschlaege}
                          empfaengerSuggestions={funkrufnameVorschlaege}
                          autoFocusAbsender={autoFocus}
                        />
                      )}
                    </form.Field>
                  )}
                </form.Field>
              </div>
            )}

            <div ref={afterSaveFocusRef} className="rounded-panel border border-border-subtle bg-surface-panel p-4">
              <p className="mb-3 text-sm font-medium text-text-primary">2. Kontext auswählen</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.Field name="kategorie">
                  {(field) => (
                    <EtbKategorieSelect
                      value={field.state.value as AddEintragDtoKategorieEnum}
                      onChange={(value) => {
                        field.handleChange(value);
                        setSelectedTextbaustein('');
                      }}
                      onBlur={field.handleBlur}
                      error={getFieldError(field.state.meta.errors)}
                    />
                  )}
                </form.Field>

                <EtbTextbausteinSelect kategorie={selectedKategorie} value={selectedTextbaustein} onChange={handleTextbausteinChange} textbausteine={filteredTextbausteine(selectedKategorie)} />
              </div>
            </div>

            {pendingTextbaustein && <EtbTextbausteinPreview text={pendingTextbaustein.text} onApply={applyPendingTextbaustein} onCancel={cancelPendingTextbaustein} />}

            <div className="rounded-panel border border-border-subtle bg-surface-panel p-4">
              <p className="mb-3 text-sm font-medium text-text-primary">3. Eintrag formulieren</p>
              <form.Field
                name="text"
                validators={{
                  onBlur: ({ value }) => {
                    if (!value?.trim()) return 'Text ist erforderlich';
                    if (value.length > 2000) return 'Maximal 2000 Zeichen';
                    return undefined;
                  },
                  onChange: ({ value }) => (!value?.trim() ? 'Text ist erforderlich' : undefined),
                }}
              >
                {(field) => (
                  <EtbTextInput
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    onSubmit={() => form.handleSubmit()}
                    error={getFieldError(field.state.meta.errors)}
                    maxLength={2000}
                  />
                )}
              </form.Field>
            </div>
          </div>

          {!editingEntry && (
            <form.Subscribe selector={(state) => ({ text: state.values.text, absender: state.values.absender, empfaenger: state.values.empfaenger, kategorie: state.values.kategorie })}>
              {({ text, absender, empfaenger, kategorie }) => {
                const items = [
                  { label: 'Absender', done: !!absender?.trim() },
                  { label: 'Empfänger', done: !!empfaenger?.trim() },
                  { label: 'Kategorie', done: !!kategorie },
                  { label: 'Text', done: !!text?.trim() },
                ];
                const completed = items.filter((item) => item.done).length;
                return (
                  <aside className="h-fit rounded-panel border border-border-subtle bg-surface-raised p-4">
                    <p className="text-sm font-medium text-text-primary">Ablaufstatus</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {completed}/{items.length} Felder ausgefüllt
                    </p>
                    <ul className="mt-3 space-y-2 text-sm">
                      {items.map((item) => (
                        <li key={item.label} className="flex items-center justify-between rounded-control bg-surface-panel px-2.5 py-1.5">
                          <span className="text-text-secondary">{item.label}</span>
                          <span className={item.done ? 'text-status-success-text' : 'text-text-muted'}>{item.done ? 'Erfasst' : 'Offen'}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-text-muted">Shortcut: Strg/Cmd + Enter speichert direkt.</p>
                  </aside>
                );
              }}
            </form.Subscribe>
          )}
        </div>

        <form.Subscribe
          selector={(state) => ({
            textValue: state.values.text,
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ textValue, canSubmit, isSubmitting }) => {
            const hasContent = (textValue || '').trim() !== '';
            const isPending = createEintrag.isPending;

            return (
              <EtbFormActions
                isEditing={!!editingEntry}
                hasContent={hasContent}
                canSubmit={canSubmit}
                isSubmitting={isSubmitting}
                isPending={isPending}
                showResetConfirm={showResetConfirm}
                onReset={() => {
                  if (hasContent) {
                    setShowResetConfirm(true);
                  } else {
                    handleReset();
                  }
                }}
                onResetConfirm={handleReset}
                onResetCancel={() => setShowResetConfirm(false)}
              />
            );
          }}
        </form.Subscribe>
      </div>
    </form>
  );
}
