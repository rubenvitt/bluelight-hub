import { api } from '@/api';
import { Button } from '@atoms/button.atom';
import type { EtbSnapshotDto } from '@bluelight-hub/shared/client';
import { Dialog } from '@molecules/dialog.molecule';
import { Timeline, TimelineDot, TimelineItem } from '@molecules/timeline.molecule';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { PiCaretDown, PiCaretRight, PiCircleNotch } from 'react-icons/pi';
import { formatDisplayDateTime } from '@/utils/dateFormatter';
import { cn } from '@/utils/cn';
import { EtbVersionBadge } from './EtbVersionBadge';

interface EtbSnapshotHistoryModalProps {
  etbId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Hook zum Abrufen der ETB Snapshot-Historie
 *
 * Nutzt den generierten API-Client und TanStack Query für optimales Caching.
 * Gibt alle Snapshots sortiert nach Version (neueste zuerst) zurück.
 */
function useEtbHistory(etbId: string | undefined) {
  return useQuery({
    queryKey: ['etb', 'history', etbId],
    queryFn: () => {
      if (!etbId) {
        return Promise.resolve([]);
      }
      return api.etb().etbCqrsControllerGetEtbHistoryVAlpha({ etbId });
    },
    enabled: !!etbId,
    staleTime: 1000 * 30, // 30 Sekunden - Historie ändert sich nicht oft
  });
}

/**
 * Einzelne Snapshot-Card mit expandierbaren Einträgen
 */
function SnapshotCard({ snapshot, isFirst }: { snapshot: EtbSnapshotDto; isFirst: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const entryCount = snapshot.eintraege?.length ?? 0;

  return (
    <div
      className={cn(
        'rounded-lg p-4',
        isFirst ? 'border-2 border-primary-500 bg-primary-50/50 dark:border-primary-600 dark:bg-primary-900/20' : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/50',
      )}
    >
      {/* Header mit Version, Timestamp und Einträge-Anzahl */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <EtbVersionBadge version={snapshot.version} isCurrent={isFirst} variant="solid" />
          <span className="text-gray-500 text-sm dark:text-gray-400">{formatDisplayDateTime(snapshot.snapshotAt)}</span>
        </div>
        <span className="text-gray-500 text-sm dark:text-gray-400">
          {entryCount} {entryCount === 1 ? 'Eintrag' : 'Einträge'}
        </span>
      </div>

      {/* Aktuell-Label für den neuesten Snapshot */}
      {isFirst && <p className="mt-1 text-primary-600 text-xs dark:text-primary-400">Aktueller Stand</p>}

      {/* Expandable Einträge-Liste */}
      {entryCount > 0 && (
        <div className="mt-3">
          <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1 text-gray-600 text-sm hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
            {isExpanded ? <PiCaretDown className="h-4 w-4" /> : <PiCaretRight className="h-4 w-4" />}
            <span>{isExpanded ? 'Einträge ausblenden' : 'Einträge anzeigen'}</span>
          </button>

          {isExpanded && (
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-md border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
              {snapshot.eintraege.map((eintrag, index) => (
                <div key={`entry-${snapshot.version}-${index}`} className="border-gray-200 border-b pb-2 text-gray-700 text-sm last:border-b-0 last:pb-0 dark:border-gray-700 dark:text-gray-300">
                  {/* eintraege ist Array<Array<string>> - zeige als Text */}
                  {Array.isArray(eintrag) ? eintrag.join(' | ') : String(eintrag)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Modal zur Anzeige der ETB Snapshot-Historie
 *
 * Zeigt alle Snapshots eines Einsatztagebuchs in einer Timeline-Ansicht an.
 * Jeder Snapshot kann expandiert werden um die enthaltenen Einträge zu sehen.
 *
 * @param etbId - ID des Einsatztagebuchs
 * @param isOpen - Ob das Modal geöffnet ist
 * @param onClose - Callback zum Schließen des Modals
 */
export function EtbSnapshotHistoryModal({ etbId, isOpen, onClose }: EtbSnapshotHistoryModalProps) {
  // Speichere die letzte gültige etbId, um Flackern beim Schließen zu vermeiden
  const lastValidEtbId = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen && etbId) {
      lastValidEtbId.current = etbId;
    }
  }, [isOpen, etbId]);

  const activeEtbId = isOpen ? etbId : lastValidEtbId.current;
  const { data: snapshots, isLoading } = useEtbHistory(activeEtbId ?? undefined);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} size="xl">
      <Dialog.Title>ETB Versionshistorie</Dialog.Title>

      <Dialog.Body className="max-h-[70vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <PiCircleNotch className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : snapshots && snapshots.length > 0 ? (
          <Timeline>
            {snapshots.map((snapshot, index) => (
              <TimelineItem key={`snapshot-${snapshot.version}`} showLine={index < snapshots.length - 1}>
                <TimelineDot variant={index === 0 ? 'primary' : 'secondary'} />
                <SnapshotCard snapshot={snapshot} isFirst={index === 0} />
              </TimelineItem>
            ))}
          </Timeline>
        ) : (
          <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">Keine Historie vorhanden</div>
        )}
      </Dialog.Body>

      <Dialog.Footer>
        <Button intent="secondary" onClick={onClose} className="w-full">
          Schließen
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
