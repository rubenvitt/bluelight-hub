/**
 * Erinnerung Assign Dialog
 *
 * **Story 3.4:** "Bestehende Erinnerung zuweisen"
 * AC1: "Bestehende Erinnerung nachtraeglich zuweisen"
 * AC1: "Teilnehmer aus aktiven Einsatz-Teilnehmern auswaehlen"
 * AC2: "Nach Zuweisung verschwindet Erinnerung aus 'Meine Erinnerungen'"
 */

import type { ErinnerungResponseDto } from '@/shared';

import { Button } from '@/shared/ui/atoms/button.atom';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { useCallback, useState } from 'react';
import { PiUser, PiWarning } from 'react-icons/pi';

import { useAssignErinnerung } from '../../api';
import { AssigneeSelector } from '../molecules/AssigneeSelector';

interface ErinnerungAssignDialogProps {
  /** Ob der Dialog offen ist */
  isOpen: boolean;
  /** Schliessen-Handler */
  onClose: () => void;
  /** Die zu bearbeitende Erinnerung */
  erinnerung: ErinnerungResponseDto | null;
  /** Einsatz ID */
  einsatzId: string;
}

/**
 * Dialog zum Zuweisen einer bestehenden Erinnerung an einen anderen Benutzer.
 *
 * **Story 3.4 AC1:** Zeigt alle aktiven Einsatz-Teilnehmer zur Auswahl.
 * **Story 3.4 AC2:** Nach Zuweisung wird die Erinnerung dem neuen Besitzer zugeordnet.
 *
 * @example
 * ```tsx
 * <ErinnerungAssignDialog
 *   isOpen={isAssignDialogOpen}
 *   onClose={() => setIsAssignDialogOpen(false)}
 *   erinnerung={selectedErinnerung}
 *   einsatzId={einsatzId}
 * />
 * ```
 */
export function ErinnerungAssignDialog({ isOpen, onClose, erinnerung, einsatzId }: ErinnerungAssignDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { mutate: assignErinnerung, isPending } = useAssignErinnerung();

  // Handler fuer Auswahl-Aenderung
  const handleUserChange = useCallback((userId: string | null) => {
    setSelectedUserId(userId);
    setError(null);
  }, []);

  // Handler fuer Zuweisung
  const handleAssign = useCallback(() => {
    if (!erinnerung) return;

    // Validierung: User muss ausgewaehlt sein
    if (!selectedUserId) {
      setError('Bitte waehle einen Teilnehmer aus');
      return;
    }

    // AC1: Nicht sich selbst zuweisen (ist bereits bei sich)
    if (selectedUserId === erinnerung.assignedToId) {
      setError('Die Erinnerung ist bereits dieser Person zugewiesen');
      return;
    }

    assignErinnerung(
      {
        einsatzId,
        erinnerungId: erinnerung.id,
        data: { assignedToId: selectedUserId },
      },
      {
        onSuccess: () => {
          // Reset und schliessen
          setSelectedUserId(null);
          setError(null);
          onClose();
        },
        onError: () => {
          // Error wird bereits von Mutation gehandled (toast)
        },
      },
    );
  }, [erinnerung, selectedUserId, einsatzId, assignErinnerung, onClose]);

  // Handler fuer Dialog-Schliessung
  const handleClose = useCallback(() => {
    setSelectedUserId(null);
    setError(null);
    onClose();
  }, [onClose]);

  // Sicherheits-Check: Nur aktive Erinnerungen koennen zugewiesen werden
  const isAssignable = erinnerung && !['ERLEDIGT', 'ESKALIERT'].includes(erinnerung.status);

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} size="md">
      <Dialog.Title className="flex items-center gap-2">
        <PiUser className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <span>Erinnerung zuweisen</span>
      </Dialog.Title>

      <Dialog.Body>
        {!erinnerung ? (
          <div className="py-4 text-gray-500 dark:text-gray-400">Keine Erinnerung ausgewaehlt</div>
        ) : !isAssignable ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <PiWarning className="h-12 w-12 text-amber-500" />
            <p className="text-center text-gray-700 dark:text-gray-300">Diese Erinnerung kann nicht zugewiesen werden, da sie bereits erledigt oder eskaliert ist.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Erinnerungs-Info */}
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <p className="font-medium text-gray-900 dark:text-white">{erinnerung.titel}</p>
              {erinnerung.beschreibung && <p className="mt-1 text-gray-600 text-sm dark:text-gray-400">{erinnerung.beschreibung}</p>}
              {erinnerung.assignedToName && (
                <p className="mt-2 text-gray-500 text-sm dark:text-gray-400">
                  Aktuell zugewiesen an: <span className="font-medium">{erinnerung.assignedToName}</span>
                </p>
              )}
            </div>

            {/* Teilnehmer-Auswahl */}
            <div>
              <label htmlFor="assignee-select" className="mb-1.5 block font-medium text-gray-700 text-sm dark:text-gray-300">
                Zuweisen an
              </label>
              <AssigneeSelector einsatzId={einsatzId} value={selectedUserId} onChange={handleUserChange} disabled={isPending} error={error ?? undefined} />
              {error && <p className="mt-1 text-red-600 text-sm dark:text-red-400">{error}</p>}
            </div>

            {/* Hinweis */}
            <p className="text-gray-500 text-xs dark:text-gray-400">Nach der Zuweisung erhaelt die ausgewaehlte Person eine Benachrichtigung und die Erinnerung erscheint in deren Liste.</p>
          </div>
        )}
      </Dialog.Body>

      <Dialog.Footer>
        {!isAssignable ? (
          <Button intent="secondary" appearance="ghost" onClick={handleClose}>
            Schliessen
          </Button>
        ) : (
          <>
            <Button intent="secondary" appearance="ghost" onClick={handleClose} disabled={isPending}>
              Abbrechen
            </Button>
            <Button intent="primary" onClick={handleAssign} disabled={isPending || !selectedUserId} loading={isPending}>
              Zuweisen
            </Button>
          </>
        )}
      </Dialog.Footer>
    </Dialog>
  );
}
