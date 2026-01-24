import { getBaseUrl } from '@/shared/api/api';
import { fetchWithRefresh } from '@/shared/api/fetchWithRefresh';
import { useQuery } from '@tanstack/react-query';
import { getMismatchSeverity, type MismatchSeverity } from '../utils/version';
import { SYSTEM_QUERY_KEYS } from './queries';

/**
 * Response-Struktur vom Root-Endpoint
 */
interface RootResponse {
  message: string;
  version?: string;
  endpoints: {
    api: string;
  };
}

/**
 * Ruft die Backend-Version vom Root-Endpoint ab
 *
 * Der generierte API-Client typisiert die Root-Response als void,
 * daher nutzen wir hier einen direkten fetch mit korrekter Typisierung.
 * fetchWithRefresh wird verwendet um den Server Access Token Header mitzuschicken.
 *
 * @param baseUrl - Die Server-URL vom Aufrufer (vermeidet doppelten getBaseUrl() Aufruf)
 */
async function fetchBackendVersion(baseUrl: string): Promise<string | undefined> {
  const response = await fetchWithRefresh(baseUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch backend version: ${response.status}`);
  }

  const data: RootResponse = await response.json();
  return data.version;
}

/**
 * Hook zum Abrufen und Vergleichen von Frontend- und Backend-Version
 *
 * Holt die Backend-Version vom Root-Endpoint und vergleicht sie
 * mit der Frontend-Version (`__APP_VERSION__` aus Vite define).
 *
 * @returns Query-Ergebnis mit Versions und Mismatch-Severity
 *
 * @example
 * ```tsx
 * const { frontendVersion, backendVersion, mismatchSeverity } = useSystemVersion();
 *
 * if (mismatchSeverity === 'critical') {
 *   return <Banner>Update erforderlich!</Banner>;
 * }
 * ```
 */
export const useSystemVersion = () => {
  // Query nur ausführen wenn ein Server konfiguriert ist
  const baseUrl = getBaseUrl();
  const isServerConfigured = !!baseUrl;

  const query = useQuery({
    queryKey: SYSTEM_QUERY_KEYS.version(),
    // baseUrl ist garantiert truthy wenn enabled=true, daher as string statt non-null assertion
    queryFn: () => fetchBackendVersion(baseUrl as string),
    // Nur ausführen wenn Server konfiguriert - verhindert SyntaxError bei leerem URL
    enabled: isServerConfigured,
    // Version ändert sich nicht während einer Session, daher nie als stale markieren
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const frontendVersion = __APP_VERSION__;
  const backendVersion = query.data ?? undefined;

  const mismatchSeverity: MismatchSeverity = backendVersion && frontendVersion ? getMismatchSeverity(frontendVersion, backendVersion) : 'none';

  return {
    frontendVersion,
    backendVersion,
    mismatchSeverity,
    isLoading: query.isLoading,
    isError: query.isError,
    query,
  };
};
