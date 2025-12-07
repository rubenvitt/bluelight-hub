import { useCurrentUser } from '../api';
import { setRedirectAfterLogin } from '../stores/auth.store';
import { Navigate, useLocation } from '@tanstack/react-router';
import type { ReactNode } from 'react';

interface AuthGuardProps {
  /**
   * Komponente/Inhalt, der nur für authentifizierte Benutzer sichtbar ist
   */
  children: ReactNode;

  /**
   * Fallback-Komponente wenn nicht authentifiziert
   * @default Navigate zu /auth
   */
  fallback?: ReactNode;

  /**
   * Redirect-Pfad wenn nicht authentifiziert
   * @default /auth
   */
  redirectTo?: string;
}

/**
 * Auth Guard Component
 *
 * Schützt Routen vor unautorisierten Zugriffen.
 * Redirected zu Login wenn User nicht authentifiziert ist.
 *
 * @example
 * ```tsx
 * // In Route-Komponente
 * export const DashboardPage = () => {
 *   return (
 *     <AuthGuard>
 *       <Dashboard />
 *     </AuthGuard>
 *   );
 * };
 *
 * // Mit custom Redirect
 * <AuthGuard redirectTo="/custom-login">
 *   <ProtectedContent />
 * </AuthGuard>
 * ```
 */
export const AuthGuard = ({ children, fallback, redirectTo = '/auth' }: AuthGuardProps) => {
  const { user, isLoading } = useCurrentUser();
  const location = useLocation();

  // Während Auth-Check läuft
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Lade...</div>;
  }

  // Nicht authentifiziert
  if (!user) {
    // Speichere aktuelle URL für Redirect nach Login
    setRedirectAfterLogin(location.pathname);

    // Custom Fallback oder Redirect
    if (fallback) {
      return <>{fallback}</>;
    }

    return <Navigate to={redirectTo} />;
  }

  // Authentifiziert - Inhalt anzeigen
  return <>{children}</>;
};

interface AdminGuardProps extends AuthGuardProps {
  /**
   * Redirect-Pfad wenn keine Admin-Rechte
   * @default /unauthorized
   */
  unauthorizedRedirectTo?: string;
}

/**
 * Admin Guard Component
 *
 * Schützt Admin-Routen. Prüft sowohl Authentifizierung als auch Admin-Rolle.
 *
 * @example
 * ```tsx
 * export const AdminSettingsPage = () => {
 *   return (
 *     <AdminGuard>
 *       <AdminSettings />
 *     </AdminGuard>
 *   );
 * };
 * ```
 */
export const AdminGuard = ({ children, fallback, redirectTo = '/auth', unauthorizedRedirectTo = '/unauthorized' }: AdminGuardProps) => {
  const { user, isLoading, isAdminAuthenticated } = useCurrentUser();
  const location = useLocation();

  // Während Auth-Check läuft
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Lade...</div>;
  }

  // Nicht authentifiziert
  if (!user) {
    setRedirectAfterLogin(location.pathname);

    if (fallback) {
      return <>{fallback}</>;
    }

    return <Navigate to={redirectTo} />;
  }

  // Authentifiziert, aber keine Admin-Rechte
  if (!isAdminAuthenticated || !user.role || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return <Navigate to={unauthorizedRedirectTo} />;
  }

  // Admin - Inhalt anzeigen
  return <>{children}</>;
};
