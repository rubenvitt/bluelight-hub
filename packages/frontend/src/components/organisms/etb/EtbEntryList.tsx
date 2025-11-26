import { useConfirm } from '@/hooks/useConfirm';
import { useDeleteEtbEintrag } from '@/hooks/useEtb';
import { useUserNames } from '@/hooks/useUsers';
import type { EtbEintragDto } from '@bluelight-hub/shared/client';
import { type ExpandedState, getCoreRowModel, getExpandedRowModel, getFilteredRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PiCircleNotch } from 'react-icons/pi';
import { EtbEmptyState } from '../../molecules/etb/EtbEmptyState';
import { EtbFilterControls } from '../../molecules/etb/EtbFilterControls';
import { EtbResultsCount } from '../../molecules/etb/EtbResultsCount';
import { EtbSearchBar } from '../../molecules/etb/EtbSearchBar';
import { EtbTableBody } from '../../molecules/etb/EtbTableBody';
import { EtbTableHeader } from '../../molecules/etb/EtbTableHeader';
import { EtbHistoryModal } from './components/EtbHistoryModal';
import { useEtbColumns } from './hooks/useEtbColumns';

interface EtbEntryListProps {
  entries: EtbEintragDto[];
  einsatzId: string;
  etbId: string;
  isLoading?: boolean;
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  isFetchingNextPage?: boolean;
  onEditEntry?: (entry: EtbEintragDto) => void;
  onSortChange?: (field: string, order: 'asc' | 'desc') => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  enableInlineEdit?: boolean;
  showDeleted?: boolean;
  onShowDeletedChange?: (show: boolean) => void;
}

/**
 * ETB-Einträge-Liste mit TanStack Table
 */
export function EtbEntryList({
  entries,
  einsatzId,
  etbId,
  isLoading,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  onEditEntry,
  onSortChange,
  sortBy = 'sequenceNumber',
  sortOrder = 'desc',
  enableInlineEdit = false,
  showDeleted = false,
  onShowDeletedChange,
}: EtbEntryListProps) {
  const deleteEintrag = useDeleteEtbEintrag();
  const confirm = useConfirm();
  const { getUserName } = useUserNames();
  const [globalFilter, setGlobalFilter] = useState('');
  const [historyEntry, setHistoryEntry] = useState<EtbEintragDto | null>(null);

  // Sortierung für Anzeige - lokaler State für die Table
  const [sorting, setSorting] = useState<SortingState>(() => [{ id: sortBy, desc: sortOrder === 'desc' }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const observerTarget = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Synchronisiere lokalen Sortier-State mit Props
  useEffect(() => {
    setSorting([{ id: sortBy, desc: sortOrder === 'desc' }]);
  }, [sortBy, sortOrder]);

  // Intersection Observer für Infinite Scrolling
  useEffect(() => {
    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries[0].isIntersecting && hasNextPage && !isFetchingNextPage && fetchNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Verhindere Parent-Scrolling während Table-Scroll
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtTop = scrollTop === 0;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1;

      // Scrolling nach oben am Anfang oder nach unten am Ende verhindern
      if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        return; // Erlaube Parent-Scrolling
      }

      // Verhindere Parent-Scrolling während Table-Scroll
      e.preventDefault();
      container.scrollTop += e.deltaY;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleDelete = useCallback(
    async (entry: EtbEintragDto) => {
      const confirmed = await confirm({
        title: 'Eintrag löschen',
        message: 'Möchten Sie diesen ETB-Eintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
        variant: 'danger',
        confirmLabel: 'Löschen',
        cancelLabel: 'Abbrechen',
      });

      if (confirmed) {
        deleteEintrag.mutate({
          eintragId: entry.id,
          etbId,
        });
      }
    },
    [confirm, deleteEintrag, etbId],
  );

  // Column Definitions - Using extracted hook
  const columns = useEtbColumns({
    onEditEntry,
    handleDelete,
    onShowHistory: setHistoryEntry,
  });

  // Table Instance
  const table = useReactTable({
    data: entries,
    columns,
    state: {
      sorting,
      globalFilter,
      expanded,
    },
    manualSorting: true, // Serverseitige Sortierung
    onSortingChange: (updater) => {
      // Bei Sortierungsänderung Callback aufrufen für neue Serverdaten
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(newSorting); // Lokalen State aktualisieren

      if (newSorting.length > 0) {
        const field = newSorting[0].id;
        const order = newSorting[0].desc ? 'desc' : 'asc';
        onSortChange?.(field, order);
      }
    },
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    // getSortedRowModel nicht nutzen bei manueller Sortierung
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  // Virtualizer für Performance-Optimierung
  const { rows } = table.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: useCallback(() => 80, []), // Erhöhte Größe für bessere Lesbarkeit mehrzeiliger Texte
    overscan: 10, // Weniger overscan für bessere Performance
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0) : 0;

  // Empty State mit fester Höhe für konsistentes Layout
  if (entries.length === 0 && !isLoading) {
    return (
      <div className="space-y-4">
        {/* Search - auch bei leerer Liste anzeigen für konsistentes Layout */}
        <EtbSearchBar value={globalFilter} onChange={setGlobalFilter} />

        {/* Empty State Container mit fester Höhe */}
        <EtbEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter-Optionen */}
      {onShowDeletedChange && <EtbFilterControls showDeleted={showDeleted} onShowDeletedChange={onShowDeletedChange} />}

      {/* Search */}
      <EtbSearchBar value={globalFilter} onChange={setGlobalFilter} />

      {/* Table */}
      <div
        ref={tableContainerRef}
        className="relative isolate overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
        style={{
          height: '600px',
          minHeight: '600px',
          maxHeight: '600px',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch', // Smooth scrolling auf iOS
          scrollbarGutter: 'stable', // Verhindert Layout-Shift durch Scrollbar
        }}
      >
        <table className="w-full">
          <EtbTableHeader headerGroups={table.getHeaderGroups()} />

          <EtbTableBody
            virtualRows={virtualRows}
            rows={rows}
            columns={columns}
            paddingTop={paddingTop}
            paddingBottom={paddingBottom}
            isLoading={isLoading}
            entries={entries}
            enableInlineEdit={enableInlineEdit}
            einsatzId={einsatzId}
            onDelete={handleDelete}
            getUserName={getUserName}
          />
        </table>

        {/* Loading Indicator for Next Page */}
        {isFetchingNextPage && (
          <div className="flex justify-center bg-white py-4 dark:bg-gray-950">
            <PiCircleNotch className="h-6 w-6 animate-spin text-primary-500" />
          </div>
        )}

        {/* Observer Target for Infinite Scrolling */}
        <div ref={observerTarget} className="h-1" />
      </div>

      {/* Results Count */}
      <EtbResultsCount filteredCount={table.getFilteredRowModel().rows.length} totalCount={entries.length} hasGlobalFilter={!!globalFilter} hasNextPage={hasNextPage} />

      {/* History Modal */}
      <EtbHistoryModal entry={historyEntry} etbId={etbId} isOpen={historyEntry !== null} onClose={() => setHistoryEntry(null)} />
    </div>
  );
}
