import { useForm } from '@tanstack/react-form';
import { useEffect, useRef, useState } from 'react';
import { useErfassePatient } from '../api/use-erfasse-patient';
import { ErfassePatientSchema, type ErfassePatientFormData } from '../schemas/erfasse-patient.schema';

const DEFAULT_VALUES: ErfassePatientFormData = {
  initialeSk: undefined as never,
  diviVakNummer: undefined,
  notiz: undefined,
};

const CONFIRMATION_TIMEOUT_MS = 5_000;

interface UseErfassePatientFormArgs {
  einsatzId: string;
  /** Optional: wird nach erfolgreichem Submit aufgerufen (z. B. Drawer schließen, Story 1.6 AC6). */
  onSuccess?: (patientennummer: string) => void;
}

/**
 * Bündelt TanStack-Form + `useErfassePatient`-Mutation (Story 1.2, AC5).
 *
 * `onSuccess` setzt eine Inline-Confirmation-Pill (kein Toast — UX-Spec
 * fordert „kein `toast.success` im Patient-Modul"). Die Pill verschwindet
 * nach 5 s wieder; das Formular wird zurückgesetzt. Wenn der Drawer/das
 * Form vor Ablauf unmounted (z. B. Drawer-Close in Story-1.6 AC6),
 * räumt der `useEffect`-Cleanup den Timer ab, damit kein State-Update
 * auf einem unmounted Component läuft (Code-Review P5).
 */
export function useErfassePatientForm({ einsatzId, onSuccess }: UseErfassePatientFormArgs) {
  const mutation = useErfassePatient({ einsatzId });
  const [lastErfasstePatientennummer, setLastErfasstePatientennummer] = useState<string | null>(null);
  const confirmationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (confirmationTimerRef.current !== null) {
        window.clearTimeout(confirmationTimerRef.current);
        confirmationTimerRef.current = null;
      }
    };
  }, []);

  const form = useForm({
    defaultValues: DEFAULT_VALUES,
    validators: {
      onChange: ErfassePatientSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      // Re-Entry-Guard gegen Doppel-Submit: wenn die Mutation bereits
      // läuft, ignoriere weitere Submit-Trigger (Code-Review P6).
      if (mutation.isPending) return;

      const patient = await mutation.mutateAsync(value);
      setLastErfasstePatientennummer(patient.patientennummer);
      formApi.reset();
      onSuccess?.(patient.patientennummer);

      // Vorhandenen Timer abräumen, falls noch nicht abgelaufen.
      if (confirmationTimerRef.current !== null) {
        window.clearTimeout(confirmationTimerRef.current);
      }
      confirmationTimerRef.current = window.setTimeout(() => {
        setLastErfasstePatientennummer(null);
        confirmationTimerRef.current = null;
      }, CONFIRMATION_TIMEOUT_MS);
    },
  });

  return {
    form,
    mutation,
    lastErfasstePatientennummer,
  };
}
