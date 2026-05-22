import type { SkEnum } from '@bluelight-hub/shared/client';
import { Heart, Heartbeat, Moon, PersonSimple, Skull, type Icon } from '@phosphor-icons/react';

/**
 * Phosphor-Icon-Mapping pro Sichtungskategorie (Story 1.5, AC7/AC8).
 *
 * Multi-sensorische Codierung (UX-DR5, NFR-A4): Farbe + Label + Icon —
 * KpiTile zeigt das Icon zusätzlich zur Farbe für Screenreader-Nutzer ist
 * `aria-hidden="true"` gesetzt; das fachliche Label steht im DOM.
 *
 * Wahl der Icons:
 *  - `SK_I` (Akut) → `Heartbeat` (Notfall-Konnotation)
 *  - `SK_II` (Dringlich) → `Heart` (Vital, dringend)
 *  - `SK_III` (Nicht dringlich) → `PersonSimple` (gehfähig)
 *  - `SK_IV` (Abwartend) → `Moon` (ruhend, abwartend)
 *  - `TOT` → `Skull` (würdevoll, klar; keine Trauerflor-Assoziation)
 *
 * Tree-shakable Default-Imports — niemals `import * from '@phosphor-icons/react'`
 * (Bundle-Budget, NFR-P8).
 */
export const SK_ICON_MAP: Record<SkEnum, Icon> = {
  SK_I: Heartbeat,
  SK_II: Heart,
  SK_III: PersonSimple,
  SK_IV: Moon,
  TOT: Skull,
};
