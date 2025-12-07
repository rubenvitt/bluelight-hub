import { useEffect, useRef } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useIsTauri } from '@/hooks/useIsTauri';
import { resizeMainWindow, type WindowOrientation } from '@/services/windowService';
import { logger } from '@/utils/logger';

/**
 * Bestimmt die gewünschte Fenster-Orientierung basierend auf dem aktuellen Pfad
 *
 * @param pathname - Der aktuelle Pfad der Anwendung
 * @returns Die gewünschte Orientierung ('portrait' oder 'landscape')
 */
function getOrientationForPath(pathname: string): WindowOrientation {
  // Portrait für Auth-Seiten
  if (pathname.startsWith('/auth') || pathname.startsWith('/admin-login')) {
    return 'portrait';
  }

  // Landscape für alle App-Bereiche (Einsatzliste, Einsatz-Details, etc.)
  if (pathname.startsWith('/app')) {
    return 'landscape';
  }

  // Standard: Portrait
  return 'portrait';
}

/**
 * Hook für automatisches Fenster-Resizing basierend auf der aktuellen Route
 *
 * Dieser Hook überwacht die aktuelle Route und ändert die Fenster-Größe automatisch:
 * - Auth/Login: Portrait (800x1000)
 * - App (Einsatzliste, Einsatz-Details): Landscape (1400x900)
 *
 * Funktioniert nur in Tauri Desktop-App, wird im Browser ignoriert.
 *
 * @example
 * ```tsx
 * function App() {
 *   useWindowOrientation();
 *   return <Outlet />;
 * }
 * ```
 */
export function useWindowOrientation() {
  const { isTauri } = useIsTauri();
  const router = useRouter();
  const previousOrientationRef = useRef<WindowOrientation | null>(null);

  useEffect(() => {
    // Nur in Tauri aktiv
    if (!isTauri) {
      return;
    }

    const pathname = router.state.location.pathname;
    const desiredOrientation = getOrientationForPath(pathname);

    // Nur resizen wenn sich die Orientierung geändert hat
    if (previousOrientationRef.current !== desiredOrientation) {
      logger.log(`useWindowOrientation: Route geändert zu ${pathname}, Orientierung: ${desiredOrientation}`);

      resizeMainWindow(desiredOrientation);
      previousOrientationRef.current = desiredOrientation;
    }
  }, [isTauri, router.state.location.pathname]);
}
