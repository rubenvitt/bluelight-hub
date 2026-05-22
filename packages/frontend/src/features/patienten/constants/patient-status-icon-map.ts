import type { BehandlungsstatusEnum, TransportstatusEnum } from '@bluelight-hub/shared/client';
import { Ambulance, Bandaids, CheckCircle, Clock, FirstAid, Hourglass, MagnifyingGlass, type Icon } from '@phosphor-icons/react';

/**
 * Phosphor-Icon-Mapping pro Behandlungs-Status (Story 1.5, AC8).
 *
 * `FirstAid` als Behandlungs-aktiv-Icon (Phosphor v2 hat kein dediziertes
 * Stethoscope, FirstAid trifft die Behandlungs-Phase semantisch sehr nah).
 */
export const BEHANDLUNG_ICON_MAP: Record<BehandlungsstatusEnum, Icon> = {
  UNVERSORGT: Hourglass,
  IN_BEHANDLUNG: FirstAid,
  VERSORGT: Bandaids,
  TRANSPORTBEREIT: CheckCircle,
};

/**
 * Phosphor-Icon-Mapping pro Transport-Status (Story 1.5, AC8).
 */
export const TRANSPORT_ICON_MAP: Record<TransportstatusEnum, Icon> = {
  WARTEND: Clock,
  IM_TRANSPORT: Ambulance,
  IM_KRANKENHAUS: MagnifyingGlass,
};
