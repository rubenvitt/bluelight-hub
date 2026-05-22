import type { BehandlungsstatusEnum, TransportstatusEnum } from '@bluelight-hub/shared/client';

/**
 * Patient-Status-Farbtoken-Mapping (Story 1.4 → Story 1.5 Tokens-Migration).
 *
 * Verbraucher (`behandlungs-status-pill-group`, `transport-status-pill-group`,
 * `KpiStrip`) nutzen die in Story 1.5 eingeführten `patient-status-*-{surface,
 * border,text}`-Ring-1-Tokens (Light + Dark, WCAG-AA-Kontrast verifiziert in
 * `sk-token-contrast.spec.ts`). Inline-Style-Slots (`fill`/`border`) erhalten
 * die Slots als CSS-`var(...)`-Referenzen, damit Light/Dark-Switch automatisch
 * greift.
 *
 * Cross-Section-Re-Use: Behandlung und Transport teilen sich 6 Token-Familien
 * für 7 Buckets — `TRANSPORTBEREIT` (Behandlung) und `IM_KRANKENHAUS`
 * (Transport) re-usen `patient-status-abtransportiert` (beide = „Patient ist
 * versorgt und außer Haus"). Innerhalb jeder Sektion bleibt jede Tile eindeutig
 * farbcodiert; das spiegelt die in `kpi-strip.tsx`-Intent-Map dokumentierte
 * Semantik.
 */
export type PatientStatusVisualToken = {
  /** Tailwind-Klassen für Background/Border/Text der Pill (Story 1.5 Tokens). */
  klass: string;
  /** Surface als CSS-Variable-Referenz (für Inline-Styles und Inset-Indikator-Dots). */
  fill: string;
  /** Border als CSS-Variable-Referenz. */
  border: string;
};

export const BEHANDLUNG_COLOR_MAP: Record<BehandlungsstatusEnum, PatientStatusVisualToken> = {
  UNVERSORGT: {
    klass: 'bg-patient-status-eintreffend-surface border-patient-status-eintreffend-border text-patient-status-eintreffend-text',
    fill: 'var(--color-patient-status-eintreffend-surface)',
    border: 'var(--color-patient-status-eintreffend-border)',
  },
  IN_BEHANDLUNG: {
    klass: 'bg-patient-status-behandlung-surface border-patient-status-behandlung-border text-patient-status-behandlung-text',
    fill: 'var(--color-patient-status-behandlung-surface)',
    border: 'var(--color-patient-status-behandlung-border)',
  },
  VERSORGT: {
    klass: 'bg-patient-status-sichtung-surface border-patient-status-sichtung-border text-patient-status-sichtung-text',
    fill: 'var(--color-patient-status-sichtung-surface)',
    border: 'var(--color-patient-status-sichtung-border)',
  },
  TRANSPORTBEREIT: {
    klass: 'bg-patient-status-abtransportiert-surface border-patient-status-abtransportiert-border text-patient-status-abtransportiert-text',
    fill: 'var(--color-patient-status-abtransportiert-surface)',
    border: 'var(--color-patient-status-abtransportiert-border)',
  },
};

export const TRANSPORT_COLOR_MAP: Record<TransportstatusEnum, PatientStatusVisualToken> = {
  WARTEND: {
    klass: 'bg-patient-status-transport-wartend-surface border-patient-status-transport-wartend-border text-patient-status-transport-wartend-text',
    fill: 'var(--color-patient-status-transport-wartend-surface)',
    border: 'var(--color-patient-status-transport-wartend-border)',
  },
  IM_TRANSPORT: {
    klass: 'bg-patient-status-im-transport-surface border-patient-status-im-transport-border text-patient-status-im-transport-text',
    fill: 'var(--color-patient-status-im-transport-surface)',
    border: 'var(--color-patient-status-im-transport-border)',
  },
  IM_KRANKENHAUS: {
    klass: 'bg-patient-status-abtransportiert-surface border-patient-status-abtransportiert-border text-patient-status-abtransportiert-text',
    fill: 'var(--color-patient-status-abtransportiert-surface)',
    border: 'var(--color-patient-status-abtransportiert-border)',
  },
};
