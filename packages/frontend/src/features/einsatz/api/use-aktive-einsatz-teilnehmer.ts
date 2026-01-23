/**
 * Query Hook für aktive Einsatz-Teilnehmer
 *
 * Story 3.3: Erinnerung einer anderen Person zuweisen
 * Lädt alle aktiven Teilnehmer eines Einsatzes für das "Zuweisen an" Dropdown.
 *
 * @module features/einsatz/api
 */

import { api } from '@/shared';
import { logger } from '@/shared/lib/logger';
import type { AktiveTeilnehmerResponseDto, ResponseError } from '@/shared';
import { useQuery } from '@tanstack/react-query';
import { calculateRetryDelay, EINSATZ_QUERY_KEYS } from './queries';

/**
 * Query Key Factory für aktive Einsatz-Teilnehmer
 *
 * Erweiterung der EINSATZ_QUERY_KEYS für Story 3.3.
 * Separat definiert um Collisions mit bestehenden Keys zu vermeiden.
 */
export const AKTIVE_TEILNEHMER_QUERY_KEYS = {
  byEinsatz: (einsatzId: string) => [...EINSATZ_QUERY_KEYS.detail(einsatzId), 'aktiveTeilnehmer'] as const,
} as const;

/**
 * Hook zum Laden aller aktiven Einsatz-Teilnehmer
 *
 * **Story 3.3 AC1:** "sehe ich alle aktiven Einsatz-Teilnehmer als Auswahl"
 *
 * Gibt Teilnehmer mit userId, username, funkrufname und joinedAt zurück.
 * Nur Teilnehmer mit leftAt === null (noch aktiv im Einsatz).
 *
 * @param einsatzId - UUID des Einsatzes (null/undefined disables query)
 * @param options - Optionale Query-Optionen (enabled, etc.)
 * @returns TanStack Query Result mit AktiveTeilnehmerResponseDto Array
 *
 * @example
 * ```tsx
 * const { data: teilnehmer, isLoading } = useAktiveEinsatzTeilnehmer(einsatzId);
 *
 * if (isLoading) return <Loading />;
 *
 * return (
 *   <Select>
 *     {teilnehmer?.map((t) => (
 *       <option key={t.userId} value={t.userId}>
 *         {t.username} ({t.funkrufname})
 *       </option>
 *     ))}
 *   </Select>
 * );
 * ```
 */
export const useAktiveEinsatzTeilnehmer = (einsatzId: string | null | undefined, options?: { enabled?: boolean }) => {
  return useQuery<AktiveTeilnehmerResponseDto[], ResponseError>({
    queryKey: AKTIVE_TEILNEHMER_QUERY_KEYS.byEinsatz(einsatzId ?? ''),
    queryFn: async () => {
      if (!einsatzId) {
        return [];
      }
      logger.debug('Fetching aktive Einsatz-Teilnehmer', { einsatzId });
      // WrappedResponse: { data: [...], meta: {...} }
      const response = await api.einsatz().einsatzControllerGetTeilnehmerVAlpha({ id: einsatzId });
      return response.data;
    },
    enabled: !!einsatzId && (options?.enabled ?? true),
    staleTime: 30_000, // 30 Sekunden - Teilnehmerliste ändert sich selten
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};
