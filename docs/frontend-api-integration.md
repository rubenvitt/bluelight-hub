# Frontend API Integration - Bluelight Hub

**Generated:** 2025-01-10T20:56:00Z
**Pattern:** TanStack Query + Generated OpenAPI Client

## Core Integration Pattern

### Flow
1. Backend defines OpenAPI endpoints (NestJS + Swagger)
2. `pnpm run generate-api` generates TypeScript client
3. Frontend uses generated client via TanStack Query hooks
4. Optimistic updates, caching, invalidation on query-key basis

### No Manual Fetch Calls
❌ **NEVER** manual `fetch()` or `axios` for backend communication
✅ **ALWAYS** use generated API client from `@bluelight-hub/shared/client`

## Generated API Client

### Setup
**File:** `src/api/api.ts`

```typescript
class BackendApi {
  private configuration: Configuration;
  private healthApi: HealthApi;
  private authApi: AuthApi;
  private einsatzApi: EinsatzApi;
  // ... all other APIs

  constructor() {
    this.configuration = new Configuration({
      basePath: getBaseUrl(), // http://localhost:3090
      fetchApi: fetchWithRefresh, // Auto token refresh
      credentials: 'include', // Cookie-based auth
    });
    // Initialize cached API instances
  }

  health(): HealthApi { return this.healthApi; }
  auth(): AuthApi { return this.authApi; }
  einsatz(): EinsatzApi { return this.einsatzApi; }
  // ... accessor methods
}

export const api = new BackendApi();
```

### Available API Classes

| API Class | Purpose |
|-----------|---------|
| HealthApi | Backend health checks |
| AuthApi | Authentication & registration |
| EinsatzApi | Einsatz CRUD operations |
| ETBApi | Einsatztagebuch management |
| LagekarteApi | Lagekarte state management |
| POIApi | POI CRUD |
| GeocodingApi | Address geocoding |
| UserManagementApi | Admin user management |
| UsersApi | Public user queries |

### Custom Fetch Wrapper
**File:** `src/api/fetchWithRefresh.ts`

**Features:**
- Automatic token refresh on 401
- Prevents multiple simultaneous refresh requests
- Cookie-based authentication
- Retry original request after refresh

## Query Key Structure

### Convention
```typescript
['resource', 'operation', ...identifiers, ...filters]
```

### Examples
- `['auth', 'check']` - Auth status
- `['einsatz', 'list', { status: 'angelegt' }]` - Filtered list
- `['einsatz', 'detail', id]` - Single Einsatz
- `['etb', 'infinite', einsatzId, { limit: 20 }]` - Infinite scroll

### Hierarchical Invalidation
```typescript
// Invalidate ALL einsatz queries
queryClient.invalidateQueries({ queryKey: QUERY_KEYS.einsatz.all }); // ['einsatz']

// Invalidate specific detail
queryClient.invalidateQueries({ queryKey: QUERY_KEYS.einsatz.detail(id) });
```

## TanStack Query Hooks

### Query Hooks (Data Fetching)

| Hook | API Method | Stale Time | Purpose |
|------|------------|------------|---------|
| useAuth | `api.auth().authControllerCheckAuth()` | Default | Check auth status |
| useEinsaetze | `api.einsatz().einsatzControllerFindAllVAlpha()` | 30s | List Einsätze |
| useEinsatz | `api.einsatz().einsatzControllerFindOneVAlpha()` | 30s | Single Einsatz |
| useEtbInfinite | `api.etb().etbControllerGetEtbByEinsatzIdVAlpha()` | 30s | ETB infinite scroll |
| usePois | `api.poi().poiControllerGetPoisVAlpha()` | Default | POIs for Einsatz |

### Mutation Hooks (Data Modification)

| Hook | API Method | Invalidates | Optimistic |
|------|------------|-------------|------------|
| createEinsatz | `api.einsatz().einsatzControllerCreateVAlpha()` | `['einsatz']` | ✅ Yes |
| updateEinsatz | `api.einsatz().einsatzControllerUpdateVAlpha()` | `['einsatz']` | ✅ Yes |
| archiveEinsatz | `api.einsatz().einsatzControllerArchiveVAlpha()` | `['einsatz']` | ✅ Yes |
| createEtbEintrag | `api.etb().etbControllerCreateEintragVAlpha()` | `['etb']` | No |

## Optimistic Updates Pattern

### Create with Optimistic Update
```typescript
const createMutation = useMutation({
  mutationFn: async (data) => {
    const response = await api.einsatz().einsatzControllerCreateVAlpha({ createEinsatzDto: data });
    return response.data;
  },

  onMutate: async (newData) => {
    // Cancel in-flight queries
    await queryClient.cancelQueries({ queryKey: QUERY_KEYS.einsatz.all });

    // Get previous data for rollback
    const previous = queryClient.getQueryData(QUERY_KEYS.einsatz.list(filters));

    // Optimistic update with temp ID
    const optimistic = { id: `temp-${Date.now()}`, ...newData, createdAt: new Date() };
    queryClient.setQueryData(QUERY_KEYS.einsatz.list(filters), (old) => ({
      ...old,
      data: [optimistic, ...(old?.data || [])],
    }));

    return { previous, optimistic };
  },

  onError: (error, _, context) => {
    // Rollback on error
    queryClient.setQueryData(QUERY_KEYS.einsatz.list(filters), context?.previous);
    toast.error('Fehler', { description: 'Erstellung fehlgeschlagen' });
  },

  onSuccess: () => {
    toast.success('Erfolg', { description: 'Erstellt' });
  },

  onSettled: async () => {
    // Refetch real data
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.einsatz.all });
  },
});
```

## Cache Invalidation Strategy

### Hierarchical Invalidation
```typescript
// Update invalidates detail + all lists
updateMutation.onSettled = async () => {
  await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.einsatz.detail(id) });
  await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.einsatz.all });
};

// Create invalidates all lists
createMutation.onSettled = async () => {
  await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.einsatz.all });
};
```

## Special Patterns

### useActiveEinsatz (Persistence)
**Most Important Hook** - Combines TanStack Store + TanStack Query

**Features:**
- Automatic rehydration on app start
- localStorage persistence
- Cross-tab synchronization
- Error recovery
- Cache-first strategy

**API:**
- `setActiveEinsatz(id)` - Activate (checks cache first)
- `clearActiveEinsatz()` - Clear
- `refreshActiveEinsatz()` - Refetch

### Infinite Scrolling
```typescript
const infiniteQuery = useInfiniteQuery({
  queryKey: QUERY_KEYS.einsatz.infinite(filters),
  initialPageParam: 1,
  queryFn: async ({ pageParam }) => {
    return await api.einsatz().einsatzControllerFindAllVAlpha({ page: pageParam, limit });
  },
  getNextPageParam: (lastPage) => {
    const { page, totalPages } = lastPage.pagination || {};
    return page < totalPages ? page + 1 : undefined;
  },
});

const allData = infiniteQuery.data?.pages.flatMap((page) => page.data || []) || [];
```

## Error Handling

### Exponential Backoff
```typescript
function calculateRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30000); // Max 30s
}

const query = useQuery({
  queryKey: [...],
  queryFn: async () => { /* ... */ },
  retry: 3,
  retryDelay: calculateRetryDelay, // 1s, 2s, 4s
});
```

### Toast Notifications
```typescript
onSuccess: () => {
  toast.success('Erfolg', { description: 'Aktion erfolgreich' });
},

onError: async (error: ResponseError) => {
  const message = await getApiErrorMessage(error, 'Aktion fehlgeschlagen', 'context');
  toast.error('Fehler', { description: message });
},
```

## Best Practices

### ✅ DO
1. Use generated API client exclusively
2. TanStack Query hooks for all API calls
3. Centralized query keys in `queryKeys.ts`
4. Optimistic updates for create/update/delete
5. Hierarchical invalidation
6. Exponential backoff retry
7. Toast notifications
8. Stale time: 30s - 5min

### ❌ DON'T
1. Manual `fetch()` calls
2. Write custom API helpers
3. Hardcode query keys
4. Optimistic updates without rollback
5. Forget invalidation after mutations
6. Ignore errors
7. Standard queries for infinite scrolling
8. Too short stale time

**Full Documentation:** Generated by Frontend API Integration Analysis (exhaustive)
