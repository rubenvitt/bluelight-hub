import { z } from 'zod';
import type { SkEnum } from '@bluelight-hub/shared/client';

/**
 * Zod-Schema für das `ErfassePatientForm` (Story 1.2, AC5).
 *
 * Spiegelt die Backend-Validierung aus `ErfassePatientDto`. Wird vom
 * TanStack-Form-Validator (`onChange`) verwendet.
 *
 * Die SK-Werte sind hier als Literal-Tuple inline definiert (nicht via
 * `z.nativeEnum(SkEnum)`), weil das generierte `SkEnum`-Konstantenobjekt
 * unter Umständen in Vitest-Mock-Setups noch nicht initialisiert ist, wenn
 * das Schema-Modul ausgewertet wird (`nativeEnum` ruft `Object.values(SkEnum)`
 * während Modul-Init auf). Die Backend-Validierung (`@IsEnum(SK_CODES)`) bleibt
 * single source of truth — `satisfies readonly SkEnum[]` erzwingt
 * Compile-Time-Drift-Schutz.
 */
const SK_VALUES = ['SK_I', 'SK_II', 'SK_III', 'SK_IV', 'TOT'] as const satisfies readonly SkEnum[];

export const ErfassePatientSchema = z
  .object({
    initialeSk: z.enum(SK_VALUES, {
      errorMap: () => ({ message: 'Bitte initiale Sichtungskategorie auswählen' }),
    }),
    diviVakNummer: z
      .string()
      .trim()
      .max(64, 'DIVI-VAK-Nummer max. 64 Zeichen')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    notiz: z
      .string()
      .trim()
      .max(500, 'Notiz max. 500 Zeichen')
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .strict();

export type ErfassePatientFormData = z.infer<typeof ErfassePatientSchema>;
