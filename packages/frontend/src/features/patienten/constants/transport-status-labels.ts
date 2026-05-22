import type { TransportstatusEnum } from '@bluelight-hub/shared/client';

export type TransportStatusLabel = {
  shortLabel: string;
  label: string;
  description: string;
};

export const TRANSPORT_LABELS: Record<TransportstatusEnum, TransportStatusLabel> = {
  WARTEND: {
    shortLabel: 'Wartet',
    label: 'Wartet auf Transport',
    description: 'Patient wartet auf Transportmittel',
  },
  IM_TRANSPORT: {
    shortLabel: 'Im Transport',
    label: 'Im Transport',
    description: 'Patient wird gerade transportiert',
  },
  IM_KRANKENHAUS: {
    shortLabel: 'Im Krankenhaus',
    label: 'Im Krankenhaus übergeben',
    description: 'Patient an Zielklinik übergeben',
  },
};
