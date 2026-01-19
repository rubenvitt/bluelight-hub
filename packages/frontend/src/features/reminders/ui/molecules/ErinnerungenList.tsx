/**
 * Erinnerungen Liste
 *
 * Zeigt alle Erinnerungen fuer einen Einsatz an.
 *
 * **Story 1.3 AC1:** Liste zeigt alle Erinnerungen
 * **Story 1.3 AC3:** Bearbeiten nur bei GEPLANT Status
 */

import { PiAlarm, PiPlus } from 'react-icons/pi';
import { Button } from '@/shared/ui/atoms/button.atom';
import { cn } from '@/shared/ui/cn';
import { useErinnerungenByEinsatz } from '../../api';
import { openQuickCreateDialog } from '../../stores';
import { ErinnerungCard } from './ErinnerungCard';

interface ErinnerungenListProps {
  /** Einsatz-ID fuer die Erinnerungen */
  einsatzId: string;
  /** Zusaetzliche CSS-Klassen */
  className?: string;
  /** Kompakte Ansicht (weniger Padding, keine Header) */
  compact?: boolean;
}

/**
 * Liste aller Erinnerungen fuer einen Einsatz.
 *
 * Zeigt Erinnerungen sortiert nach Faelligkeit an.
 * Unterstuetzt Erstellen und Bearbeiten von Erinnerungen.
 */
export function ErinnerungenList({ einsatzId, className, compact = false }: ErinnerungenListProps) {
  const { data: erinnerungen, isLoading, error } = useErinnerungenByEinsatz({ einsatzId });

  const handleCreateClick = () => {
    openQuickCreateDialog(einsatzId);
  };

  // Sortiere Erinnerungen: GEPLANT zuerst (nach Faelligkeit), dann AUSGELOEST
  const sortedErinnerungen = [...(erinnerungen ?? [])].sort((a, b) => {
    // GEPLANT kommt vor AUSGELOEST
    if (a.status === 'GEPLANT' && b.status !== 'GEPLANT') return -1;
    if (a.status !== 'GEPLANT' && b.status === 'GEPLANT') return 1;
    // Innerhalb gleicher Status nach Faelligkeit sortieren
    return new Date(a.faelligAm).getTime() - new Date(b.faelligAm).getTime();
  });

  if (isLoading) {
    return (
      <div className={cn('animate-pulse', className)}>
        <div className="h-20 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="mt-2 h-20 rounded-lg bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20', className)}>
        <p className="text-red-700 text-sm dark:text-red-300">Fehler beim Laden der Erinnerungen</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header (nur wenn nicht kompakt) */}
      {!compact && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiAlarm className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Erinnerungen</h3>
            {sortedErinnerungen.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 text-xs dark:bg-amber-900/40 dark:text-amber-300">{sortedErinnerungen.length}</span>
            )}
          </div>
          <Button size="sm" appearance="ghost" onClick={handleCreateClick}>
            <PiPlus className="mr-1 h-4 w-4" />
            Neu
          </Button>
        </div>
      )}

      {/* Liste oder Empty State */}
      {sortedErinnerungen.length === 0 ? (
        <div className={cn('rounded-lg border border-dashed border-gray-300 p-6 text-center dark:border-gray-600', compact && 'p-4')}>
          <PiAlarm className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
          <p className="mt-2 text-gray-500 text-sm dark:text-gray-400">Keine Erinnerungen vorhanden</p>
          <Button size="sm" appearance="ghost" className="mt-3" onClick={handleCreateClick}>
            <PiPlus className="mr-1 h-4 w-4" />
            Erinnerung erstellen
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedErinnerungen.map((erinnerung) => (
            <ErinnerungCard key={erinnerung.id} erinnerung={erinnerung} einsatzId={einsatzId} />
          ))}
        </div>
      )}
    </div>
  );
}
