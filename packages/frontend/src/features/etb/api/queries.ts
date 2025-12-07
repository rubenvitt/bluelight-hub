/**
 * ETB Query Keys
 *
 * Zentralisierte Query Keys für ETB-Feature mit CQRS API Support.
 */

export const ETB_QUERY_KEYS = {
  all: ['etb'] as const,

  // ============================================
  // CQRS Query Keys (neue API)
  // ============================================
  /**
   * Query Key für ETB-Abfrage via CQRS API (nach Einsatz-ID)
   *
   * @param einsatzId - Die ID des Einsatzes
   * @param includeDeleted - Optional: Soft-gelöschte Einträge einschließen
   */
  byEinsatz: (einsatzId?: string, includeDeleted?: boolean) => [...ETB_QUERY_KEYS.all, 'einsatz', einsatzId, { includeDeleted }] as const,

  /**
   * Query Key für ETB-Versionshistorie (Snapshots)
   *
   * @param etbId - Die ID des ETB
   */
  history: (etbId: string) => [...ETB_QUERY_KEYS.all, etbId, 'history'] as const,

  // ============================================
  // Legacy Query Keys (Backward Compatibility)
  // ============================================
  /** @deprecated Verwende byEinsatz(einsatzId, includeDeleted) stattdessen */
  byEinsatzLegacy: (einsatzId?: string, page?: number, limit?: number) => [...ETB_QUERY_KEYS.all, 'einsatz-legacy', einsatzId, { page, limit }] as const,

  /** @deprecated Wird durch CQRS API ersetzt */
  infinite: (einsatzId?: string, limit?: number, sortBy?: string, sortOrder?: 'asc' | 'desc', includeDeleted?: boolean) =>
    [...ETB_QUERY_KEYS.all, 'infinite', einsatzId, { limit, sortBy, sortOrder, includeDeleted }] as const,

  eintraege: (etbId: string) => [...ETB_QUERY_KEYS.all, etbId, 'eintraege'] as const,
  eintrag: (eintragId: string) => [...ETB_QUERY_KEYS.all, 'eintrag', eintragId] as const,
  eintragHistory: (eintragId: string, page?: number, limit?: number) => [...ETB_QUERY_KEYS.all, 'eintrag', eintragId, 'history', { page, limit }] as const,
  textbausteine: () => [...ETB_QUERY_KEYS.all, 'textbausteine'] as const,
} as const;

/**
 * Exponential Backoff Retry-Verzögerung berechnen
 *
 * Berechnet eine exponentielle Backoff-Verzögerung für TanStack Query Retry-Logik.
 * Maximum bei 30 Sekunden gekappt.
 *
 * @param attemptIndex - 0-basierter Retry-Versuch Index
 * @returns Verzögerung in Millisekunden
 */
export function calculateRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30000);
}
