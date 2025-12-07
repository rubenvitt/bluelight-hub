/**
 * Query Keys Factory für Einsatz Feature
 *
 * Zentralisiert alle Query Keys für konsistente Cache-Verwaltung.
 * Folgt dem hierarchischen Pattern von @tanstack/react-query Best Practices.
 */

import type { EinsatzControllerFindAllVAlphaOrderByEnum, EinsatzControllerFindAllVAlphaOrderDirectionEnum, EinsatzControllerFindAllVAlphaStatusEnum } from '@bluelight-hub/shared/client';

/**
 * Filter-Optionen für Einsatz-Queries
 */
export interface EinsatzQueryFilters {
  status?: EinsatzControllerFindAllVAlphaStatusEnum;
  search?: string;
  page?: number;
  limit?: number;
  orderBy?: EinsatzControllerFindAllVAlphaOrderByEnum;
  orderDirection?: EinsatzControllerFindAllVAlphaOrderDirectionEnum;
}

/**
 * Query Keys für Einsatz Feature
 *
 * Hierarchische Struktur ermöglicht granulare Cache-Invalidierung:
 * - EINSATZ_QUERY_KEYS.all - invalidiert alle Einsatz-Queries
 * - EINSATZ_QUERY_KEYS.lists() - invalidiert alle Listen-Queries
 * - EINSATZ_QUERY_KEYS.list(filters) - invalidiert spezifische Listen-Query
 */
export const EINSATZ_QUERY_KEYS = {
  all: ['einsatz'] as const,

  // Listen-Queries
  lists: () => [...EINSATZ_QUERY_KEYS.all, 'list'] as const,
  list: (filters?: EinsatzQueryFilters) => [...EINSATZ_QUERY_KEYS.lists(), filters].filter((value) => value !== undefined) as const,

  // Infinite Scroll Queries
  infiniteLists: () => [...EINSATZ_QUERY_KEYS.all, 'infinite'] as const,
  infinite: (filters?: EinsatzQueryFilters) => [...EINSATZ_QUERY_KEYS.infiniteLists(), filters].filter((value) => value !== undefined) as const,

  // Detail-Queries
  details: () => [...EINSATZ_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string | null) => [...EINSATZ_QUERY_KEYS.details(), id] as const,

  // Spezial-Queries
  previous: (id: string) => [...EINSATZ_QUERY_KEYS.all, 'previous', id] as const,
  next: (id: string) => [...EINSATZ_QUERY_KEYS.all, 'next', id] as const,
  completeness: (id: string) => [...EINSATZ_QUERY_KEYS.detail(id), 'completeness'] as const,
  statusCounts: (includeArchived = false) => [...EINSATZ_QUERY_KEYS.all, 'statusCounts', includeArchived] as const,

  // Optimierte kombinierte Queries
  activeWithCounts: () => [...EINSATZ_QUERY_KEYS.all, 'activeWithCounts'] as const,
  detailsCombined: (id: string) => [...EINSATZ_QUERY_KEYS.detail(id), 'combined'] as const,
} as const;

/**
 * Exponential Backoff Retry-Verzögerung berechnen
 *
 * @param attemptIndex - Index des aktuellen Retry-Versuchs (0-basiert)
 * @returns Verzögerung in Millisekunden (max 30 Sekunden)
 */
export function calculateRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30_000);
}
