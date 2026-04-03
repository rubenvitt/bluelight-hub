import { AdminQualifikationen } from '@/features/admin/ui';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin/kraefte/qualifikationen')({
  component: AdminQualifikationen,
  meta: () => [{ title: 'Qualifikationen' }],
});
