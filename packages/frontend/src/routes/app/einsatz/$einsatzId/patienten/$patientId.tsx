import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { useLgViewport } from '@/features/eigenschutz/hooks/use-lg-viewport';
import { PatientDetailPanel } from '@/features/patienten/ui';

/**
 * Story 1.7 (AC6/AC11/AC12): Route für die Patient-Detail-Sicht.
 *
 * Viewport-adaptive Render-Strategie:
 *  - ≥ 1024 px (Desktop/Wide-Tablet): inline Split-View — der Detail-Panel
 *    rendert direkt in der Page. Liste links + Panel rechts ist ein Folge-up
 *    (Task 12 verdrahtet `onRowClick`); die direkte Route-URL füllt heute
 *    den ganzen Innenbereich aus.
 *  - < 1024 px (Tablet/Mobile): `Dialog.SlideIn` mit `position="right"`
 *    fährt den Detail-Panel als Overlay über die List-Route ein. Beim
 *    Schließen navigiert die Route eine Ebene hoch (`/patienten/`).
 *
 * Search-Params werden via Zod-`validateSearch` normalisiert; `action`-
 * Param ist redundant zur Route (siehe Story-1.6-Index-Route mit
 * `?action=detail&patientId=…`-Eintrittstrigger), wird hier aber
 * permissive akzeptiert, damit der Deep-Link `/patienten/{id}?action=detail`
 * stabil bleibt.
 */
// Strict-Schema statt `passthrough()` — sonst landen beliebige fremde Query-
// Params (Bookmarks, externe Tools, manipulierte Deep-Links) unverändert im
// State und werden 1:1 in URLs zurückgespielt. Das ist ein potenzieller
// Cache-Poisoning- bzw. XSS-Vektor in geteilten Links.
const patientDetailSearchSchema = z
  .object({
    action: z.literal('detail').optional(),
  })
  .strict();

export type PatientDetailSearch = z.infer<typeof patientDetailSearchSchema>;

export const Route = createFileRoute('/app/einsatz/$einsatzId/patienten/$patientId')({
  // `safeParse` mit Fallback auf `{}` — eine kaputte URL darf die Route nicht
  // in eine ErrorBoundary reißen. Strict-Validation lehnt Unknown-Keys ab,
  // der Fallback degradiert sauber auf einen leeren Search-State.
  validateSearch: (search: Record<string, unknown>): PatientDetailSearch => {
    const parsed = patientDetailSearchSchema.safeParse(search);
    return parsed.success ? parsed.data : {};
  },
  component: PatientDetailRouteComponent,
});

function PatientDetailRouteComponent() {
  const { einsatzId, patientId } = Route.useParams();
  const isLg = useLgViewport();
  const navigate = useNavigate();

  if (isLg) {
    return (
      <div className="h-full overflow-y-auto rounded-lg border border-border-subtle bg-surface-panel" data-testid="patient-detail-split-view">
        <PatientDetailPanel einsatzId={einsatzId} patientId={patientId} variant="split-view" />
      </div>
    );
  }

  const closeDrawer = () => {
    void navigate({ to: '/app/einsatz/$einsatzId/patienten', params: { einsatzId }, replace: true });
  };

  return (
    <Dialog.SlideIn isOpen onClose={closeDrawer} title={`Patient ${patientId}`} size="xl" position="right">
      <PatientDetailPanel einsatzId={einsatzId} patientId={patientId} variant="drawer" onClose={closeDrawer} />
    </Dialog.SlideIn>
  );
}
