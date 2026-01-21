/**
 * Erinnerungen Stores Module
 *
 * Zentrale Exporte fuer alle Erinnerungs-Stores.
 *
 * **Story 1.1:** Quick-Create Dialog
 * **Story 1.3:** Edit Dialog
 * **Story 1.4:** Delete Dialog
 * **Story 1.5 Task 13:** Timer Store
 */

export {
  erinnerungDialogStore,
  // Quick-Create Dialog (Story 1.1)
  openQuickCreateDialog,
  closeQuickCreateDialog,
  useQuickCreateDialogState,
  // Edit Dialog (Story 1.3)
  openEditDialog,
  closeEditDialog,
  useEditDialogState,
  // Delete Dialog (Story 1.4)
  openDeleteDialog,
  closeDeleteDialog,
  useDeleteDialogState,
  // Shared
  resetErinnerungDialogStore,
  type ErinnerungDialogState,
} from './erinnerung-dialog.store';

export {
  // Timer Store (Story 1.5 Task 13)
  timerStore,
  TIMER_STORE_KEYS,
  // Timer Actions
  startTimerForErinnerung,
  clearTimerForErinnerung,
  markTimerAsTriggered,
  syncTimersWithErinnerungen,
  setTimerRunning,
  resetTimerStore,
  // Timer Hooks
  useTimerRunning,
  useActiveTimerCount,
  useTriggeredTimerCount,
  useTimerState,
  useTimerStoreState,
  // Types
  type TimerState,
  type TimerStoreState,
} from './timer.store';

export {
  // Offline Store (Story 1.8)
  offlineStore,
  OFFLINE_STORE_KEYS,
  // Offline Actions
  initOfflineStore,
  addPendingErinnerung,
  removePendingErinnerung,
  getPendingErinnerungById,
  queueSyncAction,
  clearProcessedActions,
  updateActionRetryCount,
  setLastSync,
  setOfflineState,
  replaceIdInQueue,
  resetOfflineStore,
  // Offline Hooks
  usePendingErinnerungen,
  useSyncQueueCount,
  useLastSync,
  useOfflineState,
  useOfflineStoreState,
  // Types
  type PendingErinnerung,
  type SyncActionType,
  type SyncQueueAction,
  type OfflineStoreState,
} from './offline.store';
