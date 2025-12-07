/**
 * Auth API Module
 *
 * Exportiert alle TanStack Query Hooks für Auth und User Management.
 */

export { AUTH_KEYS } from './queries';
export { useCurrentUser, useAdminAuth } from './use-current-user';
export { useUnifiedAuth, useAdminLogin } from './use-login';
export { useLogout, useAdminLogout } from './use-logout';
export { useAdminSetup } from './use-admin-setup';
export { useUsers, useUser, useUserNames } from './use-users';
