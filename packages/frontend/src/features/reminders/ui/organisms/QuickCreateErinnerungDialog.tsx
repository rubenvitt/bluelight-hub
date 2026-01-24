/**
 * Quick-Create Erinnerung Dialog
 *
 * **Story 1.1:** "Erinnerung mit Quick-Create anlegen"
 * AC1: Zeit-Presets (5, 10, 15, 30, 60 Min) sind als Chips waehlbar
 * AC2: Titel-Eingabe mit max. 100 Zeichen
 * AC3: Optional: Beschreibung mit max. 500 Zeichen
 * AC4: "Erstellen" Button erstellt Erinnerung
 * AC5: Berechnet faelligAm = now + Minuten
 *
 * **Story 1.2:** "Erinnerung mit benutzerdefinierter Zeit anlegen"
 * AC1: Benutzerdefiniert-Option im Quick-Create Formular
 * AC2: Time-Picker erscheint bei Benutzerdefiniert
 * AC3: Absolute Zeit speichern
 * AC4: Wechsel zwischen Modi
 * AC5: Validierung bei Benutzerdefiniert
 */

import { useCallback, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { PiAlarm, PiClock, PiNotepad } from 'react-icons/pi';
import { toast } from 'sonner';

import { Button } from '@/shared/ui/atoms/button.atom';
import { Input } from '@/shared/ui/atoms/input.atom';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { cn } from '@/shared/ui/cn';

import { useCreateErinnerung } from '../../api';
import { createErinnerungSchema, TIME_PRESETS, type CreateErinnerungFormData } from '../../schemas/erinnerung.schema';
import { TimeInput } from '../molecules/TimeInput';
import { AssigneeSelector } from '../molecules/AssigneeSelector';
import { calculateCustomFaelligAm, formatTimeForToast, getDefaultCustomTime } from '../../utils/time-calculation';

/**
 * Extrahiert Fehlermeldungen aus TanStack Form Errors.
 * Zod-Adapter liefert Objekte mit `message` Property, nicht plain Strings.
 */
function formatErrors(errors: unknown[]): string {
  return errors
    .map((e) => {
      if (typeof e === 'string') return e;
      if (e && typeof e === 'object' && 'message' in e) return (e as { message: string }).message;
      return String(e);
    })
    .join(', ');
}

interface QuickCreateErinnerungDialogProps {
  /** Ob der Dialog offen ist */
  isOpen: boolean;
  /** Schliessen-Handler */
  onClose: () => void;
  /** Einsatz ID */
  einsatzId: string;
}

/**
 * Dialog zum schnellen Erstellen einer Erinnerung.
 *
 * Der User waehlt ein Zeit-Preset (Chips) und gibt einen Titel ein.
 * Das Backend berechnet automatisch die faelligAm-Zeit basierend auf der Auswahl.
 */
export function QuickCreateErinnerungDialog({ isOpen, onClose, einsatzId }: QuickCreateErinnerungDialogProps) {
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);

  const { mutate: createErinnerung, isPending } = useCreateErinnerung();

  const form = useForm<CreateErinnerungFormData>({
    defaultValues: {
      titel: '',
      timeMode: 'preset', // Story 1.2: Default ist Preset-Modus
      minuten: 30, // Default: 30 Minuten
      customTime: getDefaultCustomTime(), // Story 1.2 AC2: aktuelle Zeit + 30 Min
      beschreibung: undefined,
      requiresNote: false, // Story 2.6: Pflicht-Notiz default aus
      assignedToId: null, // Story 3.3: Keine Zuweisung = fuer alle
    },
    validatorAdapter: zodValidator(),
    validators: {
      onSubmit: createErinnerungSchema,
    },
    onSubmit: async ({ value }) => {
      setApiErrorMessage(null);

      // Story 1.2 AC3: Berechne faelligAm basierend auf Modus
      let faelligAm: Date;
      let toastMessage: string;

      if (value.timeMode === 'preset') {
        // Story 1.1 AC5: Berechne faelligAm = jetzt + gewaehlte Minuten
        // Expliziter Check auf undefined, da minuten = 0 ein valider Wert ist
        const minuten = value.minuten !== undefined ? value.minuten : 30;
        faelligAm = new Date(Date.now() + minuten * 60 * 1000);
        toastMessage = `Erinnerung in ${value.minuten} Min erstellt`;
      } else {
        // Story 1.2 AC3: Absolute Zeit
        const { hours, minutes } = value.customTime ?? { hours: 0, minutes: 0 };
        faelligAm = calculateCustomFaelligAm(hours, minutes);
        toastMessage = `Erinnerung für ${formatTimeForToast(faelligAm)} erstellt`;
      }

      createErinnerung(
        {
          einsatzId,
          data: {
            titel: value.titel.trim(),
            faelligAm: faelligAm.toISOString(),
            beschreibung: value.beschreibung?.trim() || undefined,
            requiresNote: value.requiresNote, // Story 2.6: Pflicht-Notiz Flag
            assignedToId: value.assignedToId ?? undefined, // Story 3.3: Zuweisung an Person
          },
        },
        {
          onSuccess: () => {
            // Story 1.2 AC3: Zeige spezifischen Toast mit Zeit-Information
            toast.success('Erinnerung erstellt', {
              description: toastMessage,
            });
            setTimeout(() => {
              form.reset();
              onClose();
            }, 0);
          },
          onError: (error) => {
            setApiErrorMessage(error instanceof Error ? error.message : 'Fehler beim Erstellen der Erinnerung');
          },
        },
      );
    },
  });

  const handleClose = useCallback(() => {
    if (!isPending) {
      setApiErrorMessage(null);
      form.reset();
      onClose();
    }
  }, [isPending, form, onClose]);

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} size="sm">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
          <PiAlarm className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <Dialog.Title>Erinnerung erstellen</Dialog.Title>
      </div>

      <Dialog.Body>
        <form
          id="quick-create-erinnerung-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-5"
        >
          {/* AC2: Titel-Eingabe */}
          <form.Field name="titel">
            {(field) => (
              <div>
                <label htmlFor="titel" className="mb-1.5 block font-medium text-gray-700 text-sm dark:text-gray-300">
                  Titel <span className="text-red-500">*</span>
                </label>
                <Input
                  id="titel"
                  type="text"
                  placeholder="z.B. Lagebesprechung, Funkrunde..."
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={isPending}
                  variant={field.state.meta.errors.length > 0 ? 'error' : 'default'}
                  maxLength={100}
                  autoFocus
                />
                {field.state.meta.errors.length > 0 && <p className="mt-1 text-red-600 text-sm dark:text-red-400">{formatErrors(field.state.meta.errors)}</p>}
              </div>
            )}
          </form.Field>

          {/* Story 1.1 AC1 & Story 1.2 AC1-4: Zeit-Auswahl */}
          <form.Field name="timeMode">
            {(timeModeField) => (
              <form.Field name="minuten">
                {(minutenField) => (
                  <form.Field name="customTime">
                    {(customTimeField) => (
                      <fieldset className="m-0 border-none p-0">
                        <legend className="mb-2 font-medium text-gray-700 text-sm dark:text-gray-300">
                          Erinnern in <span className="text-red-500">*</span>
                        </legend>

                        {/* Zeit-Presets und Benutzerdefiniert als Chips */}
                        <div className="flex flex-wrap gap-2">
                          {/* Preset Chips */}
                          {TIME_PRESETS.map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              aria-pressed={timeModeField.state.value === 'preset' && minutenField.state.value === preset.value}
                              onClick={() => {
                                // Story 1.2 AC4: Wechsel zu Preset-Modus
                                timeModeField.handleChange('preset');
                                minutenField.handleChange(preset.value);
                              }}
                              disabled={isPending}
                              className={cn(
                                'min-h-[48px] rounded-full px-4 py-2 font-medium text-sm transition-all duration-200',
                                'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800',
                                timeModeField.state.value === 'preset' && minutenField.state.value === preset.value
                                  ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
                                isPending && 'cursor-not-allowed opacity-50',
                              )}
                            >
                              {preset.label}
                            </button>
                          ))}

                          {/* Story 1.2 AC1: Benutzerdefiniert Chip */}
                          <button
                            type="button"
                            aria-pressed={timeModeField.state.value === 'custom'}
                            onClick={() => {
                              // Wechsel zu Custom-Modus
                              timeModeField.handleChange('custom');
                              // Story 1.2 AC2: Default-Zeit setzen falls noch nicht gesetzt
                              if (!customTimeField.state.value) {
                                customTimeField.handleChange(getDefaultCustomTime());
                              }
                            }}
                            disabled={isPending}
                            className={cn(
                              'min-h-[48px] rounded-full px-4 py-2 font-medium text-sm transition-all duration-200',
                              'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800',
                              'flex items-center gap-1.5',
                              timeModeField.state.value === 'custom'
                                ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
                              isPending && 'cursor-not-allowed opacity-50',
                            )}
                          >
                            <PiClock className="h-4 w-4" />
                            Benutzerdefiniert
                          </button>
                        </div>

                        {/* Story 1.2 AC2: TimeInput erscheint bei Benutzerdefiniert */}
                        {timeModeField.state.value === 'custom' && (
                          <div className="mt-4">
                            <label htmlFor="custom-time-input" className="mb-1.5 block font-medium text-gray-700 text-sm dark:text-gray-300">
                              Uhrzeit eingeben
                            </label>
                            <TimeInput
                              id="custom-time-input"
                              value={customTimeField.state.value ?? getDefaultCustomTime()}
                              onChange={(newTime) => customTimeField.handleChange(newTime)}
                              disabled={isPending}
                              error={customTimeField.state.meta.errors.length > 0}
                            />
                            {customTimeField.state.meta.errors.length > 0 && <p className="mt-1 text-red-600 text-sm dark:text-red-400">{formatErrors(customTimeField.state.meta.errors)}</p>}
                          </div>
                        )}

                        {/* Validation Errors für minuten (bei preset mode) */}
                        {timeModeField.state.value === 'preset' && minutenField.state.meta.errors.length > 0 && (
                          <p className="mt-1 text-red-600 text-sm dark:text-red-400">{formatErrors(minutenField.state.meta.errors)}</p>
                        )}
                      </fieldset>
                    )}
                  </form.Field>
                )}
              </form.Field>
            )}
          </form.Field>

          {/* Story 3.3: Zuweisung an Person */}
          <form.Field name="assignedToId">
            {(field) => (
              <div>
                <label htmlFor="assignedToId" className="mb-1.5 block font-medium text-gray-700 text-sm dark:text-gray-300">
                  Zuweisen an <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <AssigneeSelector
                  einsatzId={einsatzId}
                  value={field.state.value}
                  onChange={(userId) => field.handleChange(userId)}
                  onBlur={field.handleBlur}
                  disabled={isPending}
                  error={field.state.meta.errors.length > 0 ? formatErrors(field.state.meta.errors) : undefined}
                />
                <p className="mt-1 text-gray-500 text-xs dark:text-gray-400">Leer lassen für alle Teilnehmer</p>
              </div>
            )}
          </form.Field>

          {/* AC3: Optionale Beschreibung */}
          <form.Field name="beschreibung">
            {(field) => (
              <div>
                <label htmlFor="beschreibung" className="mb-1.5 block font-medium text-gray-700 text-sm dark:text-gray-300">
                  Beschreibung <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <textarea
                  id="beschreibung"
                  placeholder="Zusaetzliche Details zur Erinnerung..."
                  value={field.state.value ?? ''}
                  onChange={(e) => field.handleChange(e.target.value || undefined)}
                  disabled={isPending}
                  maxLength={500}
                  rows={3}
                  className={cn(
                    'block w-full rounded-lg border-2 bg-white px-4 py-2.5 font-medium text-gray-900 transition-colors duration-200',
                    'placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-opacity-20',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    'dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500',
                    'resize-none',
                    // Error state styling (consistent with Input component)
                    field.state.meta.errors.length > 0
                      ? [
                          'border-red-500 hover:border-red-600',
                          'focus:border-red-500 focus:bg-white focus:ring-red-500',
                          'dark:border-red-400 dark:hover:border-red-500',
                          'dark:focus:border-red-400 dark:focus:bg-gray-900 dark:focus:ring-red-400',
                        ]
                      : [
                          'border-gray-300 hover:border-gray-400',
                          'focus:border-primary-500 focus:bg-white focus:ring-primary-500',
                          'dark:border-gray-700 dark:hover:border-gray-600',
                          'dark:focus:border-primary-400 dark:focus:bg-gray-900 dark:focus:ring-primary-400',
                        ],
                  )}
                />
                {field.state.meta.errors.length > 0 && <p className="mt-1 text-red-600 text-sm dark:text-red-400">{formatErrors(field.state.meta.errors)}</p>}
              </div>
            )}
          </form.Field>

          {/* Story 2.6: Pflicht-Notiz Checkbox */}
          <form.Field name="requiresNote">
            {(field) => (
              <div className="flex items-start gap-3">
                <div className="flex h-6 items-center">
                  <input
                    id="requiresNote"
                    type="checkbox"
                    checked={field.state.value ?? false}
                    onChange={(e) => field.handleChange(e.target.checked)}
                    disabled={isPending}
                    className={cn(
                      'h-5 w-5 rounded border-2 text-amber-500',
                      'focus:ring-2 focus:ring-amber-500 focus:ring-offset-2',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      'dark:border-gray-600 dark:bg-gray-800 dark:focus:ring-offset-gray-900',
                    )}
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="requiresNote" className="flex cursor-pointer items-center gap-2 font-medium text-gray-700 text-sm dark:text-gray-300">
                    <PiNotepad className="h-4 w-4 text-amber-500" />
                    Pflicht-Notiz bei Erledigung
                  </label>
                  <p className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">Wenn aktiviert, muss bei Erledigung eine Dokumentations-Notiz eingegeben werden.</p>
                </div>
              </div>
            )}
          </form.Field>

          {/* API Error Message */}
          {apiErrorMessage && <div className="rounded-lg bg-red-50 p-3 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">{apiErrorMessage}</div>}
        </form>
      </Dialog.Body>

      <Dialog.Footer loading={isPending}>
        <Button intent="secondary" appearance="ghost" onClick={handleClose} disabled={isPending}>
          Abbrechen
        </Button>
        <Button type="submit" form="quick-create-erinnerung-form" intent="primary" loading={isPending} disabled={isPending} kbd="Enter">
          Erinnerung erstellen
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
