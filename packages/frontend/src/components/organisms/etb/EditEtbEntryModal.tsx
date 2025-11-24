import { cn } from '@/utils/cn';
import { IconButton } from '@atoms/icon-button.atom';
import { Input } from '@atoms/input.atom';
import { Label } from '@atoms/label.atom';
import { Textarea } from '@atoms/textarea.atom';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { useUpdateEtbEintrag } from '@/hooks/useEtb';
import { CreateEtbEintragDtoKategorieEnum as EtbKategorie, type EtbEintragDto } from '@bluelight-hub/shared/client';
import { EtbKategorieSelect } from '@organisms/etb/EtbKategorieSelect';
import { useForm } from '@tanstack/react-form';
import { format } from 'date-fns';
import { useEffect } from 'react';
import { PiX } from 'react-icons/pi';
import { z } from 'zod';

const editEtbEntrySchema = z.object({
  kategorie: z.nativeEnum(EtbKategorie),
  text: z.string().min(1, 'Text ist erforderlich').max(2000, 'Maximal 2000 Zeichen'),
  timestamp: z.string().min(1, 'Zeitstempel ist erforderlich'),
});

type EditEtbEntryFormData = z.infer<typeof editEtbEntrySchema>;

interface EditEtbEntryModalProps {
  entry: EtbEintragDto | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal zum Bearbeiten von ETB-Einträgen
 *
 * Ermöglicht das Ändern von:
 * - Text (Nachricht)
 * - Zeitstempel
 * - Kategorie
 */
export function EditEtbEntryModal({ entry, isOpen, onClose }: EditEtbEntryModalProps) {
  const updateEintrag = useUpdateEtbEintrag();

  const form = useForm({
    defaultValues: {
      kategorie: entry?.kategorie || EtbKategorie.Lage,
      text: entry?.text || '',
      timestamp: entry ? format(new Date(entry.timestamp), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    } as EditEtbEntryFormData,
    validators: {
      onSubmit: editEtbEntrySchema,
    },
    onSubmit: async ({ value }) => {
      if (!entry) return;

      try {
        await updateEintrag.mutateAsync({
          etbId: entry.etbId,
          eintragId: entry.id,
          data: {
            // Backend erwartet nur newText (UpdateEintragDto)
            newText: value.text.trim(),
          },
        });

        onClose();
      } catch (_error) {
        // Error handling durch TanStack Query
      }
    },
  });

  // Reset form when entry changes
  useEffect(() => {
    if (entry) {
      form.reset({
        kategorie: entry.kategorie,
        text: entry.text,
        timestamp: format(new Date(entry.timestamp), "yyyy-MM-dd'T'HH:mm"),
      });
    }
  }, [entry, form]);

  if (!entry) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <DialogTitle className="font-semibold text-gray-900 text-lg dark:text-gray-100">Eintrag bearbeiten</DialogTitle>
              <p className="mt-1 text-gray-500 text-sm dark:text-gray-400">
                Eintrag #{entry.sequenceNumber} {entry.version > 1 && `(Version ${entry.version})`}
              </p>
            </div>
            <IconButton appearance="minimal" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Schließen">
              <PiX className="h-5 w-5" />
            </IconButton>
          </div>

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <div className="space-y-4">
              {/* Kategorie */}
              <form.Field name="kategorie">{(field) => <EtbKategorieSelect value={field.state.value} onChange={field.handleChange} error={field.state.meta.errors?.[0]?.message} />}</form.Field>

              {/* Zeitstempel */}
              <form.Field name="timestamp">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="timestamp">Zeitstempel</Label>
                    <Input
                      id="timestamp"
                      type="datetime-local"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className={cn(field.state.meta.errors.length > 0 && 'border-red-500 focus:ring-red-500')}
                    />
                    {field.state.meta.errors.length > 0 && <p className="text-red-500 text-sm">{field.state.meta.errors[0]?.message}</p>}
                  </div>
                )}
              </form.Field>

              {/* Text */}
              <form.Field name="text">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="text">Nachricht</Label>
                    <Textarea
                      id="text"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      rows={6}
                      maxLength={2000}
                      className={cn('resize-none', field.state.meta.errors.length > 0 && 'border-red-500 focus:ring-red-500')}
                      placeholder="Eintrag..."
                    />
                    <div className="flex items-center justify-between">
                      {field.state.meta.errors.length > 0 && <p className="text-red-500 text-sm">{field.state.meta.errors[0]?.message}</p>}
                      <p className="ml-auto text-gray-500 text-xs dark:text-gray-400">{field.state.value.length} / 2000 Zeichen</p>
                    </div>
                  </div>
                )}
              </form.Field>

              {/* Actions */}
              <form.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ canSubmit, isSubmitting }) => (
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSubmitting || updateEintrag.isPending}
                      className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      disabled={!canSubmit || isSubmitting || updateEintrag.isPending}
                      className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSubmitting || updateEintrag.isPending ? 'Speichern...' : 'Speichern'}
                    </button>
                  </div>
                )}
              </form.Subscribe>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
