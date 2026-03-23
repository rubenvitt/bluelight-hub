import { useQuery } from '@tanstack/react-query';
import { ResponseError } from '@bluelight-hub/shared/client';
import { api } from '@/shared';

/**
 * Query Key fuer Navigations-Berechtigungen.
 * Global (nicht einsatz-spezifisch), daher kein parameterisierter Key.
 */
export const NAVIGATION_PERMISSIONS_KEY = ['navigation', 'permissions'] as const;

/**
 * TanStack Query Hook fuer GET /api/v-alpha/navigation/permissions.
 *
 * Story 5.1 AC1: Laedt die zugaenglichen Navigationsbereiche basierend
 * auf der UserRole des authentifizierten Benutzers.
 *
 * @returns Query Result mit NavigationPermissionDto[]
 */
export function useNavigationPermissions() {
  return useQuery({
    queryKey: NAVIGATION_PERMISSIONS_KEY,
    queryFn: async () => {
      const response = await api.navigation().navigationPermissionsControllerGetPermissionsVAlpha();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 Minuten — Rollen aendern sich selten
    retry: (failureCount, error) => {
      // Kein Retry bei Client-Fehlern (4xx)
      if (error instanceof ResponseError && error.response.status < 500) return false;
      return failureCount < 2;
    },
  });
}
