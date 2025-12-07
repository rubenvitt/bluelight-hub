/**
 * Auth Feature Module
 *
 * TanStack-Native Feature Architecture für Authentication & User Management.
 *
 * @module features/auth
 */

// API Hooks
export * from './api';

// Guards
export { AuthGuard, AdminGuard } from './guards/auth-guard';

// Stores
export { authStore, setAuthStatus, setShowReauthModal, setRedirectAfterLogin, resetAuthStore } from './stores/auth.store';
