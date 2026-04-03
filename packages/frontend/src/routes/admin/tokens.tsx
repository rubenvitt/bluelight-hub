import { TokenManagementPage } from '@/features/admin/ui';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin/tokens')({
  component: TokenManagementPage,
  meta: () => [{ title: 'API-Tokens' }],
});
