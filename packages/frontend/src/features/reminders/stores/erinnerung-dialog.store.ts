/**
 * Erinnerung Dialog Store
 *
 * Globaler UI-State für Erinnerungs-Dialog mit TanStack Store.
 *
 * **Story 1.1 AC4:** "Erstellen-Button oeffnet Quick-Create Dialog"
 */

import { Store, useStore } from '@tanstack/react-store';

/**
 * Erinnerung Dialog State Interface
 */
export interface ErinnerungDialogState {
  /** Ob der Quick-Create Dialog geoeffnet ist */
  isQuickCreateOpen: boolean;
  /** Einsatz-ID fuer den aktuellen Dialog-Kontext */
  einsatzId: string | null;
}

/**
 * Initial State
 */
const initialState: ErinnerungDialogState = {
  isQuickCreateOpen: false,
  einsatzId: null,
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
