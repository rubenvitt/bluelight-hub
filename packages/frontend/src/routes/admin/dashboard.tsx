import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const AdminDashboard = lazy(() =>
  import('@/features/admin/ui').then((m) => ({
    default: m.AdminDashboard,
  })),
);

export const Route = createFileRoute('/admin/dashboard')({
  component: () => (
    <Suspense fallback={null}>
      <AdminDashboard />
    </Suspense>
  ),
  meta: () => [{ title: 'Dashboard' }],
});
