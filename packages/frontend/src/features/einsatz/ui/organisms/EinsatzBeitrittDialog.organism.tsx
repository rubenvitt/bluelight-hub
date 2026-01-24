/**
 * Dialog zum Beitritt/Funkrufname-Setup für einen Einsatz
 *
 * Ermöglicht es dem User, seinen Funkrufnamen für den aktuellen Einsatz zu setzen.
 * Der Funkrufname wird dann für ETB-Einträge automatisch vorausgefüllt.
 */

import { useJoinEinsatz, useMyEinsatzTeilnahme } from '@/features/einsatz/api';
import { Button } from '@/shared/ui/atoms/button.atom';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { useForm } from '@tanstack/react-form';
import { useEffect } from 'react';
import { PiRadio, PiUser } from 'react-icons/pi';
import { z } from 'zod';

const funkrufnameSchema = z.object({
  funkrufname: z.string().min(1, 'Funkrufname ist erforderlich').max(100, 'Maximal 100 Zeichen'),
});

interface EinsatzBeitrittDialogProps {
  einsatzId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Dialog zum Setzen/Ändern des Funkrufnamens für einen Einsatz
 *
 * Zeigt den aktuellen Funkrufnamen an (falls vorhanden) und erlaubt
 * das Setzen oder Ändern des Funkrufnamens.
 */
export function EinsatzBeitrittDialog({ einsatzId, isOpen, onClose }: EinsatzBeitrittDialogProps) {
  const { data: teilnahmeData, isLoading: isTeilnahmeLoading } = useMyEinsatzTeilnahme(einsatzId);
  const joinEinsatz = useJoinEinsatz();

  const currentFunkrufname = teilnahmeData?.data?.funkrufname || '';
  const isAlreadyJoined = !!teilnahmeData?.data;

  const form = useForm({
    defaultValues: {
      funkrufname: currentFunkrufname,
    },
    validators: {
      onSubmit: funkrufnameSchema,
    },
    onSubmit: async ({ value }) => {
      await joinEinsatz.mutateAsync({
        einsatzId,
        data: { funkrufname: value.funkrufname.trim() },
      });
      onClose();
    },
  });

  // Reset form when dialog opens with current value
  useEffect(() => {
    if (isOpen && currentFunkrufname) {
      form.reset({ funkrufname: currentFunkrufname });
    }
  }, [isOpen, currentFunkrufname, form]);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} className="max-w-md">
      <Dialog.CloseButton onClose={onClose} />

      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
            <PiRadio className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="flex-1">
          <Dialog.Title className="font-semibold text-gray-900 text-lg dark:text-white">{isAlreadyJoined ? 'Funkrufname ändern' : 'Einsatz beitreten'}</Dialog.Title>

          <Dialog.Body className="mt-2">
            <p className="text-gray-600 text-sm dark:text-gray-400">
              {isAlreadyJoined
                ? 'Ändern Sie Ihren Funkrufnamen für diesen Einsatz. Der Funkrufname wird für ETB-Einträge automatisch vorausgefüllt.'
                : 'Geben Sie Ihren Funkrufnamen für diesen Einsatz ein. Der Funkrufname wird für ETB-Einträge automatisch vorausgefüllt.'}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
              className="mt-4"
            >
              <form.Field name="funkrufname">
                {(field) => (
                  <div className="space-y-1">
                    <label htmlFor="funkrufname" className="block font-medium text-gray-700 text-sm dark:text-gray-300">
                      Funkrufname
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <PiUser className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="funkrufname"
                        type="text"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="z.B. Florian Musterstadt 11/1"
                        maxLength={100}
                        disabled={isTeilnahmeLoading}
                        className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-4 pl-10 text-gray-900 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20 dark:placeholder:text-gray-500"
                      />
                    </div>
                    {field.state.meta.errors?.[0]?.message && (
                      <p className="text-red-600 text-sm dark:text-red-400" role="alert">
                        {field.state.meta.errors[0].message}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
            </form>
          </Dialog.Body>
        </div>
      </div>

      <Dialog.Footer>
        <Button appearance="ghost" size="sm" onClick={onClose} disabled={joinEinsatz.isPending}>
          Abbrechen
        </Button>
        <Button intent="primary" size="sm" onClick={() => form.handleSubmit()} disabled={joinEinsatz.isPending || isTeilnahmeLoading}>
          {joinEinsatz.isPending ? (
            <>
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Speichern...
            </>
          ) : isAlreadyJoined ? (
            'Ändern'
          ) : (
            'Beitreten'
          )}
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
