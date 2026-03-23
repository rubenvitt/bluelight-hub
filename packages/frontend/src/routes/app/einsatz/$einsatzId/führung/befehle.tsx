import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { BefehlWorkspace } from '@/features/befehl';

const searchSchema = z.object({
  befehlId: z.string().optional(),
});

export const Route = createFileRoute('/app/einsatz/$einsatzId/führung/befehle')({
  validateSearch: (search) => searchSchema.parse(search),
  component: BefehleSeite,
});

/** Route-Komponente — delegiert an BefehlWorkspace-Orchestrator */
function BefehleSeite() {
  const { einsatzId } = Route.useParams();
  const { befehlId } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <BefehlWorkspace
      einsatzId={einsatzId}
      selectedBefehlId={befehlId}
      onSelectBefehl={(id) => navigate({ search: { befehlId: id } })}
      onClosePanel={() => navigate({ search: {} })}
    />
  );
}
