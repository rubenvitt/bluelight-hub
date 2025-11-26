import { Spinner } from '@/components/atoms/spinner.atom';
import { FullscreenCloseButton } from '@/components/organisms/lagekarte/FullscreenCloseButton/FullscreenCloseButton';
import { useEtbInfinite } from '@/hooks/useEtb';
import { useUserNames } from '@/hooks/useUsers';
import { cn } from '@/utils/cn';
import { formatDisplayDateTime } from '@/utils/dateFormatter';
import type { EtbEintragDto } from '@bluelight-hub/shared/client';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { PiWarning, PiCircleNotch, PiUser } from 'react-icons/pi';
import { EtbKategorieBadge } from '../components/EtbKategorieBadge';

/**
 * Props für die EtbFullscreenView-Komponente
 */
interface EtbFullscreenViewProps {
  /**
   * ID des Einsatzes für den das ETB angezeigt wird
   */
  einsatzId: string;
  /**
   * Sortierreihenfolge der Einträge
   * @default 'desc' (neueste zuerst)
   */
  sortOrder?: 'asc' | 'desc';
  /**
   * Gelöschte Einträge anzeigen
   * @default false
   */
  showDeleted?: boolean;
}

/**
 * ETB-Eintrag-Komponente für Fullscreen-Darstellung
 * Größere Schrift und mehr Whitespace für Display-Tauglichkeit
 */
interface EtbFullscreenEntryProps {
  entry: EtbEintragDto;
  getUserName: (id: string) => string | undefined;
}

const EtbFullscreenEntry: React.FC<EtbFullscreenEntryProps> = ({ entry, getUserName }) => {
  // Check if screenshot exists in metadata
  const hasScreenshot = entry.metadata && typeof entry.metadata === 'object' && 'screenshot' in entry.metadata;
  const screenshotUrl = hasScreenshot ? (entry.metadata as { screenshot?: { url?: string } }).screenshot?.url : null;

  return (
    <div className={cn('rounded-lg border p-6', 'bg-white dark:bg-gray-800', 'border-gray-200 dark:border-gray-700', 'shadow-sm', entry.deletedAt && 'opacity-50')}>
      {/* Header: Zeitstempel, Sequenznummer, Kategorie */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-gray-200 border-b pb-4 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono font-semibold text-2xl text-gray-900 dark:text-gray-100">#{entry.sequenceNumber}</span>
          <EtbKategorieBadge kategorie={entry.kategorie} size="lg" />
          {entry.deletedAt && <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700 text-sm dark:bg-red-900 dark:text-red-300">Gelöscht</span>}
        </div>
        <span className="font-medium text-gray-600 text-lg dark:text-gray-400">{formatDisplayDateTime(entry.timestamp)}</span>
      </div>

      {/* Text-Content */}
      <div className="mb-4">
        <p className={cn('whitespace-pre-wrap break-words text-xl leading-relaxed', entry.deletedAt ? 'text-gray-500 line-through dark:text-gray-400' : 'text-gray-900 dark:text-gray-100')}>
          {entry.text}
        </p>
      </div>

      {/* Screenshot Preview (if exists) */}
      {screenshotUrl && (
        <div className="mb-4">
          <img src={screenshotUrl} alt="Screenshot" className="h-auto max-w-full rounded-lg shadow" loading="lazy" />
        </div>
      )}

      {/* Meta-Informationen */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-gray-200 border-t pt-4 text-gray-600 text-sm dark:border-gray-700 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <PiUser className="h-4 w-4" />
          <span>{getUserName(entry.createdBy) ?? 'Unbekannt'}</span>
        </div>
        {entry.funkrufname && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Funkrufname:</span>
            <span>{entry.funkrufname}</span>
          </div>
        )}
        {entry.standort && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Standort:</span>
            <span>{entry.standort}</span>
          </div>
        )}
        {entry.isAutomatic && <span className="inline-flex items-center rounded bg-blue-100 px-2 py-1 text-blue-700 text-xs dark:bg-blue-900 dark:text-blue-300">🤖 Automatisch</span>}
      </div>
    </div>
  );
};

/**
 * Toolbar für Fullscreen-Modus mit Titel und Statistiken
 */
interface EtbFullscreenToolbarProps {
  totalEntries: number;
  loadedEntries: number;
  sortOrder: 'asc' | 'desc';
}

const EtbFullscreenToolbar: React.FC<EtbFullscreenToolbarProps> = ({ totalEntries, loadedEntries, sortOrder }) => {
  return (
    <div className="sticky top-0 z-10 border-gray-200 border-b bg-white px-6 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl text-gray-900 dark:text-gray-100">Einsatztagebuch</h1>
          <p className="mt-1 text-gray-600 text-sm dark:text-gray-400">
            {loadedEntries} von {totalEntries} Einträgen geladen · {sortOrder === 'desc' ? 'Neueste zuerst' : 'Älteste zuerst'}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * ETB-Fullscreen-View-Komponente
 *
 * Readonly-Darstellung des Einsatztagebuches im Vollbildmodus.
 *
 * Features:
 * - Fullscreen-Layout mit Close-Button
 * - Größere Schrift für Display-Tauglichkeit
 * - Infinite Scrolling für Performance
 * - Auto-Refresh alle 5 Sekunden
 * - Auto-Load weitere Einträge beim Scrollen
 * - Screenshot-Preview
 * - Chronologische Sortierung (konfigurierbar)
 *
 * @component
 * @example
 * ```tsx
 * <EtbFullscreenView einsatzId="einsatz-123" />
 * <EtbFullscreenView einsatzId="einsatz-123" sortOrder="asc" />
 * ```
 */
export function EtbFullscreenView({ einsatzId, sortOrder = 'desc', showDeleted = false }: EtbFullscreenViewProps) {
  const navigate = useNavigate();

  // Prop-Validierung: einsatzId darf nicht leer sein (vor Hook-Aufrufen prüfen)
  const isValidEinsatzId = einsatzId && einsatzId.trim() !== '';

  // Hooks müssen immer aufgerufen werden (React Rules of Hooks)
  // Bei ungültiger ID wird der Hook mit einem Dummy-Wert aufgerufen (disabled mode)
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useEtbInfinite(isValidEinsatzId ? einsatzId : '__invalid__', 20, 'sequenceNumber', sortOrder, showDeleted, {
    refetchInterval: 5000, // Auto-Refresh alle 5 Sekunden
    enabled: isValidEinsatzId, // Nur aktivieren wenn einsatzId gültig
  });

  const { getUserName } = useUserNames();
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Alle geladenen Einträge zusammenführen (benötigt für useEffect)
  const allEntries = data?.pages.flatMap((page) => page.data?.eintraege || []) || [];
  const totalEntries = data?.pages?.[0]?.pagination?.total || 0;

  // Intersection Observer für Infinite Scrolling (Hook muss vor Early Return!)
  useEffect(() => {
    // Skip effect wenn einsatzId ungültig
    if (!isValidEinsatzId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isValidEinsatzId]);

  /**
   * Handler zum Schließen des Fullscreen-Modus
   * Navigiert zurück zur Standard-ETB-Ansicht
   */
  const handleClose = () => {
    navigate({
      to: '.',
      search: (prev) => ({ ...prev, mode: 'standard' }),
      replace: true,
    });
  };

  // Early Return für ungültige einsatzId (nach allen Hooks!)
  if (!isValidEinsatzId) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <FullscreenCloseButton onClose={handleClose} />
        <PiWarning className="mb-4 h-16 w-16 text-orange-500" />
        <h2 className="mb-2 font-semibold text-2xl text-gray-900 dark:text-gray-100">Ungültige Einsatz-ID</h2>
        <p className="text-center text-gray-600 dark:text-gray-400">Die angegebene Einsatz-ID ist ungültig oder fehlt.</p>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <FullscreenCloseButton onClose={handleClose} />
        <PiWarning className="mb-4 h-16 w-16 text-orange-500" />
        <h2 className="mb-2 font-semibold text-2xl text-gray-900 dark:text-gray-100">ETB konnte nicht geladen werden</h2>
        <p className="text-center text-gray-600 dark:text-gray-400">Es ist ein Fehler beim Laden des Einsatztagebuchs aufgetreten.</p>
      </div>
    );
  }

  // Loading State (Initial)
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <FullscreenCloseButton onClose={handleClose} />
        <Spinner type="ring" size="lg" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">Lade Einsatztagebuch...</p>
      </div>
    );
  }

  // Empty State
  if (allEntries.length === 0) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <FullscreenCloseButton onClose={handleClose} />
        <h2 className="mb-2 font-semibold text-2xl text-gray-900 dark:text-gray-100">Keine Einträge vorhanden</h2>
        <p className="text-center text-gray-600 dark:text-gray-400">Es wurden noch keine ETB-Einträge für diesen Einsatz erstellt.</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-50 dark:bg-gray-900">
      {/* Fullscreen Close Button */}
      <FullscreenCloseButton onClose={handleClose} />

      {/* Toolbar */}
      <EtbFullscreenToolbar totalEntries={totalEntries} loadedEntries={allEntries.length} sortOrder={sortOrder} />

      {/* Einträge-Liste */}
      <div ref={scrollContainerRef} className="h-[calc(100vh-88px)] overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="mx-auto max-w-5xl space-y-4">
          {allEntries.map((entry) => (
            <EtbFullscreenEntry key={entry.id} entry={entry} getUserName={getUserName} />
          ))}

          {/* Loading Indicator for Next Page */}
          {isFetchingNextPage && (
            <div className="flex justify-center py-8">
              <PiCircleNotch className="h-8 w-8 animate-spin text-primary-500" />
            </div>
          )}

          {/* Observer Target for Infinite Scrolling */}
          <div ref={observerTarget} className="h-4" />

          {/* End Indicator */}
          {!hasNextPage && allEntries.length > 0 && (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              <p className="text-sm">Alle {totalEntries} Einträge geladen</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
