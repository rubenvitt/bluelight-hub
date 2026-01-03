/**
 * Query Keys Factory für Admin Feature
 *
 * Zentralisiert alle Query Keys für konsistente Cache-Verwaltung.
 * Folgt dem hierarchischen Pattern von @tanstack/react-query Best Practices.
 */

/**
 * Query Keys für Admin Feature
 *
 * Hierarchische Struktur ermöglicht granulare Cache-Invalidierung:
 * - ADMIN_QUERY_KEYS.all - invalidiert alle Admin-Queries
 * - ADMIN_QUERY_KEYS.users - invalidiert User-Management-Queries
 * - ADMIN_QUERY_KEYS.kraefte.qualifikationen - invalidiert Qualifikationen-Queries
 * - ADMIN_QUERY_KEYS.stammdaten.fahrzeuge - invalidiert StammFahrzeuge-Queries
 * - ADMIN_QUERY_KEYS.stammdaten.personen - invalidiert StammPersonen-Queries
 */
export const ADMIN_QUERY_KEYS = {
  all: ['admin'] as const,
  users: ['admin', 'users'] as const,
  kraefte: {
    all: ['admin', 'kraefte'] as const,
    qualifikationen: {
      all: () => [...ADMIN_QUERY_KEYS.kraefte.all, 'qualifikationen'] as const,
      list: (filters?: { istAktiv?: boolean }) => [...ADMIN_QUERY_KEYS.kraefte.qualifikationen.all(), 'list', filters].filter((v) => v !== undefined) as const,
      detail: (id: string) => [...ADMIN_QUERY_KEYS.kraefte.qualifikationen.all(), 'detail', id] as const,
    },
    rollenDefinitionen: {
      all: () => [...ADMIN_QUERY_KEYS.kraefte.all, 'rollenDefinitionen'] as const,
      list: (filters?: { istAktiv?: boolean }) => [...ADMIN_QUERY_KEYS.kraefte.rollenDefinitionen.all(), 'list', filters].filter((v) => v !== undefined) as const,
      detail: (id: string) => [...ADMIN_QUERY_KEYS.kraefte.rollenDefinitionen.all(), 'detail', id] as const,
    },
  },
  stammdaten: {
    all: ['admin', 'stammdaten'] as const,
    fahrzeuge: {
      all: () => [...ADMIN_QUERY_KEYS.stammdaten.all, 'fahrzeuge'] as const,
      list: (filters?: { includeArchived?: boolean }) => [...ADMIN_QUERY_KEYS.stammdaten.fahrzeuge.all(), 'list', filters].filter((v) => v !== undefined) as const,
      detail: (id: string) => [...ADMIN_QUERY_KEYS.stammdaten.fahrzeuge.all(), 'detail', id] as const,
    },
    personen: {
      all: () => [...ADMIN_QUERY_KEYS.stammdaten.all, 'personen'] as const,
      list: (filters?: { includeArchived?: boolean }) => [...ADMIN_QUERY_KEYS.stammdaten.personen.all(), 'list', filters].filter((v) => v !== undefined) as const,
      detail: (id: string) => [...ADMIN_QUERY_KEYS.stammdaten.personen.all(), 'detail', id] as const,
    },
  },
  integrations: {
    all: ['admin', 'integrations'] as const,
    hiorg: {
      all: () => [...ADMIN_QUERY_KEYS.integrations.all, 'hiorg'] as const,
      credentials: () => [...ADMIN_QUERY_KEYS.integrations.hiorg.all(), 'credentials'] as const,
      preview: (filters?: { activeOnly?: boolean }) => [...ADMIN_QUERY_KEYS.integrations.hiorg.all(), 'preview', filters].filter((v) => v !== undefined) as const,
    },
  },
} as const;
