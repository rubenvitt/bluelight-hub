import { useUserNames } from '@/features/auth';
import { useHighlightedEntryId, setHighlightedEntry } from '@/features/reminders/stores';
import type { EintragDto } from '@/shared';
import { type ExpandedState, getCoreRowModel, getExpandedRowModel, getFilteredRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PiCircleNotch } from 'react-icons/pi';
import { EtbEmptyState } from '../molecules/EtbEmptyState';
import { EtbFilterControls } from '../molecules/EtbFilterControls';
import { KategorieFilterSelect } from '../molecules/KategorieFilterSelect';
import { EtbResultsCount } from '../molecules/EtbResultsCount';
import { EtbSearchBar } from '../molecules/EtbSearchBar';
import { EtbTableBody } from '../molecules/EtbTableBody';
import { EtbTableHeader } from '../molecules/EtbTableHeader';
import { EtbHistoryModal } from './components/EtbHistoryModal';
import { useEtbColumns } from '../../hooks/useEtbColumns';
import { useExcludedKategorien, useHasActiveFilter, useErinnerungFilterActive, resetKategorieFilter, useIncludedKontextType } from '../../stores';

interface EtbEntryListProps {
  entries: EintragDto[];
  einsatzId: string;
  etbId: string;
  isLoading?: boolean;
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  isFetchingNextPage?: boolean;
  onEditEntry?: (entry: EintragDto) => void;
  onDeleteEntry?: (entry: EintragDto) => void;
  onSortChange?: (field: string, order: 'asc' | 'desc') => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  enableInlineEdit?: boolean;
  showDeleted?: boolean;
  onShowDeletedChange?: (show: boolean) => void;
}

/**
 * ETB-Eintraege-Liste mit TanStack Table
 *
 * **Story 5.5:** Unterstuetzt Timeline-Widget in expandierten Eintraegen.
 * **Story 5.6:** Kategorie-Filter (Multiselect mit Exclude-Logik)
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
  onDeleteEntry,
  onSortChange,
  sortBy = 'sequenceNumber',
  sortOrder = 'desc',
  enableInlineEdit = false,
  showDeleted = false,
  onShowDeletedChange,
}: EtbEntryListProps) {
  const { getUserName } = useUserNames();
  const [globalFilter, setGlobalFilter] = useState('');
  const [historyEntry, setHistoryEntry] = useState<EintragDto | null>(null);

  // Story 5.6: Kategorie-Filter aus Store (Multiselect mit Exclude-Logik)
  const excludedKategorien = useExcludedKategorien();
  const hasKategorieFilter = useHasActiveFilter();
  const erinnerungFilterActive = useErinnerungFilterActive();
  const includedKontextType = useIncludedKontextType();

  // Sortierung fuer Anzeige - lokaler State fuer die Table
  const [sorting, setSorting] = useState<SortingState>(() => [{ id: sortBy, desc: sortOrder === 'desc' }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const observerTarget = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  /**
   * Story 5.6: Kategorie-Filterung VOR der Table
   * Das ist noetig weil TanStack Table die globalFilterFn cached und nicht
   * auf externe Dependencies reagiert. Durch Filterung der `data` prop
   * wird die Table automatisch neu gerendert.
   *
   * Erinnerungs-Filter: Zeigt nur Eintraege mit verknuepfter Erinnerung
   * (metadata.erinnerungId oder linkedErinnerung).
   */
  const filteredEntries = useMemo(() => {
    let result = entries;

    // Korrigierte Eintraege ausblenden (wie Gelöschte) - nur bei "Gelöschte anzeigen" sichtbar
    if (!showDeleted) {
      result = result.filter((entry) => !entry.isKorrigiert);
    }

    // Erinnerungs-Filter: nur Eintraege mit verknuepfter Erinnerung anzeigen
    // Zeigt nur Eintraege an, fuer die eine Erinnerung ERSTELLT wurde (linkedErinnerung),
    // NICHT automatisch generierte System-Eintraege (metadata.erinnerungId)
    if (erinnerungFilterActive) {
      result = result.filter((entry) => !!entry.linkedErinnerung);
    }

    // Inklusions-Filter für den Kontexttyp (z. B. 'patient')
    if (includedKontextType === 'patient') {
      result = result.filter((entry) => entry.kontext?.type === 'patient');
    }

    // Kategorie-Exclusion-Filter
    if (excludedKategorien.size > 0) {
      result = result.filter((entry) => !excludedKategorien.has(entry.kategorie));
    }

    return result;
  }, [entries, excludedKategorien, erinnerungFilterActive, showDeleted, includedKontextType]);

  // Synchronisiere lokalen Sortier-State mit Props
  useEffect(() => {
    setSorting([{ id: sortBy, desc: sortOrder === 'desc' }]);
  }, [sortBy, sortOrder]);

  // Intersection Observer fuer Infinite Scrolling
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

  // Verhindere Parent-Scrolling waehrend Table-Scroll
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

      // Verhindere Parent-Scrolling waehrend Table-Scroll
      e.preventDefault();
      container.scrollTop += e.deltaY;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel, { passive: false });
    };
  }, []);

  /**
   * Story 5.5: Scrollt zu einem ETB-Eintrag und hebt ihn hervor
   * Nutzt den Highlight-Store fuer reaktives Scrolling und Animation
   */
  const handleScrollToEntry = useCallback((entryId: string) => {
    setHighlightedEntry(entryId);
  }, []);

  // Column Definitions - Using extracted hook
  const columns = useEtbColumns({
    onEditEntry,
    onDeleteEntry,
    onShowHistory: setHistoryEntry,
    einsatzId,
  });

  // Table Instance - nutzt gefilterte Daten
  const table = useReactTable({
    data: filteredEntries,
    columns,
    state: {
      sorting,
      globalFilter,
      expanded,
    },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(newSorting);

      if (newSorting.length > 0) {
        const field = newSorting[0].id;
        const order = newSorting[0].desc ? 'desc' : 'asc';
        onSortChange?.(field, order);
      }
    },
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  // Virtualizer fuer Performance-Optimierung
  const { rows } = table.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: useCallback(() => 80, []), // Erhoehte Groesse fuer bessere Lesbarkeit mehrzeiliger Texte
    overscan: 10, // Weniger overscan fuer bessere Performance
    useFlushSync: false, // React 19: verhindert flushSync-Warnungen im Lifecycle des Virtualizers
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0) : 0;

  // Story 5.5: Highlight Store Integration - scrolle zu hervorgehobenen Eintraegen
  const highlightedEntryId = useHighlightedEntryId();

  useEffect(() => {
    if (!highlightedEntryId) return;

    // Finde den Index des Eintrags in der (gefilterten/sortierten) Tabelle
    const entryIndex = rows.findIndex((row) => row.original.id === highlightedEntryId);
    if (entryIndex === -1) return;

    // Scrolle zum Index mit dem Virtualizer
    rowVirtualizer.scrollToIndex(entryIndex, {
      align: 'center',
      behavior: 'smooth',
    });
  }, [highlightedEntryId, rows, rowVirtualizer]);

  // Empty State mit fester Hoehe fuer konsistentes Layout
  if (entries.length === 0 && !isLoading) {
    return (
      <div className="space-y-4">
        {/* Story 5.6: Filter-Controls - auch bei leerer Liste anzeigen fuer konsistentes Layout */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[200px] flex-1">
            <EtbSearchBar value={globalFilter} onChange={setGlobalFilter} />
          </div>
          <div className="w-48">
            <KategorieFilterSelect />
          </div>
        </div>

        {/* Empty State Container mit fester Hoehe */}
        <EtbEmptyState />
      </div>
    );
  }

  // Story 3.4 Task 1.2: Alle Eintraege durch Kategorie-/Erinnerungs-Filter ausgeblendet
  if (filteredEntries.length === 0 && entries.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[200px] flex-1">
            <EtbSearchBar value={globalFilter} onChange={setGlobalFilter} />
          </div>
          <div className="w-48">
            <KategorieFilterSelect />
          </div>
          {onShowDeletedChange && <EtbFilterControls showDeleted={showDeleted} onShowDeletedChange={onShowDeletedChange} />}
        </div>

        <div className="flex h-[600px] items-center justify-center overflow-hidden rounded-lg border border-border-subtle" role="status">
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-text-secondary">Alle Einträge durch Filter ausgeblendet</p>
            <button
              type="button"
              onClick={() => resetKategorieFilter()}
              className="rounded-md bg-action-secondary px-3 py-1.5 text-sm font-medium text-action-primary hover:bg-action-secondary-hover focus-visible:shadow-focus-ring focus-visible:outline-none"
            >
              Filter zurücksetzen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Story 5.6: Filter-Controls - Suche, Kategorie-Filter, Gelöschte anzeigen */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <EtbSearchBar value={globalFilter} onChange={setGlobalFilter} />
        </div>
        <div className="w-48">
          <KategorieFilterSelect />
        </div>
        {onShowDeletedChange && <EtbFilterControls showDeleted={showDeleted} onShowDeletedChange={onShowDeletedChange} />}
      </div>

      {/* Table */}
      <div
        ref={tableContainerRef}
        className="relative isolate overflow-hidden rounded-lg border border-border-subtle"
        aria-busy={!!isLoading || !!isFetchingNextPage}
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
        <table className="w-full" aria-label="ETB-Einträge" aria-rowcount={filteredEntries.length}>
          <EtbTableHeader headerGroups={table.getHeaderGroups()} />

          <EtbTableBody
            virtualRows={virtualRows}
            rows={rows}
            columns={columns}
            paddingTop={paddingTop}
            paddingBottom={paddingBottom}
            isLoading={isLoading}
            entries={filteredEntries}
            enableInlineEdit={enableInlineEdit}
            einsatzId={einsatzId}
            etbId={etbId}
            onEdit={onEditEntry}
            onDelete={onDeleteEntry}
            getUserName={getUserName}
            onEntryClick={handleScrollToEntry}
            globalFilter={globalFilter}
            allEntries={entries}
          />
        </table>

        {/* Loading Indicator for Next Page */}
        {isFetchingNextPage && (
          <div className="flex justify-center bg-surface-panel py-4">
            <PiCircleNotch className="h-6 w-6 animate-spin text-action-primary" />
          </div>
        )}

        {/* Observer Target for Infinite Scrolling */}
        <div ref={observerTarget} className="h-1" />
      </div>

      {/* Results Count - Story 5.6: beruecksichtigt Kategorie-Filter */}
      <EtbResultsCount filteredCount={table.getFilteredRowModel().rows.length} totalCount={filteredEntries.length} hasGlobalFilter={!!globalFilter || hasKategorieFilter} hasNextPage={hasNextPage} />

      {/* History Modal */}
      <EtbHistoryModal entry={historyEntry} etbId={etbId} isOpen={historyEntry !== null} onClose={() => setHistoryEntry(null)} />
    </div>
  );
}
