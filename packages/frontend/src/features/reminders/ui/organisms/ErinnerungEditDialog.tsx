/**
 * Erinnerung Edit Dialog
 *
 * **Story 1.3:** "Erinnerung bearbeiten"
 * AC1: Editor oeffnet sich mit den aktuellen Werten (Titel, Beschreibung, Faelligkeit)
 * AC2: Aenderungen speichern und Timer aktualisieren
 * AC3: Nur GEPLANT Status editierbar (wird im Store/List Item geprueft)
 * AC4: Validierung (Titel nicht leer, Zeit in der Zukunft)
 */

import { useCallback, useMemo, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { PiPencil, PiClock } from 'react-icons/pi';
import { toast } from 'sonner';

import { Button } from '@/shared/ui/atoms/button.atom';
import { Input } from '@/shared/ui/atoms/input.atom';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { cn } from '@/shared/ui/cn';
import type { ErinnerungResponseDto, UpdateErinnerungDto } from '@/shared';

import { useUpdateErinnerung } from '../../api';
import { updateErinnerungSchema, TIME_PRESETS, type UpdateErinnerungFormData, type CustomTime } from '../../schemas/erinnerung.schema';
import { TimeInput } from '../molecules/TimeInput';
import { calculateCustomFaelligAm, formatTimeForToast } from '../../utils/time-calculation';

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

/**
 * Extrahiert CustomTime aus einem ISO-Datum-String.
 */
function getTimeFromDate(dateString: string): CustomTime {
  const date = new Date(dateString);
  return {
    hours: date.getHours(),
    minutes: date.getMinutes(),
  };
}

interface ErinnerungEditDialogProps {
  /** Ob der Dialog offen ist */
  isOpen: boolean;
  /** Schliessen-Handler */
  onClose: () => void;
  /** Die zu bearbeitende Erinnerung */
  erinnerung: ErinnerungResponseDto | null;
  /** Einsatz ID */
  einsatzId: string;
}

/**
 * Dialog zum Bearbeiten einer bestehenden Erinnerung.
 *
 * **Story 1.3 AC1:** Oeffnet mit den aktuellen Werten der Erinnerung.
 * **Story 1.3 AC2:** Speichert Aenderungen und aktualisiert Timer.
 * **Story 1.3 AC4:** Validiert Titel und Faelligkeit.
 */
export function ErinnerungEditDialog({ isOpen, onClose, erinnerung, einsatzId }: ErinnerungEditDialogProps) {
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);

  const { mutate: updateErinnerung, isPending } = useUpdateErinnerung();

  // Initiale CustomTime aus der Erinnerung
  const initialCustomTime = useMemo<CustomTime>(() => {
    if (!erinnerung?.faelligAm) {
      return { hours: 0, minutes: 0 };
    }
    return getTimeFromDate(erinnerung.faelligAm);
  }, [erinnerung?.faelligAm]);

  const form = useForm<UpdateErinnerungFormData>({
    defaultValues: {
      titel: erinnerung?.titel ?? '',
      timeMode: 'unchanged', // Story 1.3: Default ist "unveraendert"
      minuten: undefined,
      customTime: initialCustomTime,
      beschreibung: erinnerung?.beschreibung ?? '',
    },
    validatorAdapter: zodValidator(),
    validators: {
      onSubmit: updateErinnerungSchema,
    },
    onSubmit: async ({ value }) => {
      if (!erinnerung) return;

      setApiErrorMessage(null);

      // Erstelle UpdateErinnerungDto mit nur geaenderten Feldern
      const updateData: UpdateErinnerungDto = {};
      let hasChanges = false;
      let toastMessage = 'Erinnerung aktualisiert';

      // Titel pruefen
      const trimmedTitel = value.titel?.trim();
      if (trimmedTitel && trimmedTitel !== erinnerung.titel) {
        updateData.titel = trimmedTitel;
        hasChanges = true;
      }

      // Beschreibung pruefen (null bedeutet loeschen)
      const trimmedBeschreibung = value.beschreibung?.trim() ?? null;
      const existingBeschreibung = erinnerung.beschreibung ?? null;
      if (trimmedBeschreibung !== existingBeschreibung) {
        updateData.beschreibung = trimmedBeschreibung || null;
        hasChanges = true;
      }

      // Zeit pruefen basierend auf Modus
      if (value.timeMode !== 'unchanged') {
        let faelligAm: Date;

        if (value.timeMode === 'preset') {
          const minuten = value.minuten !== undefined ? value.minuten : 30;
          faelligAm = new Date(Date.now() + minuten * 60 * 1000);
          toastMessage = `Erinnerung auf +${minuten} Min aktualisiert`;
        } else {
          // custom
          const { hours, minutes } = value.customTime ?? { hours: 0, minutes: 0 };
          faelligAm = calculateCustomFaelligAm(hours, minutes);
          toastMessage = `Erinnerung auf ${formatTimeForToast(faelligAm)} aktualisiert`;
        }

        updateData.faelligAm = faelligAm.toISOString();
        hasChanges = true;
      }

      // Wenn nichts geaendert wurde, Dialog schliessen ohne API-Call
      if (!hasChanges) {
        toast.info('Keine Aenderungen', {
          description: 'Es wurden keine Aenderungen vorgenommen.',
        });
        setTimeout(() => {
          form.reset();
          onClose();
        }, 0);
        return;
      }

      updateErinnerung(
        {
          einsatzId,
          erinnerungId: erinnerung.id,
          data: updateData,
        },
        {
          onSuccess: () => {
            toast.success('Erinnerung aktualisiert', {
              description: toastMessage,
            });
            setTimeout(() => {
              form.reset();
              onClose();
            }, 0);
          },
          onError: (error) => {
            setApiErrorMessage(error instanceof Error ? error.message : 'Fehler beim Aktualisieren der Erinnerung');
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

  // Wenn keine Erinnerung, nichts rendern
  if (!erinnerung) {
    return null;
  }

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} size="sm">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
          <PiPencil className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <Dialog.Title>Erinnerung bearbeiten</Dialog.Title>
      </div>

      <Dialog.Body>
        <form
          id="edit-erinnerung-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-5"
        >
          {/* AC1/AC4: Titel-Eingabe */}
          <form.Field name="titel">
            {(field) => (
              <div>
                <label htmlFor="edit-titel" className="mb-1.5 block font-medium text-gray-700 text-sm dark:text-gray-300">
                  Titel
                </label>
                <Input
                  id="edit-titel"
                  type="text"
                  placeholder="z.B. Lagebesprechung, Funkrunde..."
                  value={field.state.value ?? ''}
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

          {/* Story 1.3 AC2: Zeit-Auswahl mit 'Unveraendert' Option */}
          <form.Field name="timeMode">
            {(timeModeField) => (
              <form.Field name="minuten">
                {(minutenField) => (
                  <form.Field name="customTime">
                    {(customTimeField) => (
                      <fieldset className="m-0 border-none p-0">
                        <legend className="mb-2 font-medium text-gray-700 text-sm dark:text-gray-300">Faelligkeit</legend>

                        {/* Zeit-Optionen als Chips */}
                        <div className="flex flex-wrap gap-2">
                          {/* Unveraendert Chip */}
                          <button
                            type="button"
                            aria-pressed={timeModeField.state.value === 'unchanged'}
                            onClick={() => {
                              timeModeField.handleChange('unchanged');
                            }}
                            disabled={isPending}
                            className={cn(
                              'min-h-[48px] rounded-full px-4 py-2 font-medium text-sm transition-all duration-200',
                              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800',
                              timeModeField.state.value === 'unchanged'
                                ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
                              isPending && 'cursor-not-allowed opacity-50',
                            )}
                          >
                            Unveraendert
                          </button>

                          {/* Preset Chips */}
                          {TIME_PRESETS.map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              aria-pressed={timeModeField.state.value === 'preset' && minutenField.state.value === preset.value}
                              onClick={() => {
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

                          {/* Benutzerdefiniert Chip */}
                          <button
                            type="button"
                            aria-pressed={timeModeField.state.value === 'custom'}
                            onClick={() => {
                              timeModeField.handleChange('custom');
                              // Setze customTime auf aktuelle Faelligkeit falls noch nicht gesetzt
                              if (!customTimeField.state.value || (customTimeField.state.value.hours === 0 && customTimeField.state.value.minutes === 0)) {
                                customTimeField.handleChange(initialCustomTime);
                              }
                            }}
                            disabled={isPending}
                            className={cn(
                              'flex min-h-[48px] items-center gap-1.5 rounded-full px-4 py-2 font-medium text-sm transition-all duration-200',
                              'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800',
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

                        {/* TimeInput erscheint bei Benutzerdefiniert */}
                        {timeModeField.state.value === 'custom' && (
                          <div className="mt-4">
                            <span className="mb-1.5 block font-medium text-gray-700 text-sm dark:text-gray-300">Uhrzeit eingeben</span>
                            <TimeInput
                              value={customTimeField.state.value ?? initialCustomTime}
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

                        {/* Info: Aktuelle Faelligkeit anzeigen wenn 'unchanged' */}
                        {timeModeField.state.value === 'unchanged' && erinnerung.faelligAm && (
                          <p className="mt-2 text-gray-500 text-sm dark:text-gray-400">
                            Aktuelle Faelligkeit:{' '}
                            {new Date(erinnerung.faelligAm).toLocaleString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </fieldset>
                    )}
                  </form.Field>
                )}
              </form.Field>
            )}
          </form.Field>

          {/* Optionale Beschreibung */}
          <form.Field name="beschreibung">
            {(field) => (
              <div>
                <label htmlFor="edit-beschreibung" className="mb-1.5 block font-medium text-gray-700 text-sm dark:text-gray-300">
                  Beschreibung <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <textarea
                  id="edit-beschreibung"
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

          {/* API Error Message */}
          {apiErrorMessage && <div className="rounded-lg bg-red-50 p-3 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">{apiErrorMessage}</div>}
        </form>
      </Dialog.Body>

      <Dialog.Footer loading={isPending}>
        <Button intent="secondary" appearance="ghost" onClick={handleClose} disabled={isPending}>
          Abbrechen
        </Button>
        <Button type="submit" form="edit-erinnerung-form" intent="primary" loading={isPending} disabled={isPending} kbd="Enter">
          Speichern
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
