/**
 * Zentrale Definition aller React Query Keys
 *
 * Diese Datei zentralisiert alle Query Keys für eine konsistente
 * und wartbare Verwendung im gesamten Frontend.
 */

const AUTH_QUERY_KEYS = (base: [string]) =>
  ({
    users: [...base, 'users'] as const,
    authCheck: [...base, 'check'] as const,
    adminStatus: [...base, 'admin', 'status'] as const,
    adminPresence: [...base, 'admin', 'presence'] as const,
  }) as const;

export const USER_QUERY_KEYS = {
  users: ['users'] as const,
  publicUsers: ['public-users'] as const,
} as const;

export const USERS_QUERY_KEYS = {
  all: ['users'] as const,
  byId: (id?: string) => ['users', id] as const,
} as const;

export const ADMIN_QUERY_KEYS = {
  users: ['admin', 'users'] as const,
} as const;

export const HEALTH_QUERY_KEYS = {
  health: ['health'] as const,
} as const;

export const EINSATZ_QUERY_KEYS = {
  all: ['einsatz'] as const,
  lists: () => [...EINSATZ_QUERY_KEYS.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...EINSATZ_QUERY_KEYS.lists(), filters].filter((value) => value),
  infiniteLists: () => [...EINSATZ_QUERY_KEYS.all, 'infinite'] as const,
  infinite: (filters?: Record<string, unknown>) => [...EINSATZ_QUERY_KEYS.infiniteLists(), filters].filter((value) => value),
  details: () => [...EINSATZ_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string | null) => [...EINSATZ_QUERY_KEYS.details(), id] as const,
  previous: (id: string) => [...EINSATZ_QUERY_KEYS.all, 'previous', id] as const,
  next: (id: string) => [...EINSATZ_QUERY_KEYS.all, 'next', id] as const,
  completeness: (id: string) => [...EINSATZ_QUERY_KEYS.detail(id), 'completeness'] as const,
  statusCounts: (includeArchived = false) => [...EINSATZ_QUERY_KEYS.all, 'statusCounts', includeArchived] as const,

  // Combined queries for optimized data fetching
  activeWithCounts: () => [...EINSATZ_QUERY_KEYS.all, 'activeWithCounts'] as const,
  detailsCombined: (id: string) => [...EINSATZ_QUERY_KEYS.detail(id), 'combined'] as const,
} as const;

export const ETB_QUERY_KEYS = {
  all: ['etb'] as const,

  // ============================================
  // CQRS Query Keys (neue API)
  // ============================================
  /**
   * Query Key fuer ETB-Abfrage via CQRS API (nach Einsatz-ID)
   *
   * @param einsatzId - Die ID des Einsatzes
   * @param includeDeleted - Optional: Soft-geloeschte Eintraege einschliessen
   */
  byEinsatz: (einsatzId?: string, includeDeleted?: boolean) => [...ETB_QUERY_KEYS.all, 'einsatz', einsatzId, { includeDeleted }] as const,

  /**
   * Query Key fuer ETB-Versionshistorie (Snapshots)
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

export const LAGEKARTE_QUERY_KEYS = {
  all: ['lagekarte'] as const,
  pois: (einsatzId: string) => ['pois', einsatzId] as const,
  lagekarte: (einsatzId: string) => [...LAGEKARTE_QUERY_KEYS.all, einsatzId] as const,
} as const;

// Export all query keys grouped for easier access
export const QUERY_KEYS = {
  auth: {
    queryKey: ['auth'],
    queries: AUTH_QUERY_KEYS(['auth']),
  },
  user: USER_QUERY_KEYS,
  users: USERS_QUERY_KEYS,
  admin: ADMIN_QUERY_KEYS,
  health: HEALTH_QUERY_KEYS,
  einsatz: EINSATZ_QUERY_KEYS,
  etb: ETB_QUERY_KEYS,
  lagekarte: LAGEKARTE_QUERY_KEYS,
} as const;
