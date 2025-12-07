/**
 * React Query Keys für Auth-Feature
 *
 * Zentralisiert alle Query Keys für Auth-Queries und User-Queries.
 */

const AUTH_QUERY_KEYS = (base: [string]) =>
  ({
    users: [...base, 'users'] as const,
    authCheck: [...base, 'check'] as const,
    adminStatus: [...base, 'admin', 'status'] as const,
    adminPresence: [...base, 'admin', 'presence'] as const,
  }) as const;

export const USERS_QUERY_KEYS = {
  all: ['users'] as const,
  byId: (id?: string) => ['users', id] as const,
} as const;

export const AUTH_KEYS = {
  auth: {
    queryKey: ['auth'] as const,
    queries: AUTH_QUERY_KEYS(['auth']),
  },
  users: USERS_QUERY_KEYS,
} as const;
