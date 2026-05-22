import { useSmViewport } from '@/features/eigenschutz/hooks/use-lg-viewport';
import { usePatientenList, type PatientenListFilters } from '../api/use-patienten-list';
import { KpiStrip } from './kpi-strip';
import { EntityFlowStrip } from '@/shared/ui/organisms/EntityFlowStrip.organism';
import { PatientPill } from './patient-pill.molecule';
import { PatientenListe } from './patientenliste.organism';
import { getPatientPhase, type PatientPhaseId } from '../utils/get-patient-phase';
import { PATIENT_PHASES } from '../constants/patient-phases';
import type { PatientListItemDto } from '@bluelight-hub/shared/client';
import { cn } from '@/shared/ui/cn';
import { PiArrowClockwise, PiWarningCircle } from 'react-icons/pi';

export interface PatientenDashboardProps {
  einsatzId: string;
  filters: PatientenListFilters;
  onFiltersChange: (next: PatientenListFilters) => void;
  onRowClick?: (patientId: string) => void;
  onErfasseClick?: () => void;
  toolbarCta?: React.ReactNode;
  className?: string;
}

/**
 * PatientenDashboard (Story 1.8, AC6).
 *
 * Komponiert:
 *  - KpiStrip (Story 1.5)
 *  - EntityFlowStrip (Kanban-Grid der 6 Phasen, ausgeblendet bei < 640 px)
 *  - PatientenListe (Story 1.6)
 *
 * Reagiert dynamisch auf die Viewport-Breite (UX-DR33).
 */
export function PatientenDashboard({ einsatzId, filters, onFiltersChange, onRowClick, onErfasseClick, toolbarCta, className }: PatientenDashboardProps) {
  const isSm = useSmViewport(); // ≥ 640 px

  // Ungefilterte Patientenliste für den EntityFlowStrip oben laden.
  // F37: Nur auf Desktop (≥ 640 px) aktiv — Mobile braucht keinen Flow und
  // darf im Feldeinsatz keine Bandbreite/Battery für 1000-Item-Pulls verschwenden.
  const fullListQuery = usePatientenList(
    einsatzId,
    {
      // Keine Filter, um die Verteilung aller Patienten darzustellen.
      // Setzen einer hohen Seitengröße, um sicherzustellen, dass alle Patienten geladen werden.
      pageSize: 1000,
    },
    { enabled: isSm },
  );

  const allItems = fullListQuery.data?.items ?? [];

  if (!isSm) {
    // D3 < 640 px: nur KpiStrip + PatientenListe (kompakte Stack-Variante)
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        <KpiStrip einsatzId={einsatzId} />
        <div className="flex-1 overflow-hidden rounded-lg border border-border-subtle bg-surface-panel">
          <PatientenListe einsatzId={einsatzId} filters={filters} onFiltersChange={onFiltersChange} onRowClick={onRowClick} onErfasseClick={onErfasseClick} toolbarCta={toolbarCta} />
        </div>
      </div>
    );
  }

  // D1 ≥ 640 px: KpiStrip + EntityFlowStrip (oder Error-Card) + PatientenListe
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <KpiStrip einsatzId={einsatzId} />

      {fullListQuery.isError ? (
        <div role="alert" aria-label="Patient-Flow" className="flex flex-col items-center justify-center gap-2 rounded-panel border border-status-danger-border bg-status-danger-surface p-4">
          <PiWarningCircle className="h-8 w-8 text-status-danger-text" />
          <p className="text-center text-sm text-status-danger-text">Patient-Flow konnte nicht geladen werden</p>
          <button
            type="button"
            onClick={() => {
              void fullListQuery.refetch();
            }}
            className="flex items-center gap-1 rounded-control px-2 py-1 text-sm text-status-danger-text transition-opacity hover:opacity-80 focus:outline-none focus-visible:shadow-focus-ring"
            aria-label="Patient-Flow erneut laden"
          >
            <PiArrowClockwise className="h-4 w-4" />
            Erneut versuchen
          </button>
        </div>
      ) : (
        <EntityFlowStrip<PatientListItemDto, PatientPhaseId>
          phases={PATIENT_PHASES}
          items={allItems}
          getPhase={getPatientPhase}
          getItemKey={(p) => p.id}
          renderItem={(p) => <PatientPill patient={p} onClick={onRowClick ? () => onRowClick(p.id) : undefined} />}
          ariaLabel="Patient-Flow"
          loading={fullListQuery.isPending}
        />
      )}

      <div className="flex-1 overflow-hidden rounded-lg border border-border-subtle bg-surface-panel">
        <PatientenListe einsatzId={einsatzId} filters={filters} onFiltersChange={onFiltersChange} onRowClick={onRowClick} onErfasseClick={onErfasseClick} toolbarCta={toolbarCta} />
      </div>
    </div>
  );
}
