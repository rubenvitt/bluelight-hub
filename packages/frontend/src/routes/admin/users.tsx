import { AdminUsers } from '@/features/admin/ui';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin/users')({
  component: AdminUsers,
  meta: () => [{ title: 'Benutzerverwaltung' }],
});
