import { api } from '@/api';
import { AUTH_KEYS } from './queries';
import { useQuery } from '@tanstack/react-query';
import { milliseconds } from 'date-fns';

/**
 * Hook zum Abrufen des aktuell eingeloggten Benutzers
 *
 * Führt einen Auth-Check durch und gibt Benutzer-Informationen zurück.
 *
 * @returns Query-Ergebnis mit User-Daten, Admin-Status und Loading-State
 *
 * @example
 * ```tsx
 * const { user, isAdminAuthenticated, isLoading } = useCurrentUser();
 *
 * if (isLoading) return <Spinner />;
 * if (!user) return <LoginPrompt />;
 *
 * return <UserProfile user={user} />;
 * ```
 */
export const useCurrentUser = () => {
  const authCheckQuery = useQuery({
    queryKey: AUTH_KEYS.auth.queries.authCheck,
    queryFn: () => api.auth().authControllerCheckAuth(),
    retry: 2,
  });

  // Admin-Status nur für eingeloggte Admins abfragen
  const isAdmin = !!authCheckQuery.data?.user && authCheckQuery.data.user.role?.includes('ADMIN');

  const adminStatusQuery = useQuery({
    queryKey: AUTH_KEYS.auth.queries.adminStatus,
    queryFn: () => api.auth().authControllerGetAdminStatus(),
    staleTime: milliseconds({ seconds: 30 }),
    refetchInterval: isAdmin ? milliseconds({ seconds: 30 }) : false,
    throwOnError: false,
    refetchOnWindowFocus: true,
    retry: false,
    enabled: isAdmin,
  });

  return {
    /**
     * Loading-State (AuthCheck oder AdminStatus lädt)
     */
    isLoading: authCheckQuery.isLoading || adminStatusQuery.isLoading,

    /**
     * Aktuell eingeloggter Benutzer (null wenn nicht eingeloggt)
     */
    user: authCheckQuery.data?.user,

    /**
     * Ist der Benutzer als Admin authentifiziert?
     */
    isAdminAuthenticated: authCheckQuery.data?.isAdminAuthenticated,

    /**
     * Admin-Status (Setup verfügbar, etc.)
     */
    adminStatus: adminStatusQuery.isFetched
      ? {
          adminSetupAvailable: adminStatusQuery.data?.adminSetupAvailable,
        }
      : undefined,

    /**
     * Raw Query-Objekt für erweiterte Verwendung
     */
    query: authCheckQuery,
  };
};

/**
 * Hook für Admin-spezifische Auth-Checks
 *
 * Erweitert useCurrentUser um Admin-spezifische Prüfungen.
 *
 * @returns Admin-Auth-State mit erweiterten Flags
 *
 * @example
 * ```tsx
 * const { isAdmin, hasAdminSession } = useAdminAuth();
 *
 * if (!isAdmin) {
 *   return <Redirect to="/unauthorized" />;
 * }
 * ```
 */
export const useAdminAuth = () => {
  const { user, isAdminAuthenticated, isLoading } = useCurrentUser();

  // isAdmin prüft sowohl Admin-Auth als auch die Rolle
  const isAdmin = isAdminAuthenticated && user?.role && ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

  // hasAdminSession prüft nur ob Admin-Token vorhanden ist (unabhängig von der Rolle)
  const hasAdminSession = isAdminAuthenticated;

  return {
    /**
     * Hat der User Admin-Rechte? (prüft Token UND Rolle)
     */
    isAdmin,

    /**
     * Existiert eine Admin-Session? (nur Token-Check)
     */
    hasAdminSession,

    /**
     * Ist der User als Admin authentifiziert? (nur Token-Check)
     */
    isAdminAuthenticated,

    /**
     * Loading-State
     */
    isLoading,

    /**
     * Aktueller User
     */
    user,
  };
};
