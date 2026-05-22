import type { PatientListItemDto } from '@bluelight-hub/shared/client';

export type PatientPhaseId = 'eintreffend' | 'sichtung' | 'behandlung' | 'transport-wartend' | 'im-transport' | 'abtransportiert';

/**
 * Bestimmt die Phase eines Patienten basierend auf seinem aktuellen Status (Story 1.8, AC5).
 * Reihenfolge ist absteigend nach Phase — die am weitesten fortgeschrittene Phase gewinnt
 * (first-match-wins per definierter Ordnung).
 */
export function getPatientPhase(patient: PatientListItemDto): PatientPhaseId {
  // Höchste Phasen zuerst: aktive/abgeschlossene Transport-Stati gewinnen immer.
  if (patient.transportstatus === 'IM_KRANKENHAUS') {
    return 'abtransportiert';
  }
  if (patient.transportstatus === 'IM_TRANSPORT') {
    return 'im-transport';
  }

  // Defensive Defaults: VERSORGT/TRANSPORTBEREIT bedeutet fachlich "wartet auf Transport",
  // unabhängig davon ob transportstatus explizit auf WARTEND gesetzt oder null/undefined ist.
  // Transport-Stati IM_TRANSPORT/IM_KRANKENHAUS sind bereits oben behandelt.
  if (patient.behandlungsstatus === 'TRANSPORTBEREIT') {
    return 'transport-wartend';
  }
  if (patient.behandlungsstatus === 'VERSORGT') {
    return 'transport-wartend';
  }

  if (patient.behandlungsstatus === 'IN_BEHANDLUNG') {
    return 'behandlung';
  }

  if (patient.aktuelleSk && patient.behandlungsstatus === 'UNVERSORGT') {
    return 'sichtung';
  }
  return 'eintreffend';
}
