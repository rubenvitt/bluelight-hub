/**
 * Erinnerungen Stores Module
 *
 * Zentrale Exporte fuer alle Erinnerungs-Stores.
 *
 * **Story 1.1:** Quick-Create Dialog
 * **Story 1.3:** Edit Dialog
 * **Story 1.4:** Delete Dialog
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
