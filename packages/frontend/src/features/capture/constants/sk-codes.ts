/**
 * Kanonische Sichtungskategorie-Codes (SiKoKo / DIN 13050).
 *
 * Source of Truth für Capture-Storage, Schemas, API-Payloads und Counter-Keys.
 * Farben sind **reines UI-Mapping** (`features/patienten/constants/sk-color-map.ts`)
 * und kommen niemals in den Storage.
 *
 * - SK_I  — sofortige Behandlung (Rot)
 * - SK_II — aufgeschobene Behandlung (Gelb)
 * - SK_III — leicht verletzt (Grün)
 * - SK_IV — lebt, ohne Überlebenschance (Blau)
 * - TOT  — Tote (Schwarz, separate Kategorie)
 */
export const SK_CODE_VALUES = ['SK_I', 'SK_II', 'SK_III', 'SK_IV', 'TOT'] as const;

export type SkCode = (typeof SK_CODE_VALUES)[number];
