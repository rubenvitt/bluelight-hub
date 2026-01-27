import { ErrorState } from '@/shared/ui/atoms/ErrorState';
import { LoadingState } from '@/shared/ui/atoms/LoadingState';
import { EtbLockButton, EtbStatusBadge, type EtbStatus, EtbSnapshotHistoryModal, EditEtbEntryModal, EtbEntryForm, EtbEntryList, EtbFullscreenView, useEtbInfinite } from '@/features/etb';
import type { EintragDto } from '@/shared';
import { useMemo, useState } from 'react';
import { PiClockCounterClockwise, PiArrowsClockwise } from 'react-icons/pi';
import { cn } from '@/shared/ui/cn';

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

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } = useEtbInfinite({
    einsatzId,
    limit: 30,
    sortBy,
    sortOrder,
    includeDeleted: showDeleted,
  });

  const [editingEntry, setEditingEntry] = useState<(EintragDto & { etbId: string }) | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  /* State for artificial delay on reload button */
  const [isReloading, setIsReloading] = useState(false);

  const handleReload = async () => {
    setIsReloading(true);
    // Promise.all ensures we wait for BOTH the refetch AND the artificial delay
    // This prevents "flickering" if the API is too fast
    await Promise.all([refetch(), new Promise((resolve) => setTimeout(resolve, 600))]);
    setIsReloading(false);
  };

  const etb = data?.pages?.[0]?.data;

  const handleSortChange = (field: string, order: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(order);
  };

  const handleEditEntry = (entry: EintragDto) => {
    if (!etb?.id) return;
    setEditingEntry({ ...entry, etbId: etb.id });
    setIsEditModalOpen(true);
  };

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
              onClick={handleReload}
              disabled={isRefetching || isReloading}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-gray-700 text-sm shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-600',
                (isRefetching || isReloading) && 'cursor-not-allowed opacity-50',
              )}
              title="Aktualisieren"
            >
              <PiArrowsClockwise className={cn('h-4 w-4', (isRefetching || isReloading) && 'animate-spin')} />
              Aktualisieren
            </button>
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
