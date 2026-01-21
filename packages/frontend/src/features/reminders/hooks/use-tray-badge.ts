/**
 * Hook für reaktive Tray-Badge Updates - Story 1.9 AC1/AC2
 *
 * Synchronisiert das System-Tray-Badge mit dem Timer Store State.
 * Aktualisiert das Badge automatisch wenn sich die Anzahl der
 * ausgelösten Erinnerungen ändert.
 *
 * AC1: Tray-Badge bei ausgelösten Erinnerungen (count > 0)
 * AC2: Neutrales Icon ohne aktive Alarme (count === 0)
 */

import { useEffect, useRef } from 'react';
import { logger } from '@/shared/lib/logger';
import { trayService } from '../services';
import { useTriggeredTimerCount } from '../stores/timer.store';

/**
 * Hook der das Tray-Badge mit dem Timer Store synchronisiert.
 *
 * Wird in der App-Root oder ErinnerungenProvider eingebunden um
 * das Badge automatisch zu aktualisieren wenn sich Timer-States ändern.
 *
 * @example
 * ```tsx
 * // In App.tsx oder Provider
 * function App() {
 *   useTrayBadge();
 *   return <Router />;
 * }
 * ```
 */
export function useTrayBadge(): void {
  const triggeredCount = useTriggeredTimerCount();
  const lastUpdateRef = useRef<number>(-1);

  useEffect(() => {
    // Optimierung: Nur updaten wenn sich der Count tatsächlich geändert hat
    // (wird auch vom Service gecheckt, aber hier vermeiden wir den async Call)
    if (triggeredCount === lastUpdateRef.current) {
      return;
    }

    lastUpdateRef.current = triggeredCount;

    // Async Badge-Update starten (fire-and-forget)
    trayService.updateBadge(triggeredCount).then((result) => {
      if (!result.success) {
        logger.warn(`[useTrayBadge] Badge-Update fehlgeschlagen: ${result.error}`);
      }
    });
  }, [triggeredCount]);

  // Badge bei Unmount clearen (z.B. wenn App geschlossen wird)
  useEffect(() => {
    return () => {
      // Reset bei Unmount (optional, je nach gewünschtem Verhalten)
      // trayService.clearBadge();
    };
  }, []);
}
