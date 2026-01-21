/**
 * Erinnerungen Liste
 *
 * Zeigt alle Erinnerungen fuer einen Einsatz an.
 *
 * **Story 1.3 AC1:** Liste zeigt alle Erinnerungen
 * **Story 1.3 AC3:** Bearbeiten nur bei GEPLANT Status
 * **Story 1.5:** Automatischer Alarm bei Faelligkeit
 * **Story 1.7 AC5:** Sortierung nach Urgency Level
 * **Story 1.8 AC1:** Offline-Banner und Sync-Status
 * **Story 2.4 AC2:** FloatingPill Portal fuer urgent Alarme
 */

import { useMemo } from 'react';
import type { ErinnerungResponseDto } from '@/shared';
import { Button } from '@/shared/ui/atoms/button.atom';
import { cn } from '@/shared/ui/cn';
import { PiAlarm, PiPlus } from 'react-icons/pi';
import { toast } from 'sonner';
import { useErinnerungenByEinsatz } from '../../api';
import { useAlarmTrigger, useOfflineStatus, useReconnectSync, useTrayBadge, useTrayClickNavigation } from '../../hooks';
import { openQuickCreateDialog } from '../../stores';
import { getUrgencyLevel } from '../../utils/countdown-utils';
import { FloatingPillPortal } from '../organisms/FloatingPillPortal';
import { ErinnerungCard } from './ErinnerungCard';
import { OfflineBanner } from './OfflineBanner';

/**
 * Story 1.7 AC5: Berechnet Sortierungs-Priorität basierend auf Status und Urgency
 *
 * Priorität (niedrigere Zahl = höhere Priorität):
 * - AUSGELOEST: 0 (höchste Priorität - sofortige Aufmerksamkeit)
 * - GEPLANT critical: 1
 * - GEPLANT urgent: 2
 * - GEPLANT warning: 3
 * - GEPLANT normal: 4
 * - ACKNOWLEDGED: 5
 * - SNOOZED: 6
 * - ERLEDIGT: 7 (niedrigste Priorität)
 */
function getSortPriority(erinnerung: ErinnerungResponseDto): number {
  const status = erinnerung.status;

  // AUSGELOEST immer oben
  if (status === 'AUSGELOEST') return 0;

  // GEPLANT mit Urgency-basierter Sortierung
  if (status === 'GEPLANT') {
    const now = new Date();
    const faelligAm = new Date(erinnerung.faelligAm);
    const remainingMs = faelligAm.getTime() - now.getTime();
    const urgency = getUrgencyLevel(remainingMs);

    switch (urgency) {
      case 'critical':
        return 1;
      case 'urgent':
        return 2;
      case 'warning':
        return 3;
      default:
        return 4;
    }
  }

  // Andere Status nach Priorität
  if (status === 'ACKNOWLEDGED') return 5;
  if (status === 'SNOOZED') return 6;
  if (status === 'ERLEDIGT') return 7;

  // Fallback für unbekannte Status
  return 8;
}

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

  // Story 1.8: Offline-Status und Sync-Handling
  const { isOffline, pendingActionsCount, offlineSince } = useOfflineStatus();
  const { isSyncing } = useReconnectSync(einsatzId);

  // Story 1.9: Tray-Badge synchronisieren und Tray-Click Navigation
  useTrayBadge();
  useTrayClickNavigation(einsatzId);

  // Story 1.5: Alarm Trigger Hook fuer automatische Erinnerungs-Ausloesung
  useAlarmTrigger({
    erinnerungen: erinnerungen ?? [],
    einsatzId,
    enabled: !isLoading && !error,
    onTriggerSuccess: (erinnerung) => {
      toast.success('Erinnerung ausgelöst', {
        description: erinnerung.titel,
        duration: 10000, // 10 Sekunden sichtbar
      });
    },
    onTriggerError: (erinnerung, err) => {
      toast.error('Erinnerung fehlgeschlagen', {
        description: `${erinnerung.titel}: ${err.message}`,
      });
    },
  });

  const handleCreateClick = () => {
    openQuickCreateDialog(einsatzId);
  };

  // Story 1.7 AC5: Sortiere nach Urgency Level und dann nach Fälligkeit
  const sortedErinnerungen = useMemo(() => {
    return [...(erinnerungen ?? [])].sort((a, b) => {
      // Primär: Nach Priorität (AUSGELOEST > GEPLANT urgent > ... > ERLEDIGT)
      const priorityA = getSortPriority(a);
      const priorityB = getSortPriority(b);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Sekundär: Innerhalb gleicher Priorität nach Fälligkeit aufsteigend
      return new Date(a.faelligAm).getTime() - new Date(b.faelligAm).getTime();
    });
  }, [erinnerungen]);

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
      {/* Story 2.4 AC2: FloatingPill Portal fuer urgent Alarme */}
      <FloatingPillPortal einsatzId={einsatzId} />

      {/* Story 1.8 AC1: Offline-Banner */}
      <OfflineBanner isOffline={isOffline} pendingCount={pendingActionsCount} isSyncing={isSyncing} offlineSince={offlineSince} className="mb-2 rounded-lg" />

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
        <div className={cn('rounded-lg border border-gray-300 border-dashed p-6 text-center dark:border-gray-600', compact && 'p-4')}>
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
