import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { PiPlus } from 'react-icons/pi';
import { ErfassePatientDrawer, PatientenListe, useDeepLinkRedirect, validatePatientenListSearch, type PatientenListFilters, type PatientenListSearch } from '@/features/patienten';
import { Button } from '@/shared/ui/atoms/button.atom';

export const Route = createFileRoute('/app/einsatz/$einsatzId/patienten/liste')({
  validateSearch: (search: Record<string, unknown>): PatientenListSearch => validatePatientenListSearch(search),
  component: PatientenListeRoute,
});

function PatientenListeRoute() {
  const { einsatzId } = Route.useParams();
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useDeepLinkRedirect({
    einsatzId,
    action: searchParams.action,
    patientId: searchParams.patientId,
    navigate,
  });

  const handleRowClick = useCallback(
    (patientId: string) => {
      void navigate({
        to: '/app/einsatz/$einsatzId/patienten/$patientId',
        params: { einsatzId, patientId },
      });
    },
    [einsatzId, navigate],
  );

  const filters: PatientenListFilters = {
    sk: searchParams.sk,
    behandlungsstatus: searchParams.behandlungsstatus,
    transportstatus: searchParams.transportstatus,
    search: searchParams.search,
    sortBy: searchParams.sortBy,
    sortDir: searchParams.sortDir,
    page: searchParams.page,
    pageSize: searchParams.pageSize,
  };

  const handleFiltersChange = useCallback(
    (next: PatientenListFilters) => {
      void navigate({
        search: () => ({
          sk: next.sk?.length ? next.sk : undefined,
          behandlungsstatus: next.behandlungsstatus?.length ? next.behandlungsstatus : undefined,
          transportstatus: next.transportstatus?.length ? next.transportstatus : undefined,
          search: next.search,
          sortBy: next.sortBy,
          sortDir: next.sortDir,
          page: next.page,
          pageSize: next.pageSize,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Patientenliste</h1>
          <p className="mt-1 text-sm text-text-muted">Aktive Patienten im Einsatz — virtualisiert, gefiltert, sortiert.</p>
        </div>
      </header>

      <div className="flex-1 overflow-hidden rounded-lg border border-border-subtle bg-surface-panel">
        <PatientenListe
          einsatzId={einsatzId}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onRowClick={handleRowClick}
          onErfasseClick={() => setDrawerOpen(true)}
          toolbarCta={
            <Button intent="primary" onClick={() => setDrawerOpen(true)} data-testid="erfasse-patient-cta">
              <PiPlus className="mr-2 h-4 w-4" aria-hidden="true" /> Patient erfassen
            </Button>
          }
        />
      </div>

      <ErfassePatientDrawer einsatzId={einsatzId} isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
