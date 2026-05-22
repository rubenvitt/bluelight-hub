import type { BehandlungsstatusEnum } from '@bluelight-hub/shared/client';

export type BehandlungsStatusLabel = {
  shortLabel: string;
  label: string;
  description: string;
};

/**
 * Anzeige-Labels für Behandlungsstatus (Story 1.4, UX-Spec).
 * Echte Umlaute (NIE `ae`/`oe`/`ue`/`ss`).
 */
export const BEHANDLUNG_LABELS: Record<BehandlungsstatusEnum, BehandlungsStatusLabel> = {
  UNVERSORGT: {
    shortLabel: 'Unversorgt',
    label: 'Unversorgt',
    description: 'Patient noch nicht in Behandlung',
  },
  IN_BEHANDLUNG: {
    shortLabel: 'In Behandlung',
    label: 'In Behandlung',
    description: 'Patient wird aktuell versorgt',
  },
  VERSORGT: {
    shortLabel: 'Versorgt',
    label: 'Versorgt',
    description: 'Versorgung abgeschlossen, noch kein Transport-Vermerk',
  },
  TRANSPORTBEREIT: {
    shortLabel: 'Transportbereit',
    label: 'Transportbereit',
    description: 'Patient ist bereit für Transport',
  },
};
