import { z } from 'zod';
import type { SkEnum } from '@bluelight-hub/shared/client';

/**
 * Zod-Schema für das `SkUpgradePillGroup`-Bestätigungs-Formular (Story 1.3, AC5).
 *
 * Spiegelt die Backend-Validierung aus `AktualisiereSichtungDto`. Wird vom
 * TanStack-Form-Validator (`onChange`) verwendet.
 *
 * Die SK-Werte sind hier als Literal-Tuple inline definiert (analog
 * `erfasse-patient.schema.ts`, Pattern Story 1.2) — die Backend-Validierung
 * (`@IsEnum(SK_CODES)`) bleibt single source of truth, `satisfies readonly
 * SkEnum[]` erzwingt Compile-Time-Drift-Schutz.
 */
const SK_VALUES = ['SK_I', 'SK_II', 'SK_III', 'SK_IV', 'TOT'] as const satisfies readonly SkEnum[];

const SICHTUNG_ARTEN = ['aerztlich', 'vorsichtung'] as const;
export type SichtungArt = (typeof SICHTUNG_ARTEN)[number];

export const AktualisiereSichtungSchema = z
  .object({
    neueSk: z.enum(SK_VALUES, {
      errorMap: () => ({ message: 'Bitte neue Sichtungskategorie auswählen' }),
    }),
    sichtungArt: z.enum(SICHTUNG_ARTEN, {
      errorMap: () => ({ message: 'Sichtungsart muss ärztlich oder Vorsichtung sein' }),
    }),
    grund: z
      .string()
      .trim()
      .max(500, 'Grund max. 500 Zeichen')
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .strict();

export type AktualisiereSichtungFormData = z.infer<typeof AktualisiereSichtungSchema>;
