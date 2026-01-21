/**
 * Erinnerung Mark Erledigt Dialog
 *
 * **Story 2.5:** "Erinnerung als erledigt markieren"
 * AC1: Nur ACKNOWLEDGED oder ESKALIERT Status kann erledigt werden
 * AC2: Optionale Notiz kann hinzugefügt werden (max 500 Zeichen)
 * AC4: ETB-Eintrag wird automatisch erstellt
 *
 * **Story 2.6:** "Erledigt-Markierung mit Pflicht-Notiz"
 * AC1: Wenn requiresNote=true, ist die Notiz Pflichtfeld
 * AC5: Ohne gültige Notiz kann nicht erledigt werden
 */

import type { ErinnerungResponseDto } from '@/shared';

import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { useCallback, useMemo } from 'react';
import { PiCheckCircle, PiNotepad, PiWarning } from 'react-icons/pi';
import { z } from 'zod';

import { Button } from '@/shared/ui/atoms/button.atom';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { cn } from '@/shared/ui/cn';

import { useMarkErledigtErinnerung } from '../../api';

interface ErinnerungMarkErledigtDialogProps {
  /** Ob der Dialog offen ist */
  isOpen: boolean;
  /** Schließen-Handler */
  onClose: () => void;
  /** Die zu erledigende Erinnerung */
  erinnerung: ErinnerungResponseDto | null;
  /** Einsatz ID */
  einsatzId: string;
}

/** Maximale Länge der Notiz (Backend-Constraint) */
const MAX_NOTIZ_LENGTH = 500;

/**
 * Factory für Erledigungs-Formular-Schema
 *
 * **Story 2.6 AC1:** Wenn requiresNote=true, wird die Notiz zum Pflichtfeld
 *
 * @param requiresNote - Ob eine Notiz erforderlich ist
 */
const createErledigungsFormSchema = (requiresNote: boolean) =>
  z.object({
    erledigungsNotiz: requiresNote
      ? z.string().min(1, 'Pflicht-Notiz ist erforderlich').max(MAX_NOTIZ_LENGTH, `Notiz darf maximal ${MAX_NOTIZ_LENGTH} Zeichen haben`)
      : z.string().max(MAX_NOTIZ_LENGTH).optional(),
  });

type ErledigungsFormData = { erledigungsNotiz?: string };

/**
 * Dialog zum Markieren einer Erinnerung als erledigt.
 *
 * **Story 2.5 AC2:** Optionale Notiz kann hinzugefügt werden
 * **Story 2.5 AC4:** ETB-Eintrag wird automatisch erstellt (Backend)
 */
export function ErinnerungMarkErledigtDialog({ isOpen, onClose, erinnerung, einsatzId }: ErinnerungMarkErledigtDialogProps) {
  const { mutate: markErledigt, isPending } = useMarkErledigtErinnerung();

  // Story 2.6: Dynamisches Schema basierend auf requiresNote
  const requiresNote = erinnerung?.requiresNote ?? false;
  const erledigungsFormSchema = useMemo(() => createErledigungsFormSchema(requiresNote), [requiresNote]);

  const form = useForm<ErledigungsFormData>({
    defaultValues: {
      erledigungsNotiz: '',
    },
    validatorAdapter: zodValidator(),
    validators: {
      onChange: erledigungsFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (!erinnerung) return;

      markErledigt(
        {
          einsatzId,
          erinnerungId: erinnerung.id,
          erledigungsNotiz: value.erledigungsNotiz?.trim() || undefined,
        },
        {
          onSuccess: () => {
            // Issue 5 Fix: setTimeout Race Condition Fix
            setTimeout(() => {
              form.reset();
              onClose();
            }, 0);
          },
        },
      );
    },
  });

  const handleClose = useCallback(() => {
    if (!isPending) {
      // Issue 9 Fix: Nur hier reset, nicht in onSuccess
      form.reset();
      onClose();
    }
  }, [isPending, onClose, form]);

  // Wenn keine Erinnerung, nichts rendern
  if (!erinnerung) {
    return null;
  }

  return (
    <Dialog isOpen={isOpen} onClose={handleClose}>
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-green-100 p-2 dark:bg-green-900/30">
          <PiCheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <Dialog.Title>Erinnerung '{erinnerung.titel}' erledigen?</Dialog.Title>
      </div>

      <Dialog.Body>
        <div className="space-y-4">
          {/* Info-Box */}
          <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
            <p className="flex items-start gap-2 text-green-800 text-sm dark:text-green-300">
              <PiCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Die Erinnerung wird als erledigt markiert und im Einsatztagebuch dokumentiert.</span>
            </p>
          </div>

          {/* Erinnerung-Details */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
            <dl className="space-y-1 text-sm">
              <div className="flex">
                <dt className="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400">Titel:</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{erinnerung.titel}</dd>
              </div>
              <div className="flex">
                <dt className="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400">Status:</dt>
                <dd className="text-gray-700 dark:text-gray-300">{erinnerung.status === 'ACKNOWLEDGED' ? 'Bestätigt' : erinnerung.status === 'ESKALIERT' ? 'Eskaliert' : erinnerung.status}</dd>
              </div>
            </dl>
          </div>

          {/* Story 2.6: Pflicht-Notiz Warnung bei requiresNote=true */}
          {requiresNote && (
            <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
              <p className="flex items-start gap-2 text-amber-800 text-sm dark:text-amber-300">
                <PiWarning className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>Diese Erinnerung erfordert eine Pflicht-Notiz zur Dokumentation.</span>
              </p>
            </div>
          )}

          {/* Notiz-Feld (optional oder Pflicht je nach requiresNote) */}
          <form.Field name="erledigungsNotiz">
            {(field) => {
              const remainingChars = MAX_NOTIZ_LENGTH - (field.state.value?.length || 0);
              const hasError = field.state.meta.errors.length > 0;

              return (
                <div className="space-y-2">
                  <label htmlFor="erledigungsNotiz" className="flex items-center gap-2 font-medium text-gray-700 text-sm dark:text-gray-300">
                    <PiNotepad className="h-4 w-4" />
                    {requiresNote ? (
                      <>
                        Pflicht-Notiz zur Erledigung <span className="text-red-500">*</span>
                      </>
                    ) : (
                      'Optionale Notiz zur Erledigung'
                    )}
                  </label>
                  <textarea
                    id="erledigungsNotiz"
                    aria-describedby="erledigungsNotiz-hint"
                    aria-required={requiresNote}
                    aria-invalid={hasError}
                    value={field.state.value || ''}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={requiresNote ? 'Bitte dokumentieren Sie die Erledigung...' : 'z.B. Aufgabe wurde erfolgreich durchgeführt...'}
                    maxLength={MAX_NOTIZ_LENGTH}
                    rows={3}
                    disabled={isPending}
                    className={cn(
                      'w-full rounded-lg border bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:opacity-50 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500',
                      hasError
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:border-red-400 dark:focus:border-red-400'
                        : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20 dark:border-gray-600 dark:focus:border-green-400',
                    )}
                  />
                  {/* Validation Error Message */}
                  {hasError && <p className="text-red-600 text-xs dark:text-red-400">{field.state.meta.errors[0]}</p>}
                  <p
                    id="erledigungsNotiz-hint"
                    className={cn(
                      'text-right text-xs',
                      remainingChars < 0 ? 'font-semibold text-red-600 dark:text-red-400' : remainingChars < 50 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400',
                    )}
                  >
                    {remainingChars < 0 ? 'Zeichenlimit überschritten' : `${remainingChars} Zeichen verbleibend`}
                  </p>
                </div>
              );
            }}
          </form.Field>
        </div>
      </Dialog.Body>

      <Dialog.Footer loading={isPending}>
        <Button intent="secondary" appearance="ghost" onClick={handleClose} disabled={isPending}>
          Abbrechen
        </Button>
        <Button
          intent="success"
          onClick={() => {
            form.handleSubmit();
          }}
          loading={isPending}
        >
          <PiCheckCircle className="mr-1.5 h-4 w-4" />
          Als erledigt markieren
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
