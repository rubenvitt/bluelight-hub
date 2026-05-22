import { useForm } from '@tanstack/react-form';
import type { SkEnum } from '@bluelight-hub/shared/client';
import { useSichtungAktualisieren } from '../api/use-sichtung-aktualisieren';
import { AktualisiereSichtungSchema, type AktualisiereSichtungFormData } from '../schemas/aktualisiere-sichtung.schema';

interface UseSichtungAktualisierenFormArgs {
  einsatzId: string;
  patientId: string;
  currentSk: SkEnum;
}

/**
 * Bündelt TanStack-Form + `useSichtungAktualisieren`-Mutation für die
 * `SkUpgradePillGroup` (Story 1.3, AC5).
 *
 * `defaultValues.neueSk` ist `undefined` — die Form wird erst aktiv, sobald
 * der LNA eine inaktive Pill anwählt und bestätigt. Der `currentSk`-Prop
 * dient als Vergleichswert für das No-Op-Locking (UX), die fachliche
 * Prüfung liegt im Aggregat (Domain-Sentinel `SichtungUnveraendert`).
 */
export function useSichtungAktualisierenForm({ einsatzId, patientId, currentSk }: UseSichtungAktualisierenFormArgs) {
  const mutation = useSichtungAktualisieren({ einsatzId, patientId });

  const form = useForm({
    defaultValues: {
      neueSk: undefined as never as SkEnum,
      sichtungArt: 'aerztlich' as const,
      grund: undefined,
    } satisfies Partial<AktualisiereSichtungFormData> as AktualisiereSichtungFormData,
    validators: {
      onChange: AktualisiereSichtungSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      if (value.neueSk === currentSk) {
        // Domain rejected diesen Fall ebenfalls — UX-seitig Hard-Stop, damit kein
        // sinnloser Request raus geht.
        return;
      }
      await mutation.mutateAsync(value);
      formApi.reset();
    },
  });

  return { form, mutation };
}
