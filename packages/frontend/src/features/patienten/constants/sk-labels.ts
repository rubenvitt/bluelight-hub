import type { SkEnum } from '@bluelight-hub/shared/client';

/**
 * Anzeige-Labels für Sichtungskategorien (Story 1.2, UX-Spec).
 *
 * Die Kurzform (`shortLabel`) ist für Pills/Badges optimiert,
 * `label` für Volltext-Anzeigen wie Drawer-Headlines und KPI-Cards.
 */
export type SkLabel = {
  shortLabel: string;
  label: string;
  description: string;
};

export const SK_LABELS: Record<SkEnum, SkLabel> = {
  SK_I: {
    shortLabel: 'SK I',
    label: 'SK I — Akut',
    description: 'Akute Lebensgefahr, sofortige Behandlung',
  },
  SK_II: {
    shortLabel: 'SK II',
    label: 'SK II — Dringlich',
    description: 'Dringliche Behandlung, transportfähig nach Stabilisierung',
  },
  SK_III: {
    shortLabel: 'SK III',
    label: 'SK III — Nicht dringlich',
    description: 'Nicht akut lebensgefährlich, gehfähig',
  },
  SK_IV: {
    shortLabel: 'SK IV',
    label: 'SK IV — Abwartend',
    description: 'Abwartende Behandlung bei Massenanfall, geringe Überlebenschance',
  },
  TOT: {
    shortLabel: 'Tot',
    label: 'Tot',
    description: 'Verstorben — kein Reanimationsversuch oder erfolglos beendet',
  },
};

export const SK_DISPLAY_ORDER: SkEnum[] = ['SK_I', 'SK_II', 'SK_III', 'SK_IV', 'TOT'];
