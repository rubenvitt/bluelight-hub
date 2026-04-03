import { AdminIntegrationOverview } from '@/features/admin/ui';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin/integrations/')({
  component: AdminIntegrationOverview,
  meta: () => [{ title: 'Integrationsübersicht' }],
});
