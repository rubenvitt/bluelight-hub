import { useEtbHistory } from '@/hooks/useEtb';
import { Button } from '@atoms/button.atom';
import type { EtbEintragDto } from '@bluelight-hub/shared/client';
import { Dialog } from '@molecules/dialog.molecule';
import { Timeline, TimelineDot, TimelineItem } from '@molecules/timeline.molecule';
import { useEffect, useRef } from 'react';
import { PiCircleNotch } from 'react-icons/pi';
import { EtbHistoryCard } from './EtbHistoryCard';

interface EtbHistoryModalProps {
  entry: EtbEintragDto | null;
  etbId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

type SnapshotEntry = {
  id?: string;
  text?: string;
  kategorie?: string;
  sequenceNumber?: number;
  updatedAt?: string;
  createdAt?: string;
  isDeleted?: boolean;
};

type HistoryItem = {
  version: number;
  timestamp: Date;
  text?: string;
  kategorie?: string;
  username?: string;
  isCurrent?: boolean;
  changeReason?: string;
};

function parseSnapshotEntry(raw: unknown): SnapshotEntry | null {
  if (!raw) return null;

  if (Array.isArray(raw)) {
    const [id, sequenceNumber, text] = raw as Array<unknown>;
    return {
      id: typeof id === 'string' ? id : undefined,
      sequenceNumber: typeof sequenceNumber === 'number' ? sequenceNumber : Number(sequenceNumber) || undefined,
      text: typeof text === 'string' ? text : undefined,
    };
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return {
      id: typeof obj.id === 'string' ? obj.id : undefined,
      text: typeof obj.text === 'string' ? obj.text : undefined,
      kategorie: typeof obj.kategorie === 'string' ? obj.kategorie : undefined,
      sequenceNumber: typeof obj.sequenceNumber === 'number' ? obj.sequenceNumber : Number(obj.sequenceNumber) || undefined,
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : undefined,
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : undefined,
      isDeleted: typeof obj.isDeleted === 'boolean' ? obj.isDeleted : undefined,
    };
  }

  return null;
}

function buildHistory(entry: EtbEintragDto | null, snapshots?: Array<{ version: number; snapshotAt: Date; eintraege?: unknown[] }>): HistoryItem[] {
  if (!entry) return [];

  const sortedSnapshots = (snapshots ?? []).slice().sort((a, b) => b.version - a.version);
  const history: HistoryItem[] = [];

  const currentVersion = sortedSnapshots.length > 0 ? sortedSnapshots[0].version + 1 : (entry.version ?? 1);
  const currentTimestamp = entry.updatedAt ? new Date(entry.updatedAt) : new Date(entry.createdAt);

  history.push({
    version: currentVersion,
    timestamp: currentTimestamp,
    text: entry.text,
    kategorie: entry.kategorie,
    username: entry.updatedBy ?? entry.createdBy,
    isCurrent: true,
  });

  for (const snapshot of sortedSnapshots) {
    const rawSnapshotEntry = snapshot.eintraege?.map(parseSnapshotEntry).find((snap) => snap?.id === entry.id);
    if (!rawSnapshotEntry) continue;

    const text = rawSnapshotEntry.text;
    const last = history[history.length - 1];

    // Avoid duplicate consecutive entries with identical text
    if (last && last.text === text) {
      continue;
    }

    history.push({
      version: snapshot.version,
      timestamp: new Date(snapshot.snapshotAt),
      text,
      kategorie: rawSnapshotEntry.kategorie ?? entry.kategorie,
      username: undefined,
      changeReason: rawSnapshotEntry.isDeleted ? 'Gelöscht' : undefined,
    });
  }

  return history;
}

/**
 * Modal zur Anzeige der Versionshistorie eines ETB-Eintrags
 *
 * Zeigt alle Versionen eines Eintrags in einer Timeline-Ansicht an.
 * Verwendet einen Ref um Flackern beim Schließen zu vermeiden.
 */
export function EtbHistoryModal({ entry, etbId, isOpen, onClose }: EtbHistoryModalProps) {
  // Speichere die letzte gültige entry, um Flackern beim Schließen zu vermeiden
  const lastValidEntry = useRef<EtbEintragDto | null>(null);
  const lastValidEtbId = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen && entry) {
      lastValidEntry.current = entry;
    }
    if (isOpen && etbId) {
      lastValidEtbId.current = etbId;
    }
  }, [isOpen, entry, etbId]);

  const activeEntry = isOpen ? entry : lastValidEntry.current;
  const activeEtbId = isOpen ? etbId : lastValidEtbId.current;
  const { data: snapshots, isLoading } = useEtbHistory(activeEtbId ?? undefined);

  const historyItems = buildHistory(activeEntry, snapshots);
  const hasHistory = historyItems.length > 1;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} size="xl">
      <Dialog.Title>
        Versionshistorie
        {activeEntry && <span className="ml-2 text-gray-500 text-sm dark:text-gray-400">Eintrag #{activeEntry.sequenceNumber}</span>}
      </Dialog.Title>

      <Dialog.Body className="max-h-[70vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <PiCircleNotch className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : hasHistory ? (
          <Timeline>
            {historyItems.map((historyEntry, index) => (
              <TimelineItem key={`${historyEntry.version}-${historyEntry.timestamp.toISOString()}`} showLine={index < historyItems.length - 1}>
                <TimelineDot variant={historyEntry.isCurrent ? 'primary' : 'secondary'} />
                <EtbHistoryCard
                  version={historyEntry.version}
                  timestamp={historyEntry.timestamp}
                  text={historyEntry.text ?? ''}
                  kategorie={historyEntry.kategorie}
                  username={historyEntry.username}
                  changeReason={historyEntry.changeReason}
                  isCurrent={historyEntry.isCurrent}
                />
              </TimelineItem>
            ))}
          </Timeline>
        ) : (
          <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">Keine Versionshistorie verfügbar</div>
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
