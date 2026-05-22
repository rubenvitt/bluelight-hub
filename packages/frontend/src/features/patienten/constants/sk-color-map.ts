import type { SkEnum } from '@bluelight-hub/shared/client';

/**
 * SK-Farbtoken-Mapping nach UX-Spec (Story 1.2, Tokens-Migration in Story 1.5).
 *
 * Verbindlich:
 * - `SK_IV` = Blau (NICHT Schwarz/Tot)
 * - `TOT` = Schwarz (eigene Kategorie nach SiKoKo/DIN 13050)
 *
 * Quelle: Memory `project_manv_sichtungskategorien_farben.md`
 * (Entscheidung Rubeen 2026-05-18).
 *
 * Story 1.5 hat die `sk-{rot,gelb,gruen,blau,schwarz}-{surface,border,text,fill}`-
 * Tokens in `index.tailwind.css` eingeführt; die `klass`-Map nutzt nun die
 * neuen Ring-1-Tokens (WCAG-AA/AAA-Kontrast verifiziert via
 * `sk-token-contrast.spec.ts`). Inline-Style-Konsumenten erhalten die Slots
 * als CSS-`var(...)`-Referenzen, damit Light/Dark automatisch greift.
 */
export type SkVisualToken = {
  /** Surface als CSS-Variable-Referenz (für Inline-Styles). */
  surface: string;
  /** Border als CSS-Variable-Referenz (z. B. für `boxShadow: inset …`). */
  border: string;
  /** Text als CSS-Variable-Referenz. */
  text: string;
  /** Voll-Fläche (KPI-Tile Variant=solid, SkBadge-Indikator). */
  fill: string;
  /** Tailwind-Klassen-Bundle für die Pille / KPI-Tile (Variant=tint). */
  klass: string;
};

export const SK_COLOR_MAP: Record<SkEnum, SkVisualToken> = {
  SK_I: {
    surface: 'var(--color-sk-rot-surface)',
    border: 'var(--color-sk-rot-border)',
    text: 'var(--color-sk-rot-text)',
    fill: 'var(--color-sk-rot-fill)',
    klass: 'bg-sk-rot-surface border-sk-rot-border text-sk-rot-text',
  },
  SK_II: {
    surface: 'var(--color-sk-gelb-surface)',
    border: 'var(--color-sk-gelb-border)',
    text: 'var(--color-sk-gelb-text)',
    fill: 'var(--color-sk-gelb-fill)',
    klass: 'bg-sk-gelb-surface border-sk-gelb-border text-sk-gelb-text',
  },
  SK_III: {
    surface: 'var(--color-sk-gruen-surface)',
    border: 'var(--color-sk-gruen-border)',
    text: 'var(--color-sk-gruen-text)',
    fill: 'var(--color-sk-gruen-fill)',
    klass: 'bg-sk-gruen-surface border-sk-gruen-border text-sk-gruen-text',
  },
  SK_IV: {
    surface: 'var(--color-sk-blau-surface)',
    border: 'var(--color-sk-blau-border)',
    text: 'var(--color-sk-blau-text)',
    fill: 'var(--color-sk-blau-fill)',
    klass: 'bg-sk-blau-surface border-sk-blau-border text-sk-blau-text',
  },
  TOT: {
    surface: 'var(--color-sk-schwarz-surface)',
    border: 'var(--color-sk-schwarz-border)',
    text: 'var(--color-sk-schwarz-text)',
    fill: 'var(--color-sk-schwarz-fill)',
    klass: 'bg-sk-schwarz-surface border-sk-schwarz-border text-sk-schwarz-text',
  },
};
