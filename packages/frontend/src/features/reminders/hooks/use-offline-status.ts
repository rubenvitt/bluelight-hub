/**
 * useOfflineStatus Hook
 *
 * Kombiniert Offline Detection Service und Offline Store
 * fuer einen einheitlichen Offline-Status in React Components.
 *
 * **Story 1.8 AC1, AC3:**
 * - isOffline: Aktueller Offline-Status
 * - offlineSince: Zeitpunkt seit dem offline
 * - pendingActionsCount: Anzahl ausstehender Sync-Aktionen
 */

import { useEffect, useState } from 'react';
import { offlineDetectionService, type OfflineState } from '../services/offline-detection.service';
import { useSyncQueueCount } from '../stores/offline.store';

/**
 * Return-Typ des useOfflineStatus Hooks
 */
export interface UseOfflineStatusReturn {
  /** True wenn keine Netzwerkverbindung besteht */
  isOffline: boolean;
  /** Zeitpunkt seit dem offline (null wenn online) */
  offlineSince: Date | null;
  /** Anzahl der ausstehenden Sync-Aktionen */
  pendingActionsCount: number;
}

/**
 * Hook fuer den kombinierten Offline-Status
 *
 * Kombiniert den Offline Detection Service Status mit der Sync-Queue
 * aus dem Offline Store fuer eine einheitliche Offline-Experience.
 *
 * **AC1:** Zeigt Offline-Status fuer UI-Feedback (Banner)
 * **AC3:** Zeigt pendingActionsCount fuer Sync-Fortschritt
 *
 * @returns Offline-Status mit isOffline, offlineSince und pendingActionsCount
 *
 * @example
 * ```tsx
 * function ErinnerungenPanel() {
 *   const { isOffline, offlineSince, pendingActionsCount } = useOfflineStatus();
 *
 *   return (
 *     <>
 *       {isOffline && (
 *         <OfflineBanner
 *           pendingCount={pendingActionsCount}
 *           offlineSince={offlineSince}
 *         />
 *       )}
 *       {// ... rest of component}
 *     </>
 *   );
 * }
 * ```
 */
export function useOfflineStatus(): UseOfflineStatusReturn {
  // Offline Detection Service State (via useState + effect subscription)
  const [offlineState, setOfflineState] = useState<OfflineState>(() => offlineDetectionService.getState());

  // Subscribe to Offline Detection Service
  useEffect(() => {
    const unsubscribe = offlineDetectionService.subscribe((state) => {
      setOfflineState(state);
    });

    return unsubscribe;
  }, []);

  // Sync Queue Count (via TanStack Store's useStore hook)
  const pendingActionsCount = useSyncQueueCount();

  return {
    isOffline: offlineState.isOffline,
    offlineSince: offlineState.offlineSince,
    pendingActionsCount,
  };
}
