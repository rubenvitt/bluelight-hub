import { AdminInvites } from '@/features/admin/ui';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin/invites')({
  component: AdminInvites,
  meta: () => [{ title: 'Einladungen' }],
});
