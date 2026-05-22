import { z } from 'zod';

/**
 * Zod-Schema für den Korrektur-Drawer (Story 1.4, FR42, AC5).
 *
 * **Pflicht-grund** (im Unterschied zur Sichtungs-Reevaluierung, wo `grund`
 * optional ist) — der Korrektur-Pfad ist auditpflichtig.
 *
 * `neuerWert` ist ein generischer String; die VO-Validierung übernimmt das
 * Backend (jedes `feld` hat sein eigenes Enum).
 */
const KORREKTUR_FELDER = ['sichtung', 'behandlungsstatus', 'transportstatus'] as const;
export type KorrekturFeld = (typeof KORREKTUR_FELDER)[number];

export const KorrigierePatientSchema = z
  .object({
    feld: z.enum(KORREKTUR_FELDER, {
      errorMap: () => ({ message: 'Bitte Korrektur-Feld auswählen' }),
    }),
    neuerWert: z.string().trim().min(1, 'Neuer Wert ist erforderlich'),
    grund: z.string().trim().min(1, 'Grund ist erforderlich').max(500, 'Grund max. 500 Zeichen'),
    /**
     * Story 1.4 Code-Review Feature 2: explizite Bestätigung der irreversiblen
     * TOT-Markierung (nur erforderlich, wenn `feld='sichtung' && neuerWert='TOT'`
     * gegen einen lebenden Patienten). Wird vom Drawer gesetzt, sobald die
     * Confirm-Checkbox aktiviert ist.
     */
    bestaetigeTotKorrektur: z.boolean().optional(),
  })
  .strict();

export type KorrigierePatientFormData = z.infer<typeof KorrigierePatientSchema>;
