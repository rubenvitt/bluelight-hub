/**
 * Erinnerung Dialog Store
 *
 * Globaler UI-State für Erinnerungs-Dialog mit TanStack Store.
 *
 * **Story 1.1 AC4:** "Erstellen-Button oeffnet Quick-Create Dialog"
 */

import type { ErinnerungResponseDto } from '@/shared';
import { Store, useStore } from '@tanstack/react-store';

/**
 * Erinnerung Dialog State Interface
 *
 * **Story 1.1:** Quick-Create Dialog State
 * **Story 1.3:** Edit Dialog State
 */
export interface ErinnerungDialogState {
  /** Ob der Quick-Create Dialog geoeffnet ist */
  isQuickCreateOpen: boolean;
  /** Einsatz-ID fuer den aktuellen Dialog-Kontext */
  einsatzId: string | null;
  /** Ob der Edit Dialog geoeffnet ist (Story 1.3 AC1) */
  isEditOpen: boolean;
  /** Die zu bearbeitende Erinnerung (Story 1.3 AC1) */
  erinnerungToEdit: ErinnerungResponseDto | null;
}

/**
 * Initial State
 */
const initialState: ErinnerungDialogState = {
  isQuickCreateOpen: false,
  einsatzId: null,
  isEditOpen: false,
  erinnerungToEdit: null,
};

/**
 * Erinnerung Dialog Store
 *
 * Zentrale Store-Instanz fuer Erinnerungs-Dialog-State.
 */
export const erinnerungDialogStore = new Store<ErinnerungDialogState>(initialState);

// ============================================
// Store Actions (Helper Functions)
// ============================================

/**
 * Oeffnet den Quick-Create Dialog fuer einen Einsatz.
 *
 * @param einsatzId - ID des Einsatzes
 */
export const openQuickCreateDialog = (einsatzId: string) => {
  erinnerungDialogStore.setState((state) => ({
    ...state,
    isQuickCreateOpen: true,
    einsatzId,
  }));
};

/**
 * Schliesst den Quick-Create Dialog.
 */
export const closeQuickCreateDialog = () => {
  erinnerungDialogStore.setState((state) => ({
    ...state,
    isQuickCreateOpen: false,
    // einsatzId bleibt erhalten fuer potentielle Wiederverwendung
  }));
};

/**
 * Oeffnet den Edit Dialog fuer eine Erinnerung.
 *
 * **Story 1.3 AC1:** "Dialog oeffnet sich mit den aktuellen Werten"
 *
 * @param erinnerung - Die zu bearbeitende Erinnerung
 * @param einsatzId - ID des Einsatzes
 */
export const openEditDialog = (erinnerung: ErinnerungResponseDto, einsatzId: string) => {
  erinnerungDialogStore.setState((state) => ({
    ...state,
    isEditOpen: true,
    erinnerungToEdit: erinnerung,
    einsatzId,
  }));
};

/**
 * Schliesst den Edit Dialog.
 */
export const closeEditDialog = () => {
  erinnerungDialogStore.setState((state) => ({
    ...state,
    isEditOpen: false,
    erinnerungToEdit: null,
    // einsatzId bleibt erhalten fuer potentielle Wiederverwendung
  }));
};

/**
 * Setzt den Store zurueck.
 */
export const resetErinnerungDialogStore = () => {
  erinnerungDialogStore.setState(initialState);
};

// ============================================
// React Hooks
// ============================================

/**
 * Hook fuer den Quick-Create Dialog State.
 *
 * @returns Tuple aus [isOpen, einsatzId]
 *
 * @example
 * ```tsx
 * const [isOpen, einsatzId] = useQuickCreateDialogState();
 *
 * return (
 *   <QuickCreateErinnerungDialog
 *     isOpen={isOpen}
 *     einsatzId={einsatzId ?? ''}
 *     onClose={closeQuickCreateDialog}
 *   />
 * );
 * ```
 */
export const useQuickCreateDialogState = (): [boolean, string | null] => {
  const isOpen = useStore(erinnerungDialogStore, (state) => state.isQuickCreateOpen);
  const einsatzId = useStore(erinnerungDialogStore, (state) => state.einsatzId);
  return [isOpen, einsatzId];
};

/**
 * Hook fuer den Edit Dialog State.
 *
 * **Story 1.3 AC1:** "Dialog oeffnet sich mit den aktuellen Werten"
 *
 * @returns Tuple aus [isOpen, erinnerungToEdit, einsatzId]
 *
 * @example
 * ```tsx
 * const [isOpen, erinnerung, einsatzId] = useEditDialogState();
 *
 * return (
 *   <ErinnerungEditDialog
 *     isOpen={isOpen}
 *     erinnerung={erinnerung}
 *     einsatzId={einsatzId ?? ''}
 *     onClose={closeEditDialog}
 *   />
 * );
 * ```
 */
export const useEditDialogState = (): [boolean, ErinnerungResponseDto | null, string | null] => {
  const isOpen = useStore(erinnerungDialogStore, (state) => state.isEditOpen);
  const erinnerungToEdit = useStore(erinnerungDialogStore, (state) => state.erinnerungToEdit);
  const einsatzId = useStore(erinnerungDialogStore, (state) => state.einsatzId);
  return [isOpen, erinnerungToEdit, einsatzId];
};
