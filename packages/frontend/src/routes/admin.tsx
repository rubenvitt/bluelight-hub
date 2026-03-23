import { createFileRoute, redirect } from '@tanstack/react-router';
import { AdminLayout } from '@/shared/ui/templates/AdminLayout';
import { queryClient } from '@/shared/query-client';
import { NAVIGATION_PERMISSIONS_KEY } from '@/features/auth/hooks';
import type { NavigationPermissionDto } from '@bluelight-hub/shared/client';
import { api } from '@/shared';

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    // Versuche zuerst aus dem Cache zu lesen (kein doppelter Fetch)
    let permissions = queryClient.getQueryData<NavigationPermissionDto[]>(NAVIGATION_PERMISSIONS_KEY);

    if (!permissions) {
      try {
        const response = await api.navigation().navigationPermissionsControllerGetPermissionsVAlpha();
        permissions = response.data;
        queryClient.setQueryData(NAVIGATION_PERMISSIONS_KEY, permissions);
      } catch {
        // Bei Fehler weiter zu AdminLayout (das eigene Auth-Checks hat)
        return;
      }
    }

    // Pruefe ob mindestens ein Admin-Bereich zugaenglich ist
    const adminAreas = ['stammdaten', 'berechtigungen', 'integrationen'];
    const adminPermissions = permissions?.filter((p) => adminAreas.includes(p.area));
    const hasAnyAdminAccess = adminPermissions?.some((p) => p.accessible);

    if (adminPermissions && adminPermissions.length > 0 && !hasAnyAdminAccess) {
      const firstDenied = adminPermissions[0];
      throw redirect({
        to: '/app/forbidden',
        search: {
          blockedRoute: location.pathname,
          reason: firstDenied.reason ?? 'Dieser Bereich ist für Ihre Rolle nicht freigegeben',
        },
      });
    }
  },
  component: AdminLayout,
});
