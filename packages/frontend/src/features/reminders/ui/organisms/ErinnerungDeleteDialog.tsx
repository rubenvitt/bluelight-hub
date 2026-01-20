/**
 * Erinnerung Delete Dialog
 *
 * **Story 1.4:** "Erinnerung löschen"
 * AC2: Bestätigungs-Dialog fragt: "Wirklich löschen?"
 * AC1: Nur GEPLANT oder AUSGELOEST Status löschbar (wird im Button geprüft)
 */

import type { ErinnerungResponseDto } from '@/shared';

import { Button } from '@/shared/ui/atoms/button.atom';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { useCallback } from 'react';
import { PiTrash, PiWarning } from 'react-icons/pi';

import { useDeleteErinnerung } from '../../api';

interface ErinnerungDeleteDialogProps {
  /** Ob der Dialog offen ist */
  isOpen: boolean;
  /** Schließen-Handler */
  onClose: () => void;
  /** Die zu löschende Erinnerung */
  erinnerung: ErinnerungResponseDto | null;
  /** Einsatz ID */
  einsatzId: string;
}

/**
 * Bestätigungs-Dialog zum Löschen einer Erinnerung.
 *
 * **Story 1.4 AC2:** "Bestätigungs-Dialog fragt: 'Wirklich löschen?'"
 * **Story 1.4 AC4:** Nach erfolgreichem Löschen wird die Liste aktualisiert (via Hook).
 */
export function ErinnerungDeleteDialog({ isOpen, onClose, erinnerung, einsatzId }: ErinnerungDeleteDialogProps) {
  const { mutate: deleteErinnerung, isPending } = useDeleteErinnerung();

  const handleDelete = useCallback(() => {
    if (!erinnerung) return;

    deleteErinnerung(
      {
        einsatzId,
        erinnerungId: erinnerung.id,
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  }, [erinnerung, einsatzId, deleteErinnerung, onClose]);

  const handleClose = useCallback(() => {
    if (!isPending) {
      onClose();
    }
  }, [isPending, onClose]);

  // Wenn keine Erinnerung, nichts rendern
  if (!erinnerung) {
    return null;
  }

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} size="md">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/30">
          <PiWarning className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <Dialog.Title>Erinnerung '{erinnerung.titel}' löschen?</Dialog.Title>
      </div>

      <Dialog.Body>
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
            <p className="flex items-start gap-2 text-amber-800 text-sm dark:text-amber-300">
              <PiTrash className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Diese Aktion kann nicht rückgängig gemacht werden. Die Erinnerung wird im Einsatztagebuch dokumentiert.</span>
            </p>
          </div>

          {/* Erinnerung-Details */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
            <dl className="space-y-1 text-sm">
              <div className="flex">
                <dt className="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400">Titel:</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{erinnerung.titel}</dd>
              </div>
              <div className="flex">
                <dt className="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400">Fällig um:</dt>
                <dd className="text-gray-700 dark:text-gray-300">
                  {new Date(erinnerung.faelligAm).toLocaleString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </dd>
              </div>
              <div className="flex">
                <dt className="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400">Status:</dt>
                <dd className="text-gray-700 dark:text-gray-300">{erinnerung.status === 'GEPLANT' ? 'Geplant' : erinnerung.status === 'AUSGELOEST' ? 'Ausgelöst' : erinnerung.status}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Dialog.Body>

      <Dialog.Footer loading={isPending}>
        <Button intent="secondary" appearance="ghost" onClick={handleClose} disabled={isPending}>
          Abbrechen
        </Button>
        <Button intent="danger" onClick={handleDelete} loading={isPending}>
          <PiTrash className="mr-1.5 h-4 w-4" />
          Löschen
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
