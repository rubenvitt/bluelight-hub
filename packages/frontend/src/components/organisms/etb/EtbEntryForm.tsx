import { useCreateEtbEintrag, useTextbausteine, useUpdateEtbEintrag } from '@/hooks/useEtb';
import { getApiErrorMessage } from '@/utils/apiErrorHandler';
import { CreateEtbEintragDtoKategorieEnum as EtbKategorie, type EtbEintragDto } from '@bluelight-hub/shared/client';
import { EtbFormActions } from '@molecules/etb/EtbFormActions';
import { EtbTextbausteinPreview } from '@molecules/etb/EtbTextbausteinPreview';
import { EtbKategorieSelect } from '@organisms/etb/EtbKategorieSelect';
import { EtbTextbausteinSelect } from '@organisms/etb/EtbTextbausteinSelect';
import { EtbTextInput } from '@organisms/etb/EtbTextInput';
import { useEtbFormLogic } from '@organisms/etb/hooks/useEtbFormLogic';
import { useForm } from '@tanstack/react-form';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

const etbEntrySchema = z.object({
  kategorie: z.enum(EtbKategorie),
  text: z.string().min(1, 'Text ist erforderlich').max(2000, 'Maximal 2000 Zeichen'),
  timestamp: z.date().optional(),
});

type EtbEntryFormData = z.infer<typeof etbEntrySchema>;

interface EtbEntryFormProps {
  etbId: string;
  editingEntry?: EtbEintragDto | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

/**
 * Formular zur Erstellung und Bearbeitung von ETB-Einträgen
 */
export function EtbEntryForm({ etbId, editingEntry, onSuccess, onCancel, className }: EtbEntryFormProps) {
  const createEintrag = useCreateEtbEintrag();
  const updateEintrag = useUpdateEtbEintrag();
  const { data: textbausteineData } = useTextbausteine();
  const [selectedKategorie, setSelectedKategorie] = useState<EtbKategorie>(editingEntry?.kategorie || EtbKategorie.Lage);
  const [pendingTextbaustein, setPendingTextbaustein] = useState<{ id: string; text: string } | null>(null);
  const [lastAppliedTextbausteinText, setLastAppliedTextbausteinText] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const form = useForm({
    defaultValues: {
      kategorie: editingEntry?.kategorie || EtbKategorie.Lage,
      text: editingEntry?.text || '',
      timestamp: editingEntry ? new Date(editingEntry.timestamp) : new Date(),
    } as EtbEntryFormData,
    validators: {
      onSubmit: etbEntrySchema,
    },
    listeners: {
      onChangeDebounceMs: 100,
      onChange: ({ formApi }) => {
        setSelectedKategorie(formApi.getFieldValue('kategorie'));
      },
    },
    onSubmit: async ({ value }) => {
      try {
        if (editingEntry) {
          // Update existing entry
          // Backend erwartet nur newText (UpdateEintragDto)
          await updateEintrag.mutateAsync({
            etbId,
            eintragId: editingEntry.id,
            data: {
              newText: value.text.trim(),
            },
          });
        } else {
          // Create new entry
          await createEintrag.mutateAsync({
            etbId,
            data: {
              kategorie: value.kategorie,
              text: value.text.trim(),
              timestamp: value.timestamp,
            },
          });
        }

        form.reset();
        resetSelection();
        setPendingTextbaustein(null);
        setLastAppliedTextbausteinText(null);
        onSuccess?.();
      } catch (error) {
        console.error('Failed to save ETB entry:', error);

        const context = editingEntry ? 'updateEtbEintrag' : 'createEtbEintrag';
        const fallbackMessage = editingEntry ? 'Beim Aktualisieren des ETB-Eintrags ist ein Fehler aufgetreten.' : 'Beim Erstellen des ETB-Eintrags ist ein Fehler aufgetreten.';

        const errorMessage = await getApiErrorMessage(error, fallbackMessage, context);

        toast.error(editingEntry ? 'Aktualisierung fehlgeschlagen' : 'Erstellung fehlgeschlagen', {
          description: errorMessage,
        });
      }
    },
  });

  const { selectedTextbaustein, setSelectedTextbaustein, filteredTextbausteine, resetSelection } = useEtbFormLogic(textbausteineData?.data || []);

  // Reset form when editingEntry changes
  useEffect(() => {
    if (editingEntry) {
      form.reset({
        kategorie: editingEntry.kategorie,
        text: editingEntry.text,
        timestamp: new Date(editingEntry.timestamp),
      });
      setSelectedKategorie(editingEntry.kategorie);
    } else {
      form.reset({
        kategorie: EtbKategorie.Lage,
        text: '',
        timestamp: new Date(),
      });
      setSelectedKategorie(EtbKategorie.Lage);
    }
    resetSelection();
    setPendingTextbaustein(null);
    setLastAppliedTextbausteinText(null);
    setShowResetConfirm(false);
  }, [editingEntry, form, resetSelection]);

  const handleTextbausteinChange = (textbausteinId: string) => {
    setSelectedTextbaustein(textbausteinId);

    const textbaustein = filteredTextbausteine(form.state.values.kategorie).find((tb) => tb.id === textbausteinId);

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
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <form.Field name="kategorie">
            {(field) => (
              <EtbKategorieSelect
                value={field.state.value}
                onChange={(value) => {
                  field.handleChange(value);
                  setSelectedTextbaustein('');
                }}
                error={field.state.meta.errors?.[0]?.message}
              />
            )}
          </form.Field>

          <EtbTextbausteinSelect kategorie={selectedKategorie} value={selectedTextbaustein} onChange={handleTextbausteinChange} textbausteine={filteredTextbausteine(selectedKategorie)} />
        </div>

        {/* Preview Banner */}
        {pendingTextbaustein && <EtbTextbausteinPreview text={pendingTextbaustein.text} onApply={applyPendingTextbaustein} onCancel={cancelPendingTextbaustein} />}

        <form.Field name="text">
          {(field) => <EtbTextInput value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} error={field.state.meta.errors?.[0]?.message} maxLength={2000} />}
        </form.Field>

        <form.Subscribe
          selector={(state) => ({
            textValue: state.values.text,
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ textValue, canSubmit, isSubmitting }) => {
            const hasContent = (textValue || '').trim() !== '';
            const isPending = editingEntry ? updateEintrag.isPending : createEintrag.isPending;

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
