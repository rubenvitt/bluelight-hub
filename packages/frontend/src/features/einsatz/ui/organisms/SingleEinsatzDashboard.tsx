import { api } from '@/shared';
import { ErrorState } from '@/shared/ui/atoms/ErrorState';
import { LoadingState } from '@/shared/ui/atoms/LoadingState';
import { EinsatzResourceWidget } from '@/features/einsatz/ui/molecules/EinsatzResourceWidget';
import { EinsatzStatsCard } from '@/features/einsatz/ui/molecules/EinsatzStatsCard';
import { EinsatzTimelineWidget } from '@/features/einsatz/ui/molecules/EinsatzTimelineWidget';
import { FahrzeugHinzufuegenDialog } from '@/features/einsatz/ui/organisms/FahrzeugHinzufuegenDialog.organism';
import { PersonHinzufuegenDialog } from '@/features/einsatz/ui/organisms/PersonHinzufuegenDialog.organism';
import { useActiveEinsatz, EINSATZ_QUERY_KEYS, useEinsatzFahrzeuge, useUpdateFmsStatus } from '@/features/einsatz';
import type { FmsStatus } from '@/features/einsatz';
import { useEtb } from '@/features/etb';
import { useLagekarte } from '@/features/lagekarte';
import { ErinnerungenList } from '@/features/reminders';
import { formatNatoDateTime } from '@/shared/lib/dateFormatter';
import { Button } from '@/shared/ui/atoms/button.atom';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { addMinutes, format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useCallback, useEffect, useState } from 'react';
import { PiClipboard, PiClock, PiFileText, PiMapPin, PiPhone, PiRadio, PiTruck, PiUsers } from 'react-icons/pi';

/**
 * Dashboard für einen einzelnen aktiven Einsatz
 *
 * Hauptarbeitsansicht mit allen relevanten Informationen und Schnellzugriffen
 */
export function SingleEinsatzDashboard() {
  const { einsatzId } = useParams({ from: '/app/einsatz/$einsatzId' });
  const { activeEinsatz, setActiveEinsatz, isEinsatzActive } = useActiveEinsatz();

  // Dialog State für Fahrzeug hinzufügen (Story 3-1)
  const [showFahrzeugDialog, setShowFahrzeugDialog] = useState(false);
  const handleOpenFahrzeugDialog = useCallback(() => setShowFahrzeugDialog(true), []);
  const handleCloseFahrzeugDialog = useCallback(() => setShowFahrzeugDialog(false), []);

  // Dialog State für Person hinzufügen (Story 4-1)
  const [showPersonDialog, setShowPersonDialog] = useState(false);
  const handleOpenPersonDialog = useCallback(() => setShowPersonDialog(true), []);
  const handleClosePersonDialog = useCallback(() => setShowPersonDialog(false), []);

  // Lade Einsatzdaten
  const {
    data: einsatzResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: EINSATZ_QUERY_KEYS.detail(einsatzId),
    queryFn: () => api.einsatz().einsatzControllerFindOneVAlpha({ id: einsatzId }),
  });

  const einsatz = einsatzResponse?.data;

  // Lade EinsatzFahrzeuge (Story 3-3)
  const { data: fahrzeuge = [], isLoading: isLoadingFahrzeuge } = useEinsatzFahrzeuge(einsatzId);

  // Lade ETB für Count-Anzeige
  const { data: etb, isLoading: isLoadingEtb } = useEtb({ einsatzId });

  // Lade Lagekarte für POI-Count
  const { data: lagekarte, isLoading: isLoadingLagekarte } = useLagekarte(einsatzId);

  // Hook zum Aktualisieren des FMS-Status (Story 3-3)
  const updateFmsStatus = useUpdateFmsStatus(einsatzId);

  // Handler für FMS-Status Änderungen
  const handleStatusChange = useCallback(
    (fahrzeugId: string, newStatus: FmsStatus) => {
      updateFmsStatus.mutate({ fahrzeugId, fmsStatus: newStatus });
    },
    [updateFmsStatus],
  );

  // ETB-Einträge Count aus geladenen Daten
  const etbEintraegeCount = etb?.eintraege?.length;

  // POI-Count aus Lagekarte DTO
  const poisCount = lagekarte?.pois?.length;

  // Setze diesen Einsatz automatisch als aktiv
  useEffect(() => {
    if (einsatz && (!isEinsatzActive || activeEinsatz?.id !== einsatz.id)) {
      setActiveEinsatz(einsatz.id);
    }
  }, [einsatz, isEinsatzActive, activeEinsatz, setActiveEinsatz]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingState message="Lade Einsatzdaten..." />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Fehler beim Laden" description="Der Einsatz konnte nicht geladen werden." />;
  }

  if (!einsatz) {
    return <ErrorState title="Einsatz nicht gefunden" description="Der angeforderte Einsatz existiert nicht." />;
  }

  // Berechne Zeiten und Statistiken
  const startTime = einsatz.alarmierungszeit ? new Date(einsatz.alarmierungszeit) : new Date(einsatz.createdAt);
  const duration = formatDistanceToNow(startTime, { locale: de, addSuffix: false });

  // Mock Timeline Events (würde aus ETB kommen)
  const timelineEvents = [
    {
      id: '1',
      time: startTime,
      title: 'Alarmierung',
      description: einsatz.alarmstichwort || 'Einsatz angelegt',
      type: 'alarm' as const,
    },
    {
      id: '2',
      time: addMinutes(startTime, 5),
      title: 'Ausrückung',
      description: 'Erste Einheiten rücken aus',
      type: 'arrival' as const,
    },
    {
      id: '3',
      time: addMinutes(startTime, 12),
      title: 'Ankunft Einsatzstelle',
      description: einsatz.einsatzort || 'Einsatzort erreicht',
      type: 'info' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Wichtige Statistiken */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <EinsatzStatsCard title="Einsatzdauer" value={duration} icon={<PiClock className="h-8 w-8" />} description={`Seit ${formatNatoDateTime(startTime)}`} />
        <EinsatzStatsCard
          title="Fahrzeuge"
          value={isLoadingFahrzeuge ? '-' : String(fahrzeuge.length)}
          icon={<PiTruck className="h-8 w-8" />}
          description={isLoadingFahrzeuge ? 'Wird geladen...' : `${fahrzeuge.filter((f) => f.fmsStatus >= 3 && f.fmsStatus <= 4).length} im Einsatz`}
          variant="success"
        />
        <EinsatzStatsCard
          title="ETB-Einträge"
          value={isLoadingEtb ? '-' : String(etbEintraegeCount ?? 0)}
          icon={<PiClipboard className="h-8 w-8" />}
          description={isLoadingEtb ? 'Wird geladen...' : 'Dokumentierte Einträge'}
        />
        <EinsatzStatsCard
          title="POIs"
          value={isLoadingLagekarte ? '-' : String(poisCount ?? 0)}
          icon={<PiMapPin className="h-8 w-8" />}
          description={isLoadingLagekarte ? 'Wird geladen...' : 'Markierungen auf Karte'}
          variant="info"
        />
      </div>

      {/* Schnellzugriffe */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-primary-800 dark:bg-primary-900/20">
        <h2 className="mb-3 font-semibold text-primary-900 text-sm dark:text-primary-100">Schnellzugriffe</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Button intent="secondary" size="sm" className="justify-start">
            <PiClipboard className="mr-2 h-4 w-4" />
            Neuer ETB-Eintrag
          </Button>
          <Button intent="secondary" size="sm" className="justify-start">
            <PiRadio className="mr-2 h-4 w-4" />
            Funkmeldung
          </Button>
          <Button intent="secondary" size="sm" className="justify-start" onClick={handleOpenPersonDialog}>
            <PiUsers className="mr-2 h-4 w-4" />
            Person hinzufügen
          </Button>
          <Button intent="secondary" size="sm" className="justify-start">
            <PiFileText className="mr-2 h-4 w-4" />
            Bericht erstellen
          </Button>
        </div>
      </div>

      {/* Hauptinhalt Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Linke Spalte - Timeline und Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Einsatzverlauf */}
          <EinsatzTimelineWidget events={timelineEvents} />

          {/* Einsatzdetails */}
          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
            <h3 className="mb-4 font-semibold text-gray-900 text-lg dark:text-gray-100">Einsatzdetails</h3>
            <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <dt className="font-medium text-gray-500 text-sm dark:text-gray-400">Bezeichnung</dt>
                <dd className="mt-1 text-gray-900 text-sm dark:text-gray-100">{einsatz.name}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 text-sm dark:text-gray-400">Alarmstichwort</dt>
                <dd className="mt-1 text-gray-900 text-sm dark:text-gray-100">{einsatz.alarmstichwort || '-'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 text-sm dark:text-gray-400">Einsatzort</dt>
                <dd className="mt-1 text-gray-900 text-sm dark:text-gray-100">{einsatz.einsatzort || '-'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 text-sm dark:text-gray-400">Alarmierung</dt>
                <dd className="mt-1 text-gray-900 text-sm dark:text-gray-100">{format(startTime, 'dd.MM.yyyy HH:mm', { locale: de })} Uhr</dd>
              </div>
              {einsatz.beschreibung && (
                <div className="md:col-span-2">
                  <dt className="font-medium text-gray-500 text-sm dark:text-gray-400">Beschreibung</dt>
                  <dd className="mt-1 text-gray-900 text-sm dark:text-gray-100">{einsatz.beschreibung}</dd>
                </div>
              )}
            </dl>

            {/* Karte Placeholder */}
            <div className="mt-6 flex h-48 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <PiMapPin className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p className="text-sm">Lagekarte</p>
                <Button appearance="outline" size="sm" className="mt-2">
                  Vollbild öffnen
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Rechte Spalte - Ressourcen und Status */}
        <div className="space-y-6">
          {/* Eingesetzte Fahrzeuge (Story 3-3: FMS-Status Update) */}
          <EinsatzResourceWidget fahrzeuge={fahrzeuge} onStatusChange={handleStatusChange} onAddResource={handleOpenFahrzeugDialog} />

          {/* Wichtige Kontakte */}
          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
            <h3 className="mb-4 font-semibold text-gray-900 text-lg dark:text-gray-100">Wichtige Kontakte</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                <div className="flex items-center gap-3">
                  <PiPhone className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm dark:text-gray-100">Einsatzleitung</p>
                    <p className="text-gray-500 text-xs dark:text-gray-400">Florian 1/10</p>
                  </div>
                </div>
                <Button appearance="ghost" size="sm">
                  <PiRadio className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                <div className="flex items-center gap-3">
                  <PiPhone className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm dark:text-gray-100">Leitstelle</p>
                    <p className="text-gray-500 text-xs dark:text-gray-400">112</p>
                  </div>
                </div>
                <Button appearance="ghost" size="sm">
                  <PiPhone className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Erinnerungen (Story 1.3) */}
          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
            <ErinnerungenList einsatzId={einsatzId} />
          </div>
        </div>
      </div>

      {/* Fahrzeug hinzufügen Dialog (Story 3-1) */}
      <FahrzeugHinzufuegenDialog isOpen={showFahrzeugDialog} onClose={handleCloseFahrzeugDialog} einsatzId={einsatzId} />

      {/* Person hinzufügen Dialog (Story 4-1) */}
      <PersonHinzufuegenDialog isOpen={showPersonDialog} onClose={handleClosePersonDialog} einsatzId={einsatzId} />
    </div>
  );
}
