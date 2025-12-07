import { api } from '@/api';
import { AUTH_KEYS } from './queries';
import type { AdminLoginResponseDto, AdminPasswordDto, AuthRequestDto, AuthResponseDto } from '@bluelight-hub/shared/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Hook für Unified Authentication (Login/Register)
 *
 * Verwendet die Unified-Auth-API, die sowohl Login als auch Registrierung unterstützt.
 *
 * @returns Mutation für Unified Auth
 *
 * @example
 * ```tsx
 * const { mutate: login, isPending } = useUnifiedAuth();
 *
 * const handleLogin = (username: string, password: string) => {
 *   login({ username, password }, {
 *     onSuccess: () => navigate('/dashboard'),
 *     onError: (err) => toast.error(err.message),
 *   });
 * };
 * ```
 */
export const useUnifiedAuth = () => {
  const queryClient = useQueryClient();

  return useMutation<AuthResponseDto, Error, AuthRequestDto>({
    mutationFn: (authRequestDto: AuthRequestDto) => api.auth().authControllerUnifiedAuth({ authRequestDto }),
    onSuccess: async () => {
      // AuthCheck invalidieren, damit neuer User geladen wird
      await queryClient.invalidateQueries({
        queryKey: AUTH_KEYS.auth.queries.authCheck,
      });
    },
  });
};

/**
 * Hook für Admin-Login
 *
 * Separate Admin-Authentifizierung mit erhöhten Rechten.
 *
 * @returns Mutation für Admin-Login
 *
 * @example
 * ```tsx
 * const { mutate: loginAdmin, isPending } = useAdminLogin();
 *
 * const handleAdminLogin = (password: string) => {
 *   loginAdmin({ password }, {
 *     onSuccess: () => navigate('/admin'),
 *     onError: (err) => toast.error('Falsches Admin-Passwort'),
 *   });
 * };
 * ```
 */
export const useAdminLogin = () => {
  const queryClient = useQueryClient();

  return useMutation<AdminLoginResponseDto, Error, AdminPasswordDto>({
    mutationFn: (adminPasswordDto: AdminPasswordDto) => api.auth().authControllerAdminLogin({ adminPasswordDto }),
    onSuccess: async () => {
      // AuthCheck invalidieren, damit Admin-Status aktualisiert wird
      await queryClient.invalidateQueries({
        queryKey: AUTH_KEYS.auth.queries.authCheck,
      });
    },
  });
};
