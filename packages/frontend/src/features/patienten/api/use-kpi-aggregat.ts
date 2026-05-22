/**
 * Query-Hook für das KPI-Aggregat eines Einsatzes (Story 1.5, AC2).
 *
 * Wrappt den generierten OpenAPI-Client (`api.patienten().patientenControllerKpisVAlpha`)
 * und liefert die TanStack-Query. Mutation-Hooks (use-erfasse-patient,
 * use-sichtung/behandlung/transport-aktualisieren, use-korrigiere-patient)
 * invalidieren `PATIENT_QUERY_KEYS.kpis(einsatzId)` im `onSuccess`/`onSettled`
 * — d. h. das KPI-Aggregat refetched automatisch nach jeder Patient-Mutation.
 *
 * **Verbote:**
 *  - Kein direkter Low-Level-Request, kein eigener API-Wrapper.
 *  - Niemals `fetch()` für API-Calls (CLAUDE.md AC5).
 *
 * **Default-Optionen:**
 *  - `staleTime: 5_000` — kurze Cache-Frische; WS-Push (Story 3.1) wird der
 *    primäre Update-Pfad, KPIs sollen aber sofort frisch sein, falls eine
 *    Mutation die Invalidation triggert.
 *  - `gcTime: 60_000` — Garbage-Collection nach 1 min Inaktivität.
 *  - `refetchOnWindowFocus: false` — Tablet im BHP-Zelt, kein Focus-Refetch.
 */
import { api, type KpiAggregatDto, type ResponseError } from '@/shared';
import { useQuery } from '@tanstack/react-query';
import { PATIENT_QUERY_KEYS } from './queries';

interface UseKpiAggregatOptions {
  /** Query aktivieren — default `true`, falls einsatzId vorhanden. */
  enabled?: boolean;
  /** Auto-Refetch in ms (default off — WS-Push ist primärer Update-Pfad). */
  refetchInterval?: number;
}

export function useKpiAggregat(einsatzId: string, options: UseKpiAggregatOptions = {}) {
  // Story-1.5-Code-Review: Trim-Check vor `enabled`, damit Whitespace-IDs
  // (z. B. `'   '` aus URL-Decoding-Edge-Cases) keinen vermeidbaren
  // `Validation:EinsatzIdErforderlich`-Roundtrip mit 400-Antwort triggern.
  const hasValidEinsatzId = typeof einsatzId === 'string' && einsatzId.trim().length > 0;

  return useQuery<KpiAggregatDto, ResponseError>({
    queryKey: PATIENT_QUERY_KEYS.kpis(einsatzId),
    queryFn: async () => {
      const response = await api.patienten().patientenControllerKpisVAlpha({ einsatzId });
      return response.data;
    },
    enabled: options.enabled ?? hasValidEinsatzId,
    staleTime: 5_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: options.refetchInterval,
  });
}
