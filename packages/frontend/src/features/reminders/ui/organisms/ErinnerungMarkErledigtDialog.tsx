/**
 * Erinnerung Mark Erledigt Dialog
 *
 * **Story 2.5:** "Erinnerung als erledigt markieren"
 * AC1: Nur ACKNOWLEDGED oder ESKALIERT Status kann erledigt werden
 * AC2: Optionale Notiz kann hinzugefügt werden (max 500 Zeichen)
 * AC4: ETB-Eintrag wird automatisch erstellt
 */

import type { ErinnerungResponseDto } from '@/shared';

import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { useCallback } from 'react';
import { PiCheckCircle, PiNotepad } from 'react-icons/pi';
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

/** Zod-Schema für Erledigungs-Formular (AC2: max 500 Zeichen) */
const erledigungsFormSchema = z.object({
  erledigungsNotiz: z.string().max(MAX_NOTIZ_LENGTH).optional(),
});

type ErledigungsFormData = z.infer<typeof erledigungsFormSchema>;

/**
 * Dialog zum Markieren einer Erinnerung als erledigt.
 *
 * **Story 2.5 AC2:** Optionale Notiz kann hinzugefügt werden
 * **Story 2.5 AC4:** ETB-Eintrag wird automatisch erstellt (Backend)
 */
export function ErinnerungMarkErledigtDialog({ isOpen, onClose, erinnerung, einsatzId }: ErinnerungMarkErledigtDialogProps) {
  const { mutate: markErledigt, isPending } = useMarkErledigtErinnerung();

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

          {/* Optionale Notiz */}
          <form.Field name="erledigungsNotiz">
            {(field) => {
              const remainingChars = MAX_NOTIZ_LENGTH - (field.state.value?.length || 0);

              return (
                <div className="space-y-2">
                  <label htmlFor="erledigungsNotiz" className="flex items-center gap-2 font-medium text-gray-700 text-sm dark:text-gray-300">
                    <PiNotepad className="h-4 w-4" />
                    Optionale Notiz zur Erledigung
                  </label>
                  <textarea
                    id="erledigungsNotiz"
                    aria-describedby="erledigungsNotiz-hint"
                    value={field.state.value || ''}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="z.B. Aufgabe wurde erfolgreich durchgeführt..."
                    maxLength={MAX_NOTIZ_LENGTH}
                    rows={3}
                    disabled={isPending}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-green-400"
                  />
                  <p
                    id="erledigungsNotiz-hint"
                    className={cn(
                      'text-right text-xs',
                      remainingChars < 0 ? 'text-red-600 dark:text-red-400 font-semibold' : remainingChars < 50 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400',
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
