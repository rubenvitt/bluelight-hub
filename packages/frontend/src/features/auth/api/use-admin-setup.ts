import { api } from '@/api';
import { AUTH_KEYS } from './queries';
import type { AdminSetupDto, AdminSetupResponseDto } from '@bluelight-hub/shared/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Hook für Admin-Setup
 *
 * Richtet den initialen Admin-Account ein (nur beim ersten Start).
 *
 * @returns Mutation für Admin-Setup
 *
 * @example
 * ```tsx
 * const { mutate: setupAdmin, isPending } = useAdminSetup();
 *
 * const handleSetup = (username: string, password: string) => {
 *   setupAdmin({ username, password }, {
 *     onSuccess: () => {
 *       navigate('/admin');
 *       toast.success('Admin-Account erstellt');
 *     },
 *     onError: (err) => toast.error(err.message),
 *   });
 * };
 * ```
 */
export const useAdminSetup = () => {
  const queryClient = useQueryClient();

  return useMutation<AdminSetupResponseDto, Error, AdminSetupDto>({
    mutationFn: (adminSetupDto: AdminSetupDto) => api.auth().authControllerAdminSetup({ adminSetupDto }),
    onSuccess: async () => {
      // Admin-Status invalidieren (Setup nicht mehr verfügbar)
      await queryClient.invalidateQueries({
        queryKey: AUTH_KEYS.auth.queries.adminStatus,
      });
    },
  });
};
