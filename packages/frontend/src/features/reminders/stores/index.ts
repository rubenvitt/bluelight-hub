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
