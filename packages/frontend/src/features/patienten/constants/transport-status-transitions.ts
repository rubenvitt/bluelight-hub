import type { TransportstatusEnum } from '@bluelight-hub/shared/client';

/**
 * Erlaubte Transportstatus-Übergänge — gespiegelt aus
 * `backend/src/domain/patienten/value-objects/transportstatus.vo.ts`
 * (Story 1.4).
 */
export const ALLOWED_TRANSPORT_TRANSITIONS: Record<TransportstatusEnum, readonly TransportstatusEnum[]> = {
  WARTEND: ['IM_TRANSPORT'],
  IM_TRANSPORT: ['IM_KRANKENHAUS'],
  IM_KRANKENHAUS: [],
};

export function isTransportTransitionAllowed(from: TransportstatusEnum, to: TransportstatusEnum): boolean {
  return ALLOWED_TRANSPORT_TRANSITIONS[from].includes(to);
}

export const TRANSPORT_DISPLAY_ORDER: TransportstatusEnum[] = ['WARTEND', 'IM_TRANSPORT', 'IM_KRANKENHAUS'];
