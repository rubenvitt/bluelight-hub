/**
 * Notification Navigation Hook
 *
 * Registriert den Navigate-Callback für Deep Link Navigation
 * bei Klick auf Erinnerungs-Notifications.
 *
 * **Wichtig:** Muss in einer Root-Komponente verwendet werden,
 * die Zugriff auf den TanStack Router hat.
 *
 * @example
 * ```tsx
 * // In App.tsx oder Root-Layout
 * function App() {
 *   useNotificationNavigation();
 *   return <RouterProvider router={router} />;
 * }
 * ```
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { setNotificationNavigateCallback } from '../services';
import { logger } from '@/shared/lib/logger';

/**
 * Hook für Notification Deep Link Navigation
 *
 * Registriert einen Callback der bei Klick auf eine Erinnerungs-Notification
 * zur entsprechenden Einsatz-Seite navigiert.
 *
 * Implementiert:
 * - Error Handling für fehlgeschlagene Navigation (F4)
 * - Cleanup bei Unmount um Stale Closures zu vermeiden (F5)
 */
export function useNotificationNavigation(): void {
  const navigate = useNavigate();
  // Ref um zu tracken ob die Komponente noch mounted ist
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Reset mounted flag bei neuem Effect
    isMountedRef.current = true;

    // Registriere Navigate-Callback für Notification-Klicks
    setNotificationNavigateCallback((einsatzId: string, erinnerungId: string) => {
      // F5: Prüfe ob Komponente noch mounted ist
      if (!isMountedRef.current) {
        logger.warn('[NotificationNavigation] Ignoring navigation - component unmounted', {
          einsatzId,
          erinnerungId,
        });
        return;
      }

      logger.info('[NotificationNavigation] Navigating to erinnerung', {
        einsatzId,
        erinnerungId,
      });

      // F4: Wrap navigate in try-catch für Error Handling
      try {
        navigate({
          to: '/app/einsatz/$einsatzId',
          params: { einsatzId },
          search: { erinnerungId },
        });
      } catch (error) {
        logger.error('[NotificationNavigation] Navigation failed', {
          einsatzId,
          erinnerungId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Navigation-Fehler werden geloggt aber nicht an User weitergereicht,
        // da die Notification-Aktion bereits abgeschlossen ist
      }
    });

    logger.debug('[NotificationNavigation] Navigate callback registered');

    // F5: Cleanup-Funktion bei Unmount
    return () => {
      isMountedRef.current = false;
      // Setze Callback auf No-Op um Stale Closures zu vermeiden
      setNotificationNavigateCallback(() => {
        logger.debug('[NotificationNavigation] No-op callback (component unmounted)');
      });
      logger.debug('[NotificationNavigation] Cleanup complete');
    };
  }, [navigate]);
}
