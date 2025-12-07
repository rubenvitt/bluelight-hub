# ETB Feature (Einsatztagebuch)

TanStack-Native Feature Architecture für das Einsatztagebuch.

## Struktur

```
features/etb/
├── api/                           # TanStack Query Hooks
│   ├── queries.ts                 # Query Keys + Retry Logic
│   ├── use-etb.ts                 # ETB Query (by Einsatz-ID)
│   ├── use-etb-history.ts         # ETB Versionshistorie (Snapshots)
│   ├── use-etb-infinite.ts        # ETB Infinite Query (Legacy)
│   ├── use-textbausteine.ts       # Textbausteine Query
│   ├── use-create-entry.ts        # Create Entry Mutation
│   ├── use-update-entry.ts        # Update Entry Mutation
│   ├── use-delete-entry.ts        # Delete Entry Mutation (Soft Delete)
│   ├── use-lock-etb.ts            # Lock ETB Mutation (Admin-Only)
│   ├── use-etb-operations.ts      # Combined Operations Hook
│   └── index.ts                   # Public API
└── index.ts                       # Feature Public API
```

## Migration Guide

### Alte Import-Pfade (DEPRECATED)

```typescript
// ❌ ALT (deprecated)
import { useEtb, useCreateEtbEintrag } from '@/hooks/useEtb';
```

### Neue Import-Pfade

```typescript
// ✅ NEU (empfohlen)
import { useEtb, useCreateEtbEntry } from '@/features/etb';
```

## Verwendung

### ETB Query (CQRS API)

```typescript
import { useEtb } from '@/features/etb';

function EtbView({ einsatzId }: { einsatzId: string }) {
  const { data: etb, isLoading, error } = useEtb({
    einsatzId,
    includeDeleted: false, // optional
  });

  if (isLoading) return <Spinner />;
  if (!etb) return <EmptyState>Noch kein ETB vorhanden</EmptyState>;

  return <EtbTable entries={etb.eintraege} />;
}
```

### ETB History (Snapshots)

```typescript
import { useEtbHistory } from '@/features/etb';

function EtbHistoryModal({ etbId }: { etbId: string }) {
  const { data: snapshots, isLoading } = useEtbHistory({ etbId });

  if (isLoading) return <Spinner />;
  if (!snapshots?.length) return <EmptyState>Keine Historie</EmptyState>;

  return <HistoryTimeline snapshots={snapshots} />;
}
```

### Create Entry Mutation

```typescript
import { useCreateEtbEntry } from '@/features/etb';

function EtbEntryForm({ etbId }: { etbId: string }) {
  const createEntry = useCreateEtbEntry();

  const handleSubmit = (data: AddEintragDto) => {
    createEntry.mutate({
      etbId,
      data,
    });
  };

  return <Form onSubmit={handleSubmit} isLoading={createEntry.isPending} />;
}
```

### Combined Operations Hook

```typescript
import { useEtbOperations } from '@/features/etb';

function EtbPage({ einsatzId }: { einsatzId: string }) {
  const {
    etb,
    isLoadingEtb,
    textbausteine,
    createEintrag,
    updateEintrag,
    deleteEintrag,
    lockEtb,
    isCreatingEintrag,
  } = useEtbOperations({ einsatzId });

  // Alle ETB-Operationen verfügbar
}
```

## API Naming Conventions

### Hooks

- **Query Hooks:** `use<Resource>` (z.B. `useEtb`, `useEtbHistory`)
- **Mutation Hooks:** `use<Action><Resource>` (z.B. `useCreateEtbEntry`, `useUpdateEtbEntry`)
- **Combined Hooks:** `use<Resource>Operations` (z.B. `useEtbOperations`)

### Mutation Variables

Alle Mutation Hooks exportieren ein `<MutationName>Variables` Interface:

- `CreateEtbEntryVariables`
- `UpdateEtbEntryVariables`
- `DeleteEtbEntryVariables`
- `LockEtbVariables`

### Options Interfaces

Alle Query Hooks exportieren ein `Use<HookName>Options` Interface:

- `UseEtbOptions`
- `UseEtbHistoryOptions`
- `UseEtbInfiniteOptions`
- `UseEtbOperationsOptions`

## Query Keys

Alle Query Keys sind in `ETB_QUERY_KEYS` definiert:

```typescript
import { ETB_QUERY_KEYS } from '@/features/etb';

// CQRS Query Keys
ETB_QUERY_KEYS.byEinsatz(einsatzId, includeDeleted);
ETB_QUERY_KEYS.history(etbId);
ETB_QUERY_KEYS.textbausteine();

// Legacy Query Keys (deprecated)
ETB_QUERY_KEYS.infinite(einsatzId, limit, sortBy, sortOrder, includeDeleted);
```

## Error Handling

Alle Mutations verwenden automatisch:

- **Error Toast:** Benutzerfreundliche Fehlermeldungen via `toast.error()`
- **Success Toast:** Erfolgsbestätigungen via `toast.success()`
- **Query Invalidation:** Automatische Aktualisierung aller ETB-Queries nach Erfolg
- **Retry Logic:** 3 Retries mit exponential backoff

## Legacy Support

### `useEtbInfinite` (DEPRECATED)

Für Komponenten die noch Infinite Scrolling verwenden:

```typescript
import { useEtbInfinite } from '@/features/etb';

// ⚠️ DEPRECATED: Für neue Features bitte `useEtb` verwenden
const { data, fetchNextPage, hasNextPage } = useEtbInfinite({
  einsatzId,
  limit: 20,
  sortBy: 'timestamp',
  sortOrder: 'desc',
});
```

**Migration:** Verwende `useEtb` stattdessen, da die CQRS API alle Einträge auf einmal zurückgibt.

## Backward Compatibility

Der alte Hook-Pfad `/hooks/useEtb.ts` bleibt vorerst bestehen für schrittweise Migration.
Neue Features sollten IMMER `/features/etb` verwenden.

## Best Practices

1. **Immer typisierte Options verwenden:**
   ```typescript
   useEtb({ einsatzId, includeDeleted: false })
   ```

2. **Mutation States für Loading abfragen:**
   ```typescript
   const createEntry = useCreateEtbEntry();
   return <Button disabled={createEntry.isPending} />;
   ```

3. **Error Handling ist automatisch:**
   Keine manuellen try/catch Blöcke nötig - Toasts werden automatisch angezeigt.

4. **Query Invalidation ist automatisch:**
   Nach jeder Mutation werden alle ETB-Queries automatisch invalidiert.

## Weitere Informationen

- **CQRS API Dokumentation:** `/docs/backend-api-contracts/`
- **TanStack Query Docs:** https://tanstack.com/query
- **Alte Hook-Dokumentation:** `/packages/frontend/src/hooks/ETB_USAGE.md`
