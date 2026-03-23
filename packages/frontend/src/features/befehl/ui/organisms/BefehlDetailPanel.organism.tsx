/**
 * BefehlDetailPanel Organism
 *
 * Slide-Over Panel von rechts das Befehl-Details anzeigt.
 * Nutzt Headless UI Dialog fuer Focus-Trap, Escape-to-close
 * und Click-Outside-to-close.
 */

import { Dialog as HeadlessDialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { format } from 'date-fns';
import { useCallback, useState } from 'react';
import { PiCheckCircle, PiPencilSimpleLine, PiX } from 'react-icons/pi';
import { cn } from '@/shared/ui/cn';
import { Button } from '@/shared/ui/atoms/button.atom';
import { Tooltip } from '@/shared/ui/atoms/tooltip.atom';
import { type BefehlDto, BefehlDtoStatusEnum, type BefehlEmpfaengerDtoQuittierungArtEnum } from '@bluelight-hub/shared/client';
import { useAendereEmpfaengerStatus } from '../../api/use-aendere-empfaenger-status';
import type { AendereEmpfaengerStatusInput } from '../../api/use-aendere-empfaenger-status';
import { BefehlStatusBadge } from '../atoms/BefehlStatusBadge.atom';
import { ZustellstatusAnzeige } from '../molecules/ZustellstatusAnzeige.molecule';
import { getEigenerEmpfaengerStatus } from '../../lib/befehl-utils';
import { BefehlHistorieTimeline } from './BefehlHistorieTimeline.organism';
import { KorrekturBefehlDialog } from './KorrekturBefehlDialog.organism';

/** Labels fuer Quittierungsarten */
const QUITTIERUNG_ART_LABELS: Record<BefehlEmpfaengerDtoQuittierungArtEnum, string> = {
  VERSTANDEN: 'Verstanden',
  RUECKFRAGE: 'Rückfrage',
  NICHT_VERSTANDEN: 'Nicht verstanden',
};

interface BefehlDetailPanelProps {
  befehl: BefehlDto | null;
  isOpen: boolean;
  onClose: () => void;
  einsatzId: string;
  /** Callback fuer Quittierung */
  onQuittieren?: (befehlId: string) => void;
  /** ID des aktuellen Users (fuer Quittierungs-Anzeige) */
  currentUserId?: string;
  /** RBAC: Darf der aktuelle User quittieren? */
  canQuittieren?: boolean;
  /** RBAC: Darf der aktuelle User Korrekturen erstellen? */
  canKorrigieren?: boolean;
  /** RBAC: Darf der aktuelle User Empfaenger-Status verwalten? */
  canManageStatus?: boolean;
  /** Ist der aktuelle User nur Beobachter? */
  isBeobachter?: boolean;
}

export function BefehlDetailPanel({ befehl, isOpen, onClose, einsatzId, onQuittieren, currentUserId, canQuittieren, canKorrigieren, canManageStatus, isBeobachter }: BefehlDetailPanelProps) {
  const [isKorrekturDialogOpen, setIsKorrekturDialogOpen] = useState(false);
  const statusMutation = useAendereEmpfaengerStatus(einsatzId);

  const handleStatusChange = useCallback(
    (input: AendereEmpfaengerStatusInput) => {
      statusMutation.mutate(input);
    },
    [statusMutation],
  );

  return (
    <>
      <HeadlessDialog
        open={isOpen && befehl != null}
        as="div"
        className="relative z-50"
        onClose={onClose}
        // Keep global overlays (e.g. Sonner toasts) interactive while the flyout is open.
        // Headless UI's default inert behavior blocks clicks on visible toast actions.
        __demoMode
      >
        {/* Backdrop */}
        <DialogBackdrop transition className="fixed inset-0 bg-black/30 duration-300 ease-in-out data-[closed]:opacity-0 motion-reduce:duration-0" />

        {/* Panel Container */}
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-md">
              <DialogPanel transition className={cn('pointer-events-auto relative w-screen max-w-md transform', 'duration-300 ease-in-out data-[closed]:translate-x-full', 'motion-reduce:duration-0')}>
                {befehl && (
                  <div className="flex h-full flex-col bg-white shadow-2xl dark:bg-gray-900">
                    {/* Header */}
                    <div className="border-gray-200 border-b px-6 py-4 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <DialogTitle className="font-bold font-mono text-gray-900 text-xl dark:text-white">{befehl.nummer}</DialogTitle>
                        <button
                          type="button"
                          onClick={onClose}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                          aria-label="Schließen"
                        >
                          <PiX className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div>
                      <BefehlStatusBadge status={befehl.status} className="mt-2" />
                    </div>

                    {/* Quittierungs-Banner fuer Empfaenger (nicht fuer Beobachter) */}
                    {!isBeobachter && (() => {
                      const eigenerStatus = getEigenerEmpfaengerStatus(befehl.empfaenger, currentUserId);
                      if (!eigenerStatus.istEmpfaenger) return null;

                      if (eigenerStatus.status === 'QUITTIERT' && eigenerStatus.quittierungArt) {
                        return (
                          <div className="flex items-center gap-2 border-green-200 border-b bg-green-50 px-6 py-3 dark:border-green-800 dark:bg-green-900/20">
                            <PiCheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
                            <span className="font-medium text-green-800 text-sm dark:text-green-300">Quittiert: {QUITTIERUNG_ART_LABELS[eigenerStatus.quittierungArt]}</span>
                          </div>
                        );
                      }

                      if (canQuittieren && onQuittieren && befehl.status !== BefehlDtoStatusEnum.Korrigiert) {
                        return (
                          <div className="border-yellow-200 border-b bg-yellow-50 px-6 py-3 dark:border-yellow-800 dark:bg-yellow-900/20">
                            <button
                              type="button"
                              onClick={() => onQuittieren(befehl.id)}
                              className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-500 px-4 py-2.5 font-semibold text-sm text-white shadow-sm transition-colors hover:bg-yellow-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 dark:bg-yellow-600 dark:hover:bg-yellow-700"
                            >
                              <PiCheckCircle className="h-5 w-5" aria-hidden="true" />
                              Befehl quittieren
                            </button>
                          </div>
                        );
                      }

                      return null;
                    })()}

                    {/* Beobachter-Hinweis */}
                    {isBeobachter && (
                      <div className="border-gray-200 border-b bg-gray-50 px-6 py-2 dark:border-gray-700 dark:bg-gray-800/50">
                        <span className="text-gray-500 text-xs dark:text-gray-400">Nur-Lese-Ansicht — Beobachter haben keinen Zugriff auf Aktionen</span>
                      </div>
                    )}

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-6 py-5">
                      <div className="space-y-4">
                        {/* Auftrag */}
                        <section>
                          <h3 className="font-semibold text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">Auftrag</h3>
                          <p className="mt-1 whitespace-pre-wrap text-gray-900 text-sm dark:text-gray-100">{befehl.auftrag}</p>
                        </section>

                        {/* Befehlsgeber */}
                        <section>
                          <h3 className="font-semibold text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">Befehlsgeber</h3>
                          <p className="mt-1 text-gray-900 text-sm dark:text-gray-100">{befehl.befehlsgeberName}</p>
                        </section>

                        {/* Zeitstempel */}
                        <section>
                          <h3 className="font-semibold text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">Erteilt am</h3>
                          <p className="mt-1 text-gray-700 text-sm dark:text-gray-300">{format(befehl.erteiltAm, 'dd.MM.yyyy, HH:mm')} Uhr</p>
                        </section>

                        {/* Empfaenger */}
                        <section>
                          <h3 className="font-semibold text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">Empfänger</h3>
                          <div className="mt-2">
                            <ZustellstatusAnzeige
                              empfaenger={befehl.empfaenger}
                              variant="expanded"
                              interactive={canManageStatus}
                              befehlId={befehl.id}
                              onStatusChange={handleStatusChange}
                              isKorrigiert={befehl.status === BefehlDtoStatusEnum.Korrigiert}
                            />
                          </div>
                        </section>

                        {/* Verlauf (Story 4.2) */}
                        <section>
                          <h3 className="font-semibold text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">Verlauf</h3>
                          <div className="mt-3">
                            <BefehlHistorieTimeline befehlId={befehl.id} />
                          </div>
                        </section>

                        {/* Korrektur-Button (nur wenn nicht bereits korrigiert und nicht Beobachter) */}
                        {!isBeobachter && befehl.status !== BefehlDtoStatusEnum.Korrigiert && (
                          <section>
                            {!canKorrigieren ? (
                              <Tooltip content="Nur Befehlsgeber dürfen Korrekturen erstellen" position="bottom">
                                <Button intent="warning" appearance="outline" size="sm" onClick={() => setIsKorrekturDialogOpen(true)} disabled aria-disabled="true">
                                  <PiPencilSimpleLine className="mr-1.5 h-4 w-4" />
                                  Korrektur erstellen
                                </Button>
                              </Tooltip>
                            ) : (
                              <Button intent="warning" appearance="outline" size="sm" onClick={() => setIsKorrekturDialogOpen(true)}>
                                <PiPencilSimpleLine className="mr-1.5 h-4 w-4" />
                                Korrektur erstellen
                              </Button>
                            )}
                          </section>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </DialogPanel>
            </div>
          </div>
        </div>
      </HeadlessDialog>

      {/* Korrektur-Dialog */}
      {befehl && <KorrekturBefehlDialog isOpen={isKorrekturDialogOpen} onClose={() => setIsKorrekturDialogOpen(false)} originalBefehl={befehl} einsatzId={einsatzId} />}
    </>
  );
}
