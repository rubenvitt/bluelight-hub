/**
 * Combined ETB Operations Hook
 *
 * Convenience Hook der alle ETB-Operationen kombiniert.
 */

import { useCreateEtbEntry } from './use-create-entry';
import { useDeleteEtbEntry } from './use-delete-entry';
import { useEtb } from './use-etb';
import { useLockEtb } from './use-lock-etb';
import { useTextbausteine } from './use-textbausteine';
import { useUpdateEtbEntry } from './use-update-entry';

export interface UseEtbOperationsOptions {
  /**
   * Einsatz-ID für ETB-Abfrage
   */
  einsatzId?: string;

  /**
   * Gelöschte Einträge einschließen
   *
   * @default false
   */
  includeDeleted?: boolean;
}

/**
 * Kombinierter Hook für alle ETB-Operationen (CQRS)
 *
 * Dieser Hook vereint alle ETB-bezogenen Queries und Mutations in einem
 * einzigen Hook. Praktisch für Komponenten die mehrere ETB-Operationen
 * benötigen.
 *
 * @param options - Optionen für ETB-Operationen
 * @returns Objekt mit allen ETB-bezogenen Hooks und Daten
 *
 * @example
 * ```tsx
 * const {
 *   etb,
 *   isLoadingEtb,
 *   textbausteine,
 *   createEintrag,
 *   updateEintrag,
 *   deleteEintrag,
 *   lockEtb,
 * } = useEtbOperations({ einsatzId: 'abc-123' });
 * ```
 */
export const useEtbOperations = ({ einsatzId, includeDeleted = false }: UseEtbOperationsOptions = {}) => {
  const etbQuery = useEtb({ einsatzId, includeDeleted });
  const textbausteineQuery = useTextbausteine();
  const createEintrag = useCreateEtbEntry();
  const updateEintrag = useUpdateEtbEntry();
  const deleteEintrag = useDeleteEtbEntry();
  const lockEtb = useLockEtb();

  return {
    // Query results
    etb: etbQuery.data,
    isLoadingEtb: etbQuery.isLoading,
    etbError: etbQuery.error,
    textbausteine: textbausteineQuery.data,
    isLoadingTextbausteine: textbausteineQuery.isLoading,
    textbausteineError: textbausteineQuery.error,

    // Mutations
    createEintrag: createEintrag.mutate,
    updateEintrag: updateEintrag.mutate,
    deleteEintrag: deleteEintrag.mutate,
    lockEtb: lockEtb.mutate,

    // Mutation states
    isCreatingEintrag: createEintrag.isPending,
    isUpdatingEintrag: updateEintrag.isPending,
    isDeletingEintrag: deleteEintrag.isPending,
    isLockingEtb: lockEtb.isPending,

    // Full mutation objects for advanced usage
    createEintragMutation: createEintrag,
    updateEintragMutation: updateEintrag,
    deleteEintragMutation: deleteEintrag,
    lockEtbMutation: lockEtb,
  };
};
