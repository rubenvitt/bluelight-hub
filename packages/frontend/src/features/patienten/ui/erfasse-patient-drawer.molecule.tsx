/**
 * `ErfassePatientDrawer` Molecule (Story 1.6, AC6).
 *
 * Dünner Wrapper um die bestehende `ErfassePatientForm` (Story 1.2) — die
 * Form-Logik wird **nicht** angefasst, nur die Layout-Hülle wandert vom
 * Page-Render in einen rechts einfahrenden `Dialog.SlideIn` (UX-Spec Z. 1675:
 * „Routine-Aktionen drawer-basiert").
 *
 * `onSuccess` schließt den Drawer automatisch — die Listen-Invalidation läuft
 * über `useErfassePatient` (Story 1.2), das `PATIENT_QUERY_KEYS.list(einsatzId)`
 * bereits invalidiert.
 */
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { ErfassePatientForm } from './erfasse-patient-form';

interface ErfassePatientDrawerProps {
  einsatzId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ErfassePatientDrawer({ einsatzId, isOpen, onClose }: ErfassePatientDrawerProps) {
  return (
    <Dialog.SlideIn isOpen={isOpen} onClose={onClose} title="Patient erfassen" description="Neue Patient-Aufnahme am Behandlungsplatz" position="right" size="lg">
      <ErfassePatientForm einsatzId={einsatzId} onSuccess={onClose} />
    </Dialog.SlideIn>
  );
}
