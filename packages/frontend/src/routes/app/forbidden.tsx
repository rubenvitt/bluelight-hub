import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ForbiddenPage } from '@/features/auth/ui/pages';

const searchSchema = z.object({
  blockedRoute: z.string().optional(),
  reason: z.string().optional(),
});

export const Route = createFileRoute('/app/forbidden')({
  validateSearch: (search) => searchSchema.parse(search),
  component: RouteComponent,
});

function RouteComponent() {
  const { blockedRoute, reason } = Route.useSearch();
  return <ForbiddenPage reason={reason} blockedRoute={blockedRoute} />;
}
