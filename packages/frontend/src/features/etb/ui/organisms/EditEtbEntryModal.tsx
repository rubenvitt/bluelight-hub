/**
 * Modal zum Bearbeiten eines ETB-Eintrags
 *
 * Zentrierter Dialog mit vorausgefuelltem Formular.
 * Intern wird eine Korrektur erstellt (POST /korrektur),
 * fuer den Benutzer ist es ein normaler "Bearbeiten"-Vorgang.
 */

import { IconButton } from '@/shared/ui/atoms/icon-button.atom';
import { Label } from '@/shared/ui/atoms/label.atom';
import { Textarea } from '@/shared/ui/atoms/textarea.atom';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { EintragDtoKategorieEnum as EtbKategorie, type EintragDto } from '@/shared';
import { EtbKategorieSelect } from './EtbKategorieSelect';
import { EtbAbsenderInput } from './EtbAbsenderInput';
import { useForm } from '@tanstack/react-form';
import { useEffect } from 'react';
import { PiFloppyDisk, PiX } from 'react-icons/pi';
import { toast } from 'sonner';
import { z } from 'zod';
import { useCreateKorrektur } from '../../api';

const editEtbEntrySchema = z.object({
  kategorie: z.nativeEnum(EtbKategorie),
  text: z.string().min(1, 'Text ist erforderlich').max(2000, 'Maximal 2000 Zeichen'),
  absender: z.string().max(200, 'Maximal 200 Zeichen').optional(),
  empfaenger: z.string().max(200, 'Maximal 200 Zeichen').optional(),
});

type EditEtbEntryFormData = z.infer<typeof editEtbEntrySchema>;

interface EditEtbEntryModalProps {
  /** Eintrag der bearbeitet werden soll */
  entry: (EintragDto & { etbId: string }) | null;
  isOpen: boolean;
  onClose: () => void;
  /** Callback nach erfolgreichem Speichern */
  onSaveSuccess?: (entry: EintragDto) => void;
}

/**
 * Zentrierter Dialog zum Bearbeiten eines ETB-Eintrags
 *
 * - Formular vorausgefuellt mit Text, Kategorie, Absender, Empfaenger
 * - Submit erstellt intern eine Korrektur (Immutability)
 * - Fuer den Benutzer ist es ein normaler "Bearbeiten"-Vorgang
 */
export function EditEtbEntryModal({ entry, isOpen, onClose, onSaveSuccess }: EditEtbEntryModalProps) {
  const createKorrektur = useCreateKorrektur();

  const form = useForm({
    defaultValues: {
      kategorie: entry?.kategorie || EtbKategorie.Dokumentation,
      text: entry?.text || '',
      absender: entry?.absender || '',
      empfaenger: entry?.empfaenger || '',
    } as EditEtbEntryFormData,
    validators: {
      onSubmit: editEtbEntrySchema,
    },
    onSubmit: async ({ value }) => {
      if (!entry) return;

      try {
        const result = await createKorrektur.mutateAsync({
          etbId: entry.etbId,
          eintragId: entry.id,
          data: {
            text: value.text.trim(),
            kategorie: value.kategorie,
            absender: value.absender?.trim() || undefined,
            empfaenger: value.empfaenger?.trim() || undefined,
          },
        });

        toast.success('Eintrag gespeichert');
        onSaveSuccess?.(result);
        onClose();
      } catch (_error) {
        // Error handling durch TanStack Query (toast in onError)
      }
    },
  });

  // Reset form when entry changes
  useEffect(() => {
    if (entry) {
      form.reset({
        kategorie: entry.kategorie,
        text: entry.text,
        absender: entry.absender || '',
        empfaenger: entry.empfaenger || '',
      });
    }
  }, [entry, form]);

  if (!entry) return null;

  return (
    <Dialog open={isOpen} as="div" className="relative z-50" onClose={onClose} __demoMode>
      {/* Backdrop */}
      <DialogBackdrop transition className="fixed inset-0 bg-black/30 duration-300 ease-in-out data-[closed]:opacity-0 motion-reduce:duration-0" />

      {/* Zentrierter Panel Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="w-full max-w-lg transform rounded-xl bg-surface-panel shadow-2xl transition-all duration-300 ease-in-out data-[closed]:scale-95 data-[closed]:opacity-0 motion-reduce:duration-0"
        >
          {/* Header */}
          <div className="border-b border-border-subtle px-6 py-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold text-text-primary">Eintrag bearbeiten</DialogTitle>
              <IconButton appearance="minimal" onClick={onClose} className="text-text-muted hover:text-text-secondary" aria-label="Schliessen">
                <PiX className="h-5 w-5" />
              </IconButton>
            </div>
          </div>

          {/* Form Content */}
          <div className="px-6 py-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
              className="space-y-4"
            >
              {/* Kategorie */}
              <form.Field name="kategorie">{(field) => <EtbKategorieSelect value={field.state.value} onChange={field.handleChange} error={field.state.meta.errors?.[0]?.message} />}</form.Field>

              {/* Text */}
              <form.Field name="text">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="edit-entry-text">Text</Label>
                    <Textarea
                      id="edit-entry-text"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      rows={6}
                      maxLength={2000}
                      variant={field.state.meta.errors.length > 0 ? 'error' : 'default'}
                      className="resize-none"
                      placeholder="Text eingeben..."
                    />
                    <div className="flex items-center justify-between">
                      {field.state.meta.errors.length > 0 && <p className="text-sm text-status-danger-text">{field.state.meta.errors[0]?.message}</p>}
                      <p className="ml-auto text-xs text-text-secondary">{field.state.value.length} / 2000 Zeichen</p>
                    </div>
                  </div>
                )}
              </form.Field>

              {/* Absender + Empfaenger (Comboboxen) */}
              <form.Field name="absender">
                {(absenderField) => (
                  <form.Field name="empfaenger">
                    {(empfaengerField) => (
                      <EtbAbsenderInput
                        absenderValue={absenderField.state.value ?? ''}
                        empfaengerValue={empfaengerField.state.value ?? ''}
                        onAbsenderChange={absenderField.handleChange}
                        onEmpfaengerChange={empfaengerField.handleChange}
                        onAbsenderBlur={absenderField.handleBlur}
                        onEmpfaengerBlur={empfaengerField.handleBlur}
                        absenderError={absenderField.state.meta.errors?.[0]?.message}
                        empfaengerError={empfaengerField.state.meta.errors?.[0]?.message}
                      />
                    )}
                  </form.Field>
                )}
              </form.Field>
            </form>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-border-subtle px-6 py-4">
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting || createKorrektur.isPending}
                    className="rounded-lg border border-border-subtle bg-surface-panel px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-action-secondary hover:text-text-primary focus-visible:shadow-focus-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={() => form.handleSubmit()}
                    disabled={!canSubmit || isSubmitting || createKorrektur.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-action-primary px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-action-primary-hover focus-visible:shadow-focus-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PiFloppyDisk className="h-4 w-4" aria-hidden="true" />
                    {isSubmitting || createKorrektur.isPending ? 'Wird gespeichert...' : 'Speichern'}
                  </button>
                </div>
              )}
            </form.Subscribe>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
