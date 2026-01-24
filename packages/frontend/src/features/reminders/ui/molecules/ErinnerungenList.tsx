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
 * **Story 3.1:** Tabs fuer "Meine" / "Team" Ansicht
 * **Story 3.2 AC1:** Echtzeit-Updates via WebSocket
 * **Story 3.2 AC3:** Toast-Notification bei Team-Events
 * **Story 3.6:** Filter fuer Team-Erinnerungen nach Zuweisung
 */

import { useCallback, useEffect, useMemo } from 'react';
import type { ErinnerungResponseDto } from '@/shared';
import { Button } from '@/shared/ui/atoms/button.atom';
import { cn } from '@/shared/ui/cn';
import { Tabs } from '@/shared/ui/molecules/tabs.molecule';
import { PiAlarm, PiPlus, PiWifiHigh, PiWifiSlash } from 'react-icons/pi';
import { toast } from 'sonner';
import { useCurrentUser } from '@/features/auth';
import { useAktiveEinsatzTeilnehmer } from '@/features/einsatz/api';
import { sanitizeName } from '@/shared/utils/sanitize';
import { useErinnerungenByEinsatz } from '../../api';
import { useAlarmTrigger, useErinnerungWebSocket, useOfflineStatus, useReconnectSync, useTrayBadge, useTrayClickNavigation } from '../../hooks';
import { addAnimatedId, openQuickCreateDialog, resetTeamFilterStore, setAvailableTeilnehmer, setTeamFilter, useAvailableTeilnehmer, useTeamFilter, type TeamFilterType } from '../../stores';
import { getUrgencyLevel } from '../../utils/countdown-utils';
import { TeamFilterDropdown } from '../atoms/TeamFilterDropdown';
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
 * Story 3.6 Issue #5: Helper zur Pruefung ob Erinnerung dem User gehoert.
 *
 * Eine Erinnerung gehoert dem User wenn:
 * - Er sie erstellt hat (erstelltVon)
 * - Oder sie ihm zugewiesen wurde (assignedToId)
 */
function isMyErinnerung(erinnerung: ErinnerungResponseDto, userId: string): boolean {
  return erinnerung.erstelltVon === userId || erinnerung.assignedToId === userId;
}

/**
 * Liste aller Erinnerungen fuer einen Einsatz.
 *
 * Zeigt Erinnerungen sortiert nach Faelligkeit an.
 * Unterstuetzt Erstellen und Bearbeiten von Erinnerungen.
 *
 * Story 3.6 Issue #6: Wrapper-Komponente mit User-Guard.
 * Delegiert an ErinnerungenListInner wenn User eingeloggt ist.
 */
export function ErinnerungenList({ einsatzId, className, compact = false }: ErinnerungenListProps) {
  const { user } = useCurrentUser();

  // Story 3.6 Issue #6: Guard - User muss eingeloggt sein
  if (!user) {
    return (
      <div className={cn('rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20', className)}>
        <p className="text-sm text-yellow-700 dark:text-yellow-300">Bitte einloggen um Erinnerungen zu sehen</p>
      </div>
    );
  }

  // Nach Guard ist user garantiert non-null - rendere innere Komponente
  return <ErinnerungenListInner einsatzId={einsatzId} className={className} compact={compact} currentUserId={user.id} />;
}

/**
 * Props fuer die innere Erinnerungen-Liste Komponente.
 */
interface ErinnerungenListInnerProps extends ErinnerungenListProps {
  /** Garantiert non-null User-ID (nach Guard in Wrapper) */
  currentUserId: string;
}

/**
 * Innere Komponente mit allen Hooks.
 *
 * Wird nur gerendert wenn User eingeloggt ist (currentUserId garantiert non-null).
 * Ermoeglicht saubere Hook-Aufrufe ohne bedingte Logik (React Rules of Hooks).
 */
function ErinnerungenListInner({ einsatzId, className, compact = false, currentUserId }: ErinnerungenListInnerProps) {
  const { data: erinnerungen, isLoading, error } = useErinnerungenByEinsatz({ einsatzId });

  // Story 3.6 Task 3.1: Team-Filter Store Hooks
  const selectedFilter = useTeamFilter();
  const availableTeilnehmer = useAvailableTeilnehmer();

  // Story 3.6 Task 3.4: Teilnehmer aus Einsatz laden
  const { data: einsatzTeilnehmer } = useAktiveEinsatzTeilnehmer(einsatzId);

  /**
   * Story 3.6 Issue #4: Cleanup bei Unmount
   *
   * Resettet den Team-Filter Store wenn die Komponente unmountet wird.
   * Verhindert Memory Leaks und stale Filter-States.
   */
  useEffect(() => {
    return () => {
      resetTeamFilterStore();
    };
  }, []);

  /**
   * Story 3.6 Issue #2 Fix: Primary Effect - Einsatz-Teilnehmer (hat Prioritaet)
   * Story 3.6 Issue #3: XSS Defense-in-Depth - Namen werden sanitiert
   *
   * Setzt die verfuegbaren Teilnehmer aus den Einsatz-Teilnehmern.
   * Dieser Effect hat Prioritaet - wenn Einsatz-Teilnehmer vorhanden sind,
   * werden sie verwendet (unabhaengig vom Fallback).
   */
  useEffect(() => {
    if (einsatzTeilnehmer && einsatzTeilnehmer.length > 0) {
      // Mapping von AktiveTeilnehmerResponseDto zu Teilnehmer Format
      const teilnehmerList = einsatzTeilnehmer.map((t) => ({
        id: t.userId,
        name: sanitizeName(t.username || t.funkrufname),
      }));
      setAvailableTeilnehmer(teilnehmerList);
    }
  }, [einsatzTeilnehmer]);

  /**
   * Story 3.6 Issue #2 Fix: Fallback Effect - Teilnehmer aus Erinnerungen
   * Story 3.6 Issue #3: XSS Defense-in-Depth - Namen werden sanitiert
   *
   * Wird nur verwendet wenn KEINE Einsatz-Teilnehmer vorhanden sind.
   * Extrahiert Teilnehmer aus den Erinnerungen (erstelltVon, assignedTo).
   *
   * Separate Effects verhindern Race Conditions zwischen Primary und Fallback.
   */
  useEffect(() => {
    // Nur wenn keine Einsatz-Teilnehmer vorhanden sind
    if ((!einsatzTeilnehmer || einsatzTeilnehmer.length === 0) && erinnerungen && erinnerungen.length > 0) {
      // Story 3.6 Task 4.4: Fallback - Teilnehmer aus Erinnerungen extrahieren
      const teilnehmerMap = new Map<string, string>();
      for (const e of erinnerungen) {
        if (e.erstelltVon && e.erstellerName) {
          teilnehmerMap.set(e.erstelltVon, sanitizeName(e.erstellerName));
        }
        if (e.assignedToId && e.assignedToName) {
          teilnehmerMap.set(e.assignedToId, sanitizeName(e.assignedToName));
        }
      }
      const fallbackList = Array.from(teilnehmerMap, ([id, name]) => ({ id, name }));
      setAvailableTeilnehmer(fallbackList);
    }
  }, [einsatzTeilnehmer, erinnerungen]);

  // Story 3.6 Task 3.1: Filter-Change Handler
  const handleFilterChange = useCallback((filter: TeamFilterType) => {
    setTeamFilter(filter);
  }, []);

  // Story 1.8: Offline-Status und Sync-Handling
  const { isOffline, pendingActionsCount, offlineSince } = useOfflineStatus();
  const { isSyncing } = useReconnectSync(einsatzId);

  // Story 1.9: Tray-Badge synchronisieren und Tray-Click Navigation
  useTrayBadge();
  useTrayClickNavigation(einsatzId);

  // Story 3.2 AC2: Animation-Callbacks fuer WebSocket-Events
  const handleWebSocketCreated = useCallback((event: { erinnerungId: string }) => {
    addAnimatedId(event.erinnerungId, 'insert');
  }, []);

  const handleWebSocketUpdated = useCallback((event: { erinnerungId: string }) => {
    addAnimatedId(event.erinnerungId, 'update');
  }, []);

  const handleWebSocketAcknowledged = useCallback((event: { erinnerungId: string }) => {
    addAnimatedId(event.erinnerungId, 'update');
  }, []);

  // Story 3.2 AC1+AC3: WebSocket fuer Echtzeit-Updates und Team-Toasts
  const { isConnected } = useErinnerungWebSocket({
    einsatzId,
    enabled: true,
    showTeamToasts: true, // AC3: Toast bei Team-Events
    // Story 3.2 AC2: Animation bei Status-Aenderung
    onCreated: handleWebSocketCreated,
    onUpdated: handleWebSocketUpdated,
    onAcknowledged: handleWebSocketAcknowledged,
  });

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

  /**
   * Story 3.1 AC2: Filter-Logik fuer "Meine" Erinnerungen
   * Story 3.6 Issue #5: Nutzt extrahierte Helper-Funktion
   */
  const myErinnerungen = useMemo(() => {
    return sortedErinnerungen.filter((e) => isMyErinnerung(e, currentUserId));
  }, [sortedErinnerungen, currentUserId]);

  // Story 3.1 AC6: Team-Tab zeigt alle nicht-abgeschlossenen Erinnerungen
  const teamErinnerungen = useMemo(() => {
    return sortedErinnerungen.filter((e) => e.status !== 'ERLEDIGT');
  }, [sortedErinnerungen]);

  /**
   * Story 3.6 Task 3.2: Gefilterte Team-Erinnerungen basierend auf selectedFilter
   * Story 3.6 Issue #5: Nutzt extrahierte Helper-Funktion fuer 'mine' case
   *
   * Filter-Logik (Tagged Union):
   * - { type: 'all' }: Alle Team-Erinnerungen (AC5)
   * - { type: 'mine' }: Ersteller ODER Zugewiesener === currentUserId (AC3)
   * - { type: 'unassigned' }: assignedToId ist null/undefined (AC4)
   * - { type: 'user', userId }: assignedToId === userId (AC2)
   */
  const filteredTeamErinnerungen = useMemo(() => {
    const base = teamErinnerungen;

    switch (selectedFilter.type) {
      case 'all':
        return base;
      case 'mine':
        return base.filter((e) => isMyErinnerung(e, currentUserId));
      case 'unassigned':
        return base.filter((e) => !e.assignedToId);
      case 'user':
        // AC2: Filter by specific userId
        return base.filter((e) => e.assignedToId === selectedFilter.userId);
    }
  }, [teamErinnerungen, selectedFilter, currentUserId]);

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
            {/* Story 3.2 Task 1.2: WebSocket-Status-Indikator */}
            <span
              className={cn(
                'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs',
                isConnected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
              )}
              title={isConnected ? 'Echtzeit-Updates aktiv' : 'Verbindung unterbrochen'}
            >
              {isConnected ? <PiWifiHigh className="h-3 w-3" /> : <PiWifiSlash className="h-3 w-3" />}
            </span>
          </div>
          <Button size="sm" appearance="ghost" onClick={handleCreateClick}>
            <PiPlus className="mr-1 h-4 w-4" />
            Neu
          </Button>
        </div>
      )}

      {/* Story 3.1 AC1: Tabs fuer "Meine" / "Team" Ansicht */}
      <Tabs
        items={[
          {
            label: `Meine (${myErinnerungen.length})`,
            content: (
              <ErinnerungListContent
                erinnerungen={myErinnerungen}
                einsatzId={einsatzId}
                currentUserId={currentUserId}
                showCreator={false}
                compact={compact}
                onCreateClick={handleCreateClick}
                emptyMessage="Du hast keine eigenen Erinnerungen"
              />
            ),
          },
          {
            label: `Team (${teamErinnerungen.length})`,
            content: (
              <div className="space-y-3">
                {/* Story 3.6 Task 3.3: TeamFilterDropdown im Team-Tab Header */}
                <div className="flex items-center justify-between gap-2">
                  <TeamFilterDropdown selectedFilter={selectedFilter} onFilterChange={handleFilterChange} teilnehmer={availableTeilnehmer} currentUserId={currentUserId} className="w-44" />
                  {/* Story 3.6 AC2: Anzeige der gefilterten Anzahl */}
                  {selectedFilter.type !== 'all' && (
                    <span className="text-gray-500 text-xs dark:text-gray-400">
                      {filteredTeamErinnerungen.length} von {teamErinnerungen.length}
                    </span>
                  )}
                </div>
                <ErinnerungListContent
                  erinnerungen={filteredTeamErinnerungen}
                  einsatzId={einsatzId}
                  currentUserId={currentUserId}
                  showCreator={true}
                  compact={compact}
                  onCreateClick={handleCreateClick}
                  emptyMessage={selectedFilter.type === 'all' ? 'Keine Team-Erinnerungen vorhanden' : 'Keine Erinnerungen fuer diesen Filter'}
                />
              </div>
            ),
          },
        ]}
        defaultIndex={0}
      />
    </div>
  );
}

/**
 * Interne Hilfskomponente fuer die Erinnerungsliste innerhalb der Tabs.
 *
 * Rendert entweder die Liste der Erinnerungen oder einen Empty State.
 */
interface ErinnerungListContentProps {
  erinnerungen: ErinnerungResponseDto[];
  einsatzId: string;
  currentUserId?: string;
  showCreator: boolean;
  compact: boolean;
  onCreateClick: () => void;
  emptyMessage: string;
}

function ErinnerungListContent({ erinnerungen, einsatzId, currentUserId, showCreator, compact, onCreateClick, emptyMessage }: ErinnerungListContentProps) {
  if (erinnerungen.length === 0) {
    return (
      <div className={cn('rounded-lg border border-gray-300 border-dashed p-6 text-center dark:border-gray-600', compact && 'p-4')}>
        <PiAlarm className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
        <p className="mt-2 text-gray-500 text-sm dark:text-gray-400">{emptyMessage}</p>
        <Button size="sm" appearance="ghost" className="mt-3" onClick={onCreateClick}>
          <PiPlus className="mr-1 h-4 w-4" />
          Erinnerung erstellen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {erinnerungen.map((erinnerung) => (
        <ErinnerungCard key={erinnerung.id} erinnerung={erinnerung} einsatzId={einsatzId} showCreator={showCreator} currentUserId={currentUserId} />
      ))}
    </div>
  );
}
