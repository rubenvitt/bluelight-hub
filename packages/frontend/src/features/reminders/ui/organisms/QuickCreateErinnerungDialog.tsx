/**
 * Quick-Create Erinnerung Dialog
 *
 * **Story 1.1:** "Erinnerung mit Quick-Create anlegen"
 *
 * AC1: Zeit-Presets (5, 10, 15, 30, 60 Min) sind als Chips waehlbar
 * AC2: Titel-Eingabe mit max. 100 Zeichen
 * AC3: Optional: Beschreibung mit max. 500 Zeichen
 * AC4: "Erstellen" Button erstellt Erinnerung
 * AC5: Berechnet faelligAm = now + Minuten
 */

import { useCallback, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { PiAlarm } from 'react-icons/pi';

import { Button } from '@/shared/ui/atoms/button.atom';
import { Input } from '@/shared/ui/atoms/input.atom';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { cn } from '@/shared/ui/cn';

import { useCreateErinnerung } from '../../api';
import { createErinnerungSchema, TIME_PRESETS, type CreateErinnerungFormData } from '../../schemas/erinnerung.schema';

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
      minuten: 30, // Default: 30 Minuten
      beschreibung: undefined,
    },
    validatorAdapter: zodValidator(),
    validators: {
      onChange: createErinnerungSchema,
    },
    onSubmit: async ({ value }) => {
      setApiErrorMessage(null);

      // AC5: Berechne faelligAm = jetzt + gewaehlte Minuten
      const faelligAm = new Date(Date.now() + value.minuten * 60 * 1000);

      createErinnerung(
        {
          einsatzId,
          data: {
            titel: value.titel.trim(),
            faelligAm: faelligAm.toISOString(),
            beschreibung: value.beschreibung?.trim() || undefined,
          },
        },
        {
          onSuccess: () => {
            form.reset();
            onClose();
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
                  onBlur={field.handleBlur}
                  disabled={isPending}
                  variant={field.state.meta.isTouched && field.state.meta.errors.length > 0 ? 'error' : 'default'}
                  maxLength={100}
                  autoFocus
                />
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 && <p className="mt-1 text-red-600 text-sm dark:text-red-400">{field.state.meta.errors.join(', ')}</p>}
              </div>
            )}
          </form.Field>

          {/* AC1: Zeit-Presets als Chips */}
          <form.Field name="minuten">
            {(field) => (
              <fieldset className="border-none p-0 m-0">
                <legend className="mb-2 font-medium text-gray-700 text-sm dark:text-gray-300">
                  Erinnern in <span className="text-red-500">*</span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {TIME_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      aria-pressed={field.state.value === preset.value}
                      onClick={() => field.handleChange(preset.value)}
                      disabled={isPending}
                      className={cn(
                        'rounded-full px-4 py-2 min-h-[48px] font-medium text-sm transition-all duration-200',
                        'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800',
                        field.state.value === preset.value
                          ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
                        isPending && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 && <p className="mt-1 text-red-600 text-sm dark:text-red-400">{field.state.meta.errors.join(', ')}</p>}
              </fieldset>
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
                  onBlur={field.handleBlur}
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
                    field.state.meta.isTouched && field.state.meta.errors.length > 0
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
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 && <p className="mt-1 text-red-600 text-sm dark:text-red-400">{field.state.meta.errors.join(', ')}</p>}
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
