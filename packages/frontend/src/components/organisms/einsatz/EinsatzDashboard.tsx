import { MobileStatusBar } from '@/components/molecules/dashboard/MobileStatusBar';
import { StatusCard } from '@/components/molecules/dashboard/StatusCard';
import { EinsatzListItem } from '@/components/molecules/einsatz/EinsatzListItem';
import { SearchInput } from '@/components/molecules/search-input.molecule';
import { FilterPanel } from '@/components/organisms/dashboard/FilterPanel';
import { MobileFilterDialog } from '@/components/organisms/dashboard/MobileFilterDialog';
import { EinsatzCreateForm } from '@/components/organisms/einsatz/EinsatzCreateForm';
import { useActiveEinsaetzeWithCounts } from '@/hooks/useEinsaetze';
import { useEinsatzStatusCounts } from '@/hooks/useEinsatzStatusCounts';
import { Button } from '@atoms/button.atom';
import { EinsatzControllerFindAllVAlphaOrderByEnum, EinsatzControllerFindAllVAlphaOrderDirectionEnum, EinsatzResponseDtoStatusEnum } from '@bluelight-hub/shared/client';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { PiFunnel, PiFunnelX, PiPlus } from 'react-icons/pi';

interface SortOption {
  key: EinsatzControllerFindAllVAlphaOrderByEnum;
  direction: EinsatzControllerFindAllVAlphaOrderDirectionEnum;
}

export function EinsatzDashboard() {
  const [statusFilter, setStatusFilter] = useState<EinsatzResponseDtoStatusEnum | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>({
    key: EinsatzControllerFindAllVAlphaOrderByEnum.CreatedAt,
    direction: EinsatzControllerFindAllVAlphaOrderDirectionEnum.Desc,
  });
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Use optimized hook with counts
  const { data: rawEinsaetze = [], isLoading, error, refetch } = useActiveEinsaetzeWithCounts();

  // Apply client-side filtering and sorting
  const einsaetze = useMemo(() => {
    let filtered = rawEinsaetze;

    // Filter by status
    if (statusFilter) {
      filtered = filtered.filter((e) => e.status === statusFilter);
    } else if (!showArchived) {
      filtered = filtered.filter((e) => e.status !== EinsatzResponseDtoStatusEnum.Archiviert);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.alarmstichwort.toLowerCase().includes(term) ||
          e.nummer.toLowerCase().includes(term) ||
          e.einsatzort?.ort?.toLowerCase().includes(term) ||
          e.einsatzort?.strasse?.toLowerCase().includes(term),
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number | Date = a.createdAt;
      let bValue: string | number | Date = b.createdAt;

      if (sortOption.key === EinsatzControllerFindAllVAlphaOrderByEnum.Nummer) {
        aValue = a.nummer;
        bValue = b.nummer;
      } else if (sortOption.key === EinsatzControllerFindAllVAlphaOrderByEnum.Alarmstichwort) {
        aValue = a.alarmstichwort;
        bValue = b.alarmstichwort;
      } else if (sortOption.key === EinsatzControllerFindAllVAlphaOrderByEnum.Status) {
        aValue = a.status;
        bValue = b.status;
      }

      const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      return sortOption.direction === EinsatzControllerFindAllVAlphaOrderDirectionEnum.Desc ? -comparison : comparison;
    });

    return sorted;
  }, [rawEinsaetze, statusFilter, showArchived, searchTerm, sortOption]);

  const { total, counts } = useEinsatzStatusCounts(true);

  useHotkeys(
    'mod+n',
    () => {
      setIsCreatePanelOpen(true);
    },
    [setIsCreatePanelOpen],
    { preventDefault: true },
  );

  const handleSort = (key: SortOption['key']) => {
    setSortOption((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === EinsatzControllerFindAllVAlphaOrderDirectionEnum.Asc
          ? EinsatzControllerFindAllVAlphaOrderDirectionEnum.Desc
          : EinsatzControllerFindAllVAlphaOrderDirectionEnum.Asc,
    }));
  };

  const handleCreateSuccess = (_einsatzId: string) => {
    setIsCreatePanelOpen(false);
    refetch();
  };

  const handleArchiveToggle = () => {
    setShowArchived(!showArchived);
    if (!showArchived) {
      setStatusFilter(EinsatzResponseDtoStatusEnum.Archiviert);
    } else {
      setStatusFilter(undefined);
    }
  };

  const handleFilterReset = () => {
    setStatusFilter(undefined);
    setSortOption({
      key: EinsatzControllerFindAllVAlphaOrderByEnum.CreatedAt,
      direction: EinsatzControllerFindAllVAlphaOrderDirectionEnum.Desc,
    });
  };

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-red-600">Fehler beim Laden der Einsätze</p>
          <Button onClick={() => refetch()} className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Erneut versuchen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header - fixed height */}
      <div className="flex-shrink-0 border-gray-200 border-b bg-white px-2 py-3 sm:px-4 sm:py-4 lg:px-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-2xl text-gray-900 dark:text-white">Einsatz-Dashboard</h1>
          <Button onClick={() => setIsCreatePanelOpen(true)} title="Neuer Einsatz (Cmd+N)" kbd="Cmd+N">
            <PiPlus className="mr-2 h-5 w-5" />
            Neuer Einsatz
          </Button>
        </div>

        <MobileStatusBar total={total} counts={counts} />

        <div className="mt-4 hidden gap-4 sm:grid sm:grid-cols-5">
          <StatusCard label="Gesamt" value={total} variant="default" />
          <StatusCard label="Angelegt" value={counts.angelegt} variant="blue" />
          <StatusCard label="In Bearbeitung" value={counts.inBearbeitung} variant="yellow" />
          <StatusCard label="Abgeschlossen" value={counts.abgeschlossen} variant="green" />
          <StatusCard label="Archiviert" value={counts.archiviert} variant="gray" />
        </div>
      </div>

      {/* Filter & Search Bar - fixed height */}
      <div className="flex-shrink-0 border-gray-200 border-b bg-white px-2 py-2 sm:px-4 sm:py-3 lg:px-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <div className="flex-1">
            <SearchInput placeholder="Einsätze durchsuchen..." onDebouncedChange={setSearchTerm} delay={300} />
          </div>
          {/* Desktop Filter Button */}
          <Button onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)} intent="secondary" appearance="outline" className="hidden sm:flex">
            <PiFunnel className="mr-2 h-5 w-5" />
            Filter & Sortierung
          </Button>
          {/* Mobile Filter Button */}
          <Button onClick={() => setIsMobileFilterOpen(true)} intent="secondary" appearance="outline" className="sm:hidden">
            <PiFunnel className="mr-2 h-5 w-5" />
            Filter
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {isFilterPanelOpen && (
          <FilterPanel
            statusFilter={statusFilter}
            sortOption={sortOption}
            showArchived={showArchived}
            onStatusFilterChange={setStatusFilter}
            onSortChange={handleSort}
            onArchiveToggle={handleArchiveToggle}
            className="hidden sm:block"
          />
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain bg-gray-100 dark:bg-gray-950">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-blue-600 border-b-2"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Lade Einsätze...</p>
              </div>
            </div>
          ) : einsaetze.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="mb-4 text-gray-600 dark:text-gray-400">Keine Einsätze gefunden</p>
                {!statusFilter ? (
                  <Button onClick={() => setIsCreatePanelOpen(true)}>
                    <PiPlus className="mr-2 h-5 w-5" />
                    Ersten Einsatz erstellen
                  </Button>
                ) : (
                  <Button appearance="ghost" onClick={() => setStatusFilter(undefined)}>
                    <PiFunnelX className="mr-2 h-5 w-5" />
                    Filter entfernen
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="min-h-0 space-y-2 p-3 sm:p-4">
              {einsaetze.map((einsatz) => (
                <Link
                  key={einsatz.id}
                  to="/app/einsaetze/$einsatzId"
                  params={{ einsatzId: einsatz.id }}
                  className="block rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                >
                  <EinsatzListItem einsatz={einsatz} />
                </Link>
              ))}
              {einsaetze.length > 0 && <div className="p-4 text-center text-gray-500 text-sm dark:text-gray-400">{einsaetze.length} Einsätze geladen</div>}
            </div>
          )}
        </div>
      </div>

      <EinsatzCreateForm isOpen={isCreatePanelOpen} onClose={() => setIsCreatePanelOpen(false)} onSuccess={handleCreateSuccess} />

      <MobileFilterDialog
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        statusFilter={statusFilter}
        sortOption={sortOption}
        showArchived={showArchived}
        onStatusFilterChange={setStatusFilter}
        onSortChange={handleSort}
        onArchiveToggle={handleArchiveToggle}
        onReset={handleFilterReset}
      />
    </div>
  );
}
