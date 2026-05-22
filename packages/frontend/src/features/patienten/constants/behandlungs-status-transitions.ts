import type { BehandlungsstatusEnum } from '@bluelight-hub/shared/client';

/**
 * Erlaubte Behandlungsstatus-Übergänge — gespiegelt aus
 * `backend/src/domain/patienten/value-objects/behandlungsstatus.vo.ts`
 * (Story 1.4). Wird im `BehandlungsStatusPillGroup` als clientseitige
 * Vor-Validierung genutzt: illegale Übergangs-Pills sind disabled.
 *
 * Bei Drift zwischen Frontend und Backend gewinnt die Backend-Validierung
 * (Aggregate `canTransitionTo`) — diese Konstante ist eine UX-Optimierung,
 * keine Sicherheitsgarantie.
 */
export const ALLOWED_BEHANDLUNG_TRANSITIONS: Record<BehandlungsstatusEnum, readonly BehandlungsstatusEnum[]> = {
  UNVERSORGT: ['IN_BEHANDLUNG'],
  IN_BEHANDLUNG: ['VERSORGT', 'TRANSPORTBEREIT'],
  VERSORGT: ['TRANSPORTBEREIT'],
  TRANSPORTBEREIT: [],
};

export function isBehandlungsTransitionAllowed(from: BehandlungsstatusEnum, to: BehandlungsstatusEnum): boolean {
  return ALLOWED_BEHANDLUNG_TRANSITIONS[from].includes(to);
}

export const BEHANDLUNG_DISPLAY_ORDER: BehandlungsstatusEnum[] = ['UNVERSORGT', 'IN_BEHANDLUNG', 'VERSORGT', 'TRANSPORTBEREIT'];
