import type { ReactNode } from 'react';
import { useCanAccess } from '../../hooks';

interface PermissionGateProps {
  /** Navigationsbereich der geprueft wird (z.B. 'stammdaten') */
  permission: string;
  /** Inhalt der bei Zugang gerendert wird */
  children: ReactNode;
  /** Fallback bei verweigertem Zugang (default: null) */
  fallback?: ReactNode;
  /** Fallback waehrend Permissions geladen werden (default: null) */
  loadingFallback?: ReactNode;
}

/**
 * Gate-Komponente fuer rollenbasierte Zugangssteuerung.
 *
 * Story 5.1 AC1: Rendert children nur wenn der aktuelle Benutzer
 * Zugang zum angegebenen Navigationsbereich hat.
 *
 * @example
 * ```tsx
 * <PermissionGate permission="stammdaten" fallback={<DisabledHint />}>
 *   <StammdatenPanel />
 * </PermissionGate>
 * ```
 */
export function PermissionGate({ permission, children, fallback = null, loadingFallback = null }: PermissionGateProps) {
  const { accessible, isLoading } = useCanAccess(permission);

  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  if (!accessible) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
