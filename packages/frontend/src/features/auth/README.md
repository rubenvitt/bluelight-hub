# Auth Feature Module

TanStack-Native Feature Architecture für Authentication & User Management.

## Struktur

```
features/auth/
├── api/                      # TanStack Query Hooks
│   ├── queries.ts           # Query Keys (AUTH_KEYS)
│   ├── use-current-user.ts  # Current User Query + useAdminAuth
│   ├── use-login.ts         # Login Mutations (Unified + Admin)
│   ├── use-logout.ts        # Logout Mutations (User + Admin)
│   ├── use-admin-setup.ts   # Admin Setup Mutation
│   ├── use-users.ts         # User List + User Details + User Names
│   └── index.ts             # API Exports
├── stores/
│   └── auth.store.ts        # TanStack Store (UI State)
├── guards/
│   └── auth-guard.tsx       # Route Protection (AuthGuard, AdminGuard)
└── index.ts                 # Feature Exports
```

## API Hooks

### Authentication

```typescript
import { useCurrentUser, useAdminAuth, useUnifiedAuth, useAdminLogin, useLogout, useAdminLogout } from '@/features/auth';

// Current User
const { user, isAdminAuthenticated, isLoading, adminStatus } = useCurrentUser();

// Admin Auth Check
const { isAdmin, hasAdminSession } = useAdminAuth();

// Login
const { mutate: login } = useUnifiedAuth();
login({ username, password }, {
  onSuccess: () => navigate('/dashboard')
});

// Admin Login
const { mutate: loginAdmin } = useAdminLogin();
loginAdmin({ password }, {
  onSuccess: () => navigate('/admin')
});

// Logout
const { mutate: logout } = useLogout();
logout();

// Admin Logout (behält User-Session)
const { mutate: logoutAdmin } = useAdminLogout();
logoutAdmin();
```

### User Management

```typescript
import { useUsers, useUser, useUserNames } from '@/features/auth';

// Alle Benutzer
const { data: users, isLoading } = useUsers();

// Einzelner Benutzer
const { data: user } = useUser(userId);

// User-Namen auflösen
const { getUserName, getUserNames } = useUserNames();
const name = getUserName('user-id-123'); // "Max Mustermann"
const names = getUserNames(['id-1', 'id-2']); // ["Max", "Maria"]
```

### Admin Setup

```typescript
import { useAdminSetup } from '@/features/auth';

const { mutate: setupAdmin } = useAdminSetup();
setupAdmin({ username, password }, {
  onSuccess: () => navigate('/admin')
});
```

## Store

```typescript
import { authStore, setAuthStatus, setShowReauthModal, setRedirectAfterLogin, resetAuthStore } from '@/features/auth';

// Auth-Status setzen
setAuthStatus('authenticated');

// Re-Auth Modal anzeigen
setShowReauthModal(true);

// Redirect nach Login
setRedirectAfterLogin('/dashboard');

// Store zurücksetzen
resetAuthStore();
```

## Guards

### AuthGuard

Schützt Routen vor unautorisierten Zugriffen:

```typescript
import { AuthGuard } from '@/features/auth';

export const DashboardPage = () => {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
};

// Mit custom Redirect
<AuthGuard redirectTo="/custom-login">
  <ProtectedContent />
</AuthGuard>

// Mit custom Fallback
<AuthGuard fallback={<LoginPrompt />}>
  <ProtectedContent />
</AuthGuard>
```

### AdminGuard

Schützt Admin-Routen (prüft Rolle + Admin-Session):

```typescript
import { AdminGuard } from '@/features/auth';

export const AdminSettingsPage = () => {
  return (
    <AdminGuard>
      <AdminSettings />
    </AdminGuard>
  );
};
```

## Query Keys

Alle Query Keys sind in `AUTH_KEYS` zentralisiert:

```typescript
import { AUTH_KEYS } from '@/features/auth';

// Auth Keys
AUTH_KEYS.auth.queryKey              // ['auth']
AUTH_KEYS.auth.queries.authCheck     // ['auth', 'check']
AUTH_KEYS.auth.queries.adminStatus   // ['auth', 'admin', 'status']

// User Keys
AUTH_KEYS.users.all                  // ['users']
AUTH_KEYS.users.byId(id)             // ['users', id]
```

## Migration von Legacy Hooks

### Vorher (Legacy)

```typescript
// packages/frontend/src/hooks/useAuth.ts
import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useUsers, useUserNames } from '@/hooks/useUsers';

const { user, logout, unifiedAuth } = useAuth();
const { isAdmin } = useAdminAuth();
const { data: users } = useUsers();
```

### Nachher (Feature Module)

```typescript
// packages/frontend/src/features/auth
import {
  useCurrentUser,
  useAdminAuth,
  useLogout,
  useUnifiedAuth,
  useUsers,
  useUserNames
} from '@/features/auth';

const { user } = useCurrentUser();
const { mutate: logout } = useLogout();
const { mutate: login } = useUnifiedAuth();
const { isAdmin } = useAdminAuth();
const { data: users } = useUsers();
```

## Design Principles

1. **TanStack Query**: Alle API-Calls via TanStack Query Hooks
2. **TanStack Store**: UI-State (kein Token-Storage!)
3. **Generierter API-Client**: Import von `@bluelight-hub/shared/client`
4. **Deutsche JSDoc**: Alle Funktionen dokumentiert
5. **Separation of Concerns**: API / Store / Guards getrennt
6. **Type Safety**: Vollständige TypeScript-Typen
7. **Reusability**: Hooks sind wiederverwendbar und komponierbar

## Best Practices

- **Token Management**: Erfolgt server-seitig via HTTP-Only Cookies (NICHT im Store!)
- **Query Invalidation**: Nach Mutations IMMER relevante Queries invalidieren
- **Error Handling**: Wird global via `handleQueryError` gehandhabt
- **Loading States**: IMMER `isLoading` prüfen vor Zugriff auf `data`
- **Guards**: Für Route Protection statt manuelle Checks in Komponenten
