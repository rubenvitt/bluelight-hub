import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/app/einsatz/$einsatzId/patienten/standalone-sessions')({
  component: StandaloneSessionsRoute,
});

function StandaloneSessionsRoute() {
  const { einsatzId } = Route.useParams();

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Standalone-Sessions</h1>
          <p className="mt-1 text-sm text-text-muted">Erfasste Patienten-Sessions ohne direkten Einsatzbezug.</p>
        </div>
      </header>

      <div className="flex-1 rounded-lg border border-border-subtle bg-surface-panel p-6 shadow-sm">
        <div className="flex h-full flex-col items-center justify-center text-center">
          <p className="text-lg font-medium text-text-primary">Standalone-Sessions folgen in Epic 2</p>
          <p className="mt-2 max-w-md text-sm text-text-muted">
            Diese Sicht wird in Epic 2 (Stories 2.4 + 2.7) gefüllt – Erfassungs-Sessions, die noch nicht an einen konkreten Einsatz (wie Einsatz {einsatzId}) angehängt sind.
          </p>
        </div>
      </div>
    </div>
  );
}
