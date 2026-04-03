import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const AdminRuntimeConfig = lazy(() =>
  import('@/features/admin/ui').then((module) => ({
    default: module.AdminRuntimeConfig,
  })),
);

export const Route = createFileRoute('/admin/runtime-konfiguration')({
  component: () => (
    <Suspense fallback={null}>
      <AdminRuntimeConfig />
    </Suspense>
  ),
  meta: () => [{ title: 'Laufzeit-Konfiguration' }],
});
