import type { EntityFlowStripPhase } from '@/shared/ui/organisms/EntityFlowStrip.organism';
import type { PatientPhaseId } from '../utils/get-patient-phase';

/**
 * Phasen-Konfiguration für den Patienten-Flow im EntityFlowStrip (Story 1.8, AC6).
 */
export const PATIENT_PHASES: EntityFlowStripPhase<PatientPhaseId>[] = [
  {
    id: 'eintreffend',
    label: 'Eintreffend',
    intent: 'patient-status-eintreffend',
    emptyHint: 'Keine eintreffenden Patienten',
  },
  {
    id: 'sichtung',
    label: 'Sichtung',
    intent: 'patient-status-sichtung',
    emptyHint: 'Keine in Sichtung',
  },
  {
    id: 'behandlung',
    label: 'Behandlung',
    intent: 'patient-status-behandlung',
    emptyHint: 'Keine in Behandlung',
  },
  {
    id: 'transport-wartend',
    label: 'Transport wartend',
    intent: 'patient-status-transport-wartend',
    emptyHint: 'Niemand wartet',
  },
  {
    id: 'im-transport',
    label: 'Im Transport',
    intent: 'patient-status-im-transport',
    emptyHint: 'Kein Transport aktiv',
  },
  {
    id: 'abtransportiert',
    label: 'Abtransportiert',
    intent: 'patient-status-abtransportiert',
    emptyHint: 'Niemand abtransportiert',
  },
];
