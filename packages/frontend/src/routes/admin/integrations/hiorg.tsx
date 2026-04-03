import { AdminHiOrgIntegration } from '@/features/admin/ui';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

/**
 * Search Parameter Schema für OAuth Callback.
 *
 * Nach erfolgreichem OAuth Flow redirected das Backend hierhin
 * mit ?oauth=success oder ?oauth=error&message=...
 */
const searchSchema = z.object({
  oauth: z.enum(['success', 'error']).optional(),
  message: z.string().optional(),
});

export const Route = createFileRoute('/admin/integrations/hiorg')({
  component: AdminHiOrgIntegration,
  meta: () => [{ title: 'HiOrg-Integration' }],
  validateSearch: searchSchema,
});
