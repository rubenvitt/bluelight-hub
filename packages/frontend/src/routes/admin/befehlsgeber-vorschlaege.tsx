import { AdminBefehlsgeberVorschlaege } from '@/features/admin/ui';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin/befehlsgeber-vorschlaege')({
  component: AdminBefehlsgeberVorschlaege,
  meta: () => [{ title: 'Befehlsgeber-Vorschläge' }],
});
