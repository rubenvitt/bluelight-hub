import { ErrorState } from '@/components/atoms/ErrorState';
import { LoadingState } from '@/components/atoms/LoadingState';
import { EtbLockButton, EtbStatusBadge, type EtbStatus } from '@/components/molecules/etb';
import { EtbSnapshotHistoryModal } from '@/components/organisms/etb/components/EtbSnapshotHistoryModal';
import { EditEtbEntryModal } from '@/components/organisms/etb/EditEtbEntryModal';
import { EtbEntryForm } from '@/components/organisms/etb/EtbEntryForm';
import { EtbEntryList } from '@/components/organisms/etb/EtbEntryList';
import { EtbFullscreenView } from '@/components/organisms/etb/EtbFullscreenView/EtbFullscreenView';
import { useEtbInfinite } from '@/hooks/useEtb';
import type { EintragDto } from '@bluelight-hub/shared/client';
import { useMemo, useState } from 'react';
import { PiClockCounterClockwise } from 'react-icons/pi';

type EtbPageProps = {
  einsatzId: string;
  mode: 'standard' | 'fullscreen';
};

/**
 * ETB-Seite mit Eingabeformular und Eintragliste
 *
 * Zeigt das Einsatztagebuch für einen spezifischen Einsatz an.
 */
export function EtbPage({ einsatzId, mode }: EtbPageProps) {
  const [sortBy, setSortBy] = useState<string>('sequenceNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDeleted, setShowDeleted] = useState<boolean>(false);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useEtbInfinite(einsatzId, 30, sortBy, sortOrder, showDeleted); // 30 Einträge pro Seite

  const [editingEntry, setEditingEntry] = useState<(EintragDto & { etbId: string }) | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const etb = data?.pages?.[0]?.data;

  // Handler für Sortierungsänderung
  const handleSortChange = (field: string, order: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(order);
  };

  // Handler für Edit-Button
  const handleEditEntry = (entry: EintragDto) => {
    if (!etb?.id) return;
    setEditingEntry({ ...entry, etbId: etb.id });
    setIsEditModalOpen(true);
  };

  // Handler für Modal-Close
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingEntry(null);
  };

  const allEntries = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data?.eintraege || []);
  }, [data]);

  // Fullscreen Mode
  if (mode === 'fullscreen') {
    return <EtbFullscreenView einsatzId={einsatzId} sortOrder={sortOrder} showDeleted={showDeleted} />;
  }

  // Standard Mode
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <LoadingState message="Lade Einsatztagebuch..." fullScreen={false} />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Fehler beim Laden" description="Das Einsatztagebuch konnte nicht geladen werden." />;
  }

  if (!etb) {
    return <ErrorState title="ETB nicht verfügbar" description="Das Einsatztagebuch existiert nicht. Es sollte automatisch bei der Einsatz-Erstellung angelegt worden sein." />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-semibold text-2xl text-gray-900 dark:text-gray-100">Einsatztagebuch</h1>
              {etb?.status && <EtbStatusBadge status={etb.status as EtbStatus} showDot />}
            </div>
            <p className="mt-1 text-gray-500 text-sm dark:text-gray-400">Dokumentiere alle wichtigen Ereignisse und Maßnahmen während des Einsatzes.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-gray-700 text-sm shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-600"
              title="Versionshistorie anzeigen"
            >
              <PiClockCounterClockwise className="h-4 w-4" />
              Historie
            </button>
            <EtbLockButton etbId={etb.id} disabled={etb.status === 'LOCKED'} />
          </div>
        </div>

        {/* Eingabeformular */}
        {etb.status === 'LOCKED' ? (
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-center text-red-700 dark:text-red-400">Das ETB ist gesperrt. Neue Einträge können nicht hinzugefügt werden.</p>
          </div>
        ) : (
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <div className="mb-4">
              <h2 className="font-medium text-gray-900 text-lg dark:text-gray-100">Neuer Eintrag</h2>
            </div>
            <EtbEntryForm etbId={etb.id} einsatzId={einsatzId} />
          </div>
        )}

        {/* Eintragliste mit Infinite Scrolling */}
        <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
          <div className="border-gray-200 border-b px-6 py-4 dark:border-gray-700">
            <h2 className="font-medium text-gray-900 text-lg dark:text-gray-100">
              Einträge
              {data?.pages?.[0]?.pagination?.total ? (
                <span className="ml-2 text-gray-500 text-sm dark:text-gray-400">
                  ({allEntries.length} von {data.pages[0].pagination.total} geladen)
                </span>
              ) : (
                <span className="ml-2 text-gray-500 text-sm dark:text-gray-400">({allEntries.length})</span>
              )}
            </h2>
          </div>
          <div className="p-6" style={{ minHeight: '700px' }}>
            <EtbEntryList
              entries={allEntries}
              einsatzId={einsatzId}
              etbId={etb.id}
              isLoading={isLoading}
              hasNextPage={hasNextPage}
              fetchNextPage={fetchNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onEditEntry={handleEditEntry}
              onSortChange={handleSortChange}
              sortBy={sortBy}
              sortOrder={sortOrder}
              enableInlineEdit={false}
              showDeleted={showDeleted}
              onShowDeletedChange={setShowDeleted}
            />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <EditEtbEntryModal entry={editingEntry} isOpen={isEditModalOpen} onClose={handleCloseEditModal} />

      {/* History Modal */}
      <EtbSnapshotHistoryModal etbId={etb.id} isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} />
    </div>
  );
}
