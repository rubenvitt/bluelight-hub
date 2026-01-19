/**
 * @deprecated Zentrale Query Keys - DEPRECATED
 *
 * Diese Datei ist DEPRECATED und wird in Zukunft entfernt.
 * Bitte importiere Query Keys direkt aus den jeweiligen Features:
 *
 * - Auth: `import { AUTH_KEYS, USERS_QUERY_KEYS, USER_QUERY_KEYS, HEALTH_QUERY_KEYS } from '@/features/auth'`
 * - Admin: `import { ADMIN_QUERY_KEYS } from '@/features/admin'`
 * - Einsatz: `import { EINSATZ_QUERY_KEYS } from '@/features/einsatz'`
 * - ETB: `import { ETB_QUERY_KEYS } from '@/features/etb'`
 * - Lagekarte: `import { LAGEKARTE_QUERY_KEYS } from '@/features/lagekarte'`
 * - System: `import { SYSTEM_QUERY_KEYS } from '@/features/system'`
 */

// Re-exports für Backward Compatibility
export { USER_QUERY_KEYS, USERS_QUERY_KEYS, HEALTH_QUERY_KEYS } from '@/features/auth';
export { ADMIN_QUERY_KEYS } from '@/features/admin';
export { EINSATZ_QUERY_KEYS } from '@/features/einsatz';
export { ETB_QUERY_KEYS } from '@/features/etb';
export { LAGEKARTE_QUERY_KEYS } from '@/features/lagekarte';
export { SYSTEM_QUERY_KEYS } from '@/features/system';
export { ERINNERUNG_QUERY_KEYS } from '@/features/reminders';

/**
 * @deprecated Verwende direkte Imports aus Features stattdessen
 */
export const QUERY_KEYS = {
  auth: {
    queryKey: ['auth'] as const,
    queries: {
      users: ['auth', 'users'] as const,
      authCheck: ['auth', 'check'] as const,
      adminStatus: ['auth', 'admin', 'status'] as const,
      adminPresence: ['auth', 'admin', 'presence'] as const,
      publicUsers: ['auth', 'public-users'] as const,
    },
  },
  user: USER_QUERY_KEYS,
  users: USERS_QUERY_KEYS,
  admin: ADMIN_QUERY_KEYS,
  health: HEALTH_QUERY_KEYS,
  einsatz: EINSATZ_QUERY_KEYS,
  etb: ETB_QUERY_KEYS,
  lagekarte: LAGEKARTE_QUERY_KEYS,
  system: SYSTEM_QUERY_KEYS,
  erinnerung: ERINNERUNG_QUERY_KEYS,
} as const;
