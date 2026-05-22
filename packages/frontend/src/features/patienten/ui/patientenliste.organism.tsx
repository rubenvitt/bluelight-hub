/**
 * `PatientenListe` Organism (Story 1.6, AC7–AC11).
 *
 * Komponiert:
 *  - Toolbar (sticky) mit `SearchInput` (`/`-Shortcut), Filter-Pills, Sort-Dropdown,
 *    optionalem CTA (z. B. „+ Patient erfassen", in Story 1.6 als Slot übergeben).
 *  - Virtualisierte Tabellen-Zeilen via `@tanstack/react-virtual` (Vorbild
 *    `EtbEntryList`, 1:1-Pattern: `estimateSize: 56`, `overscan: 10`,
 *    `useFlushSync: false`, `paddingTop/Bottom`-Compensation).
 *  - Footer-Pagination ≥ 50 Treffer (Vor/Zurück + Seitenanzeige).
 *  - EmptyState-Branches: gefiltertes Leerergebnis (mit Reset-CTA) vs. Pure-Empty.
 *
 * Filter-State liegt extern (TanStack-Router-Search-Params); der Organism ist
 * controlled. `onFiltersChange` wird mit der NEUEN, vollständigen Filter-Map
 * gerufen — der Parent ist verantwortlich für `navigate({ search, replace: true })`.
 */
import { useHotkeys } from 'react-hotkeys-hook';
import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PiMagnifyingGlass, PiUsers, PiWarningCircle, PiX } from 'react-icons/pi';
import type { BehandlungsstatusEnum, PatientListItemDto, SkEnum, TransportstatusEnum } from '@bluelight-hub/shared/client';
import { EmptyState } from '@/shared/ui/molecules/empty-state.molecule';
import { SearchInput } from '@/shared/ui/molecules/search-input.molecule';
import { Button } from '@/shared/ui/atoms/button.atom';
import { Kbd } from '@/shared/ui/atoms/kbd.atom';
import { clsx } from 'clsx';
import { BEHANDLUNG_LABELS } from '../constants/behandlungs-status-labels';
import { SK_LABELS } from '../constants/sk-labels';
import { TRANSPORT_LABELS } from '../constants/transport-status-labels';
import { usePatientenList, type PatientenListFilters } from '../api/use-patienten-list';
import { PatientListRow } from './patient-list-row.molecule';

interface PatientenListeProps {
  einsatzId: string;
  filters: PatientenListFilters;
  onFiltersChange: (next: PatientenListFilters) => void;
  /** Optional: wird in Story 1.7 mit Detail-Drawer-Open verdrahtet. */
  onRowClick?: (patientId: string) => void;
  /** Optionaler CTA-Slot rechts in der Toolbar (z. B. „+ Patient erfassen"). */
  toolbarCta?: React.ReactNode;
  /** Optional: Erfassen-Drawer aus Pure-Empty-State öffnen (Spec AC10). */
  onErfasseClick?: () => void;
  className?: string;
}

const ROW_HEIGHT = 56;
const PAGE_SIZE_OPTIONS = [25, 50, 100];

export function PatientenListe({ einsatzId, filters, onFiltersChange, onRowClick, toolbarCta, onErfasseClick, className }: PatientenListeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const query = usePatientenList(einsatzId, filters);
  const items = query.data?.items ?? [];
  const pagination = query.data?.pagination;

  // `enableOnFormTags: false` schützt SearchInput-/SELECT-/contenteditable-Foki
  // (Code-Review P2 — AC11 Spec-Letter); damit erfasst der `/`-Shortcut den
  // Fokus weder mitten in der Patientenerfassung noch in den Sort-/PageSize-
  // Dropdowns der Toolbar.
  useHotkeys(
    '/',
    (event) => {
      event.preventDefault();
      searchInputRef.current?.focus();
    },
    { enableOnFormTags: false, enableOnContentEditable: false },
  );

  // Page-Clamp gegen stale URL-Bookmarks (`?page=99` bei `total=10/pageSize=50`).
  // Wenn der Backend-Result einen `page > totalPages > 0` zurückgibt, kommen
  // Frontend auf eine letzte gültige Seite zurück (Code-Review P3).
  useEffect(() => {
    if (!pagination) return;
    if (pagination.total > 0 && pagination.totalPages > 0 && pagination.page > pagination.totalPages) {
      onFiltersChange({ ...filters, page: pagination.totalPages });
    }
    // `onFiltersChange`/`filters` sind in der Effect-Lifecycle stabil
    // (Search-Param-driven); Re-Run nur bei pagination-Delta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination?.page, pagination?.totalPages, pagination?.total]);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    useFlushSync: false,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0;
  // `Math.max(0, …)`-Guard verhindert negative `paddingBottom`-Werte bei
  // rapider Filter-Mutation, wenn der letzte virtuelle Row-`end` kurzzeitig
  // > `totalSize` ist (Code-Review P13).
  const paddingBottom = virtualRows.length > 0 ? Math.max(0, totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)) : 0;

  const updateFilters = (patch: Partial<PatientenListFilters>) => {
    onFiltersChange({ ...filters, ...patch, page: 1 });
  };

  const removeSkFilter = (value: SkEnum) => {
    updateFilters({ sk: filters.sk?.filter((v) => v !== value) });
  };
  const removeBehandlungFilter = (value: BehandlungsstatusEnum) => {
    updateFilters({ behandlungsstatus: filters.behandlungsstatus?.filter((v) => v !== value) });
  };
  const removeTransportFilter = (value: TransportstatusEnum) => {
    updateFilters({ transportstatus: filters.transportstatus?.filter((v) => v !== value) });
  };

  const resetAllFilters = () => {
    onFiltersChange({
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      page: 1,
      pageSize: filters.pageSize,
    });
  };

  const hasActiveFilters = (filters.sk?.length ?? 0) > 0 || (filters.behandlungsstatus?.length ?? 0) > 0 || (filters.transportstatus?.length ?? 0) > 0 || (filters.search ?? '').length > 0;

  const isEmptyResult = !query.isPending && items.length === 0 && (pagination?.total ?? 0) === 0;
  const isPureEmpty = isEmptyResult && !hasActiveFilters;
  const isFilteredEmpty = isEmptyResult && hasActiveFilters;

  const sortValue = `${filters.sortBy ?? 'sk'}:${filters.sortDir ?? 'asc'}`;

  return (
    <div className={clsx('flex h-full flex-col', className)} data-testid="patienten-liste">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-border-subtle bg-surface-panel px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <SearchInput
              ref={searchInputRef}
              value={filters.search ?? ''}
              onDebouncedChange={(value) => updateFilters({ search: value || undefined })}
              placeholder="Patientennummer, DIVI-VAK oder Pseudonym suchen…"
              delay={300}
              autoFocus={false}
            />
          </div>
          <span className="hidden items-center gap-1 text-xs text-text-muted sm:flex">
            <Kbd keys="/" size="sm" /> fokussiert die Suche
          </span>

          <label className="flex items-center gap-2 text-sm">
            <span className="text-text-secondary">Sortierung:</span>
            <select
              data-testid="patienten-liste-sort-select"
              value={sortValue}
              onChange={(event) => {
                const [field, dir] = event.target.value.split(':') as ['sk' | 'zeit' | 'patientennummer', 'asc' | 'desc'];
                onFiltersChange({ ...filters, sortBy: field, sortDir: dir, page: 1 });
              }}
              className="border-border-default bg-surface-default rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="sk:asc">SK-Priorität ↑</option>
              <option value="sk:desc">SK-Priorität ↓</option>
              <option value="zeit:desc">Erfassungszeit ↓ (neueste)</option>
              <option value="zeit:asc">Erfassungszeit ↑</option>
              <option value="patientennummer:asc">Patientennummer ↑</option>
              <option value="patientennummer:desc">Patientennummer ↓</option>
            </select>
          </label>

          {toolbarCta}
        </div>

        {hasActiveFilters ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="patienten-liste-filter-pills">
            {(filters.sk ?? []).map((value) => (
              <FilterPill key={`sk-${value}`} label={`SK: ${SK_LABELS[value].shortLabel}`} onRemove={() => removeSkFilter(value)} />
            ))}
            {(filters.behandlungsstatus ?? []).map((value) => (
              <FilterPill key={`b-${value}`} label={`Behandlung: ${BEHANDLUNG_LABELS[value].shortLabel}`} onRemove={() => removeBehandlungFilter(value)} />
            ))}
            {(filters.transportstatus ?? []).map((value) => (
              <FilterPill key={`t-${value}`} label={`Transport: ${TRANSPORT_LABELS[value].shortLabel}`} onRemove={() => removeTransportFilter(value)} />
            ))}
            {filters.search ? <FilterPill label={`Suche: „${filters.search}"`} onRemove={() => updateFilters({ search: undefined })} /> : null}
            <Button appearance="ghost" onClick={resetAllFilters} data-testid="patienten-liste-reset-filters">
              Alle Filter löschen
            </Button>
          </div>
        ) : null}
      </div>

      {/* Tabelle */}
      {query.isError ? (
        // Backend-4xx/5xx werden hier sichtbar, statt User stillschweigend
        // leeren Container zu zeigen (Code-Review P4). Bewusst kein Klartext-
        // Sentinel im Description, damit `Validation:*`-Codes nicht leaken
        // (Lessons-Learned 1.3/1.4).
        <EmptyState
          icon={PiWarningCircle}
          title="Patientenliste konnte nicht geladen werden"
          description="Bitte Verbindung prüfen und erneut versuchen."
          action={{ label: 'Erneut laden', onClick: () => query.refetch() }}
        />
      ) : isPureEmpty ? (
        <EmptyState
          icon={PiUsers}
          title="Noch keine Patienten erfasst"
          description="Beginne mit der Patientenerfassung über den Button im Toolbar."
          // Spec AC10: Pure-Empty bietet primär den Erfassen-CTA an
          // (Code-Review P7). Fallback auf Refetch, falls Parent keinen
          // Drawer-Opener bereitstellt.
          action={onErfasseClick ? { label: '+ Patient erfassen', onClick: onErfasseClick } : { label: 'Neu laden', onClick: () => query.refetch() }}
        />
      ) : isFilteredEmpty ? (
        <EmptyState
          icon={PiMagnifyingGlass}
          title="Keine Patienten passen zum Filter"
          description="Mit den gesetzten Filterwerten gibt es aktuell keine Treffer."
          action={{ label: 'Filter zurücksetzen', onClick: resetAllFilters }}
        />
      ) : (
        <div ref={containerRef} role="table" aria-label="Patientenliste" className="flex-1 overflow-auto" data-testid="patienten-liste-scroll" style={{ maxHeight: 'calc(100dvh - 16rem)' }}>
          <div role="rowgroup" style={{ height: totalSize, paddingTop, paddingBottom, position: 'relative' }}>
            {virtualRows.map((virtualRow) => {
              const patient: PatientListItemDto | undefined = items[virtualRow.index];
              if (!patient) return null;
              return <PatientListRow key={patient.id} patient={patient} onClick={onRowClick ? () => onRowClick(patient.id) : undefined} />;
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-surface-panel px-4 py-2 text-sm">
          <span className="text-text-secondary">
            Zeige {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.total, pagination.page * pagination.pageSize)} von {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-text-secondary">
              <span>Seitengröße:</span>
              <select
                data-testid="patienten-liste-pagesize-select"
                value={pagination.pageSize}
                onChange={(event) => {
                  onFiltersChange({ ...filters, pageSize: Number(event.target.value), page: 1 });
                }}
                className="border-border-default bg-surface-default rounded-md border px-2 py-1 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
            <Button appearance="ghost" disabled={pagination.page <= 1} onClick={() => onFiltersChange({ ...filters, page: pagination.page - 1 })} data-testid="patienten-liste-prev-page">
              Zurück
            </Button>
            <span className="text-text-secondary">
              Seite {pagination.page} / {Math.max(1, pagination.totalPages)}
            </span>
            <Button
              appearance="ghost"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onFiltersChange({ ...filters, page: pagination.page + 1 })}
              data-testid="patienten-liste-next-page"
            >
              Weiter
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="border-border-default hover:bg-surface-default inline-flex min-h-8 items-center gap-1.5 rounded-full border bg-surface-elevated px-3 py-1 text-xs font-medium text-text-primary focus-visible:shadow-focus-ring focus-visible:outline-none"
      aria-label={`Filter entfernen: ${label}`}
    >
      <span>{label}</span>
      <PiX className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}
