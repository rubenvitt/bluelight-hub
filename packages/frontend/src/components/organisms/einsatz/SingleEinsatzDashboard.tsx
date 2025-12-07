import { api } from '@/api';
import { ErrorState } from '@/components/atoms/ErrorState';
import { LoadingState } from '@/components/atoms/LoadingState';
import { EinsatzResourceWidget } from '@/components/molecules/einsatz/EinsatzResourceWidget';
import { EinsatzStatsCard } from '@/components/molecules/einsatz/EinsatzStatsCard';
import { EinsatzTimelineWidget } from '@/components/molecules/einsatz/EinsatzTimelineWidget';
import { useActiveEinsatz } from '@/hooks/useActiveEinsatz';
import { QUERY_KEYS } from '@/queryKeys';
import { formatNatoDateTime } from '@/utils/dateFormatter';
import { logger } from '@/utils/logger';
import { Button } from '@atoms/button.atom';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { addMinutes, format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useEffect } from 'react';
import { PiCheckCircle, PiClipboard, PiClock, PiFileText, PiMapPin, PiPhone, PiRadio, PiTruck, PiUsers } from 'react-icons/pi';

/**
 * Dashboard für einen einzelnen aktiven Einsatz
 *
 * Hauptarbeitsansicht mit allen relevanten Informationen und Schnellzugriffen
 */
export function SingleEinsatzDashboard() {
  const { einsatzId } = useParams({ from: '/app/einsatz/$einsatzId' });
  const { activeEinsatz, setActiveEinsatz, isEinsatzActive } = useActiveEinsatz();

  // Lade Einsatzdaten
  const {
    data: einsatzResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: QUERY_KEYS.einsatz.detail(einsatzId),
    queryFn: () => api.einsatz().einsatzControllerFindOneVAlpha({ id: einsatzId }),
  });

  const einsatz = einsatzResponse?.data;

  // TODO: Switch to useActiveEinsaetzeWithCounts when available
  // These fields will be available after backend implementation and API regeneration
  const etbEintraegeCount = einsatz && 'etbEintraegeCount' in einsatz ? (einsatz as { etbEintraegeCount: number }).etbEintraegeCount : undefined;
  const poisCount = einsatz && 'poisCount' in einsatz ? (einsatz as { poisCount: number }).poisCount : undefined;

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

  // Mock Resources (würde aus Einheiten-Daten kommen)
  const mockResources = [
    {
      id: '1',
      name: 'RTW • 40-83-3',
      type: 'fahrzeug' as const,
      status: 'im-einsatz' as const,
      personnel: 9,
      funkrufname: 'RK UE 40-83-3',
    },
    {
      id: '2',
      name: 'KTW • 40-92-1',
      type: 'fahrzeug' as const,
      status: 'anfahrt' as const,
      personnel: 3,
      funkrufname: 'RK UE 40-92-1',
      arrivalTime: formatNatoDateTime(addMinutes(startTime, 10)),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Wichtige Statistiken */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <EinsatzStatsCard title="Einsatzdauer" value={duration} icon={<PiClock className="h-8 w-8" />} description={`Seit ${formatNatoDateTime(startTime)}`} />
        <EinsatzStatsCard title="Einheiten" value="2" icon={<PiTruck className="h-8 w-8" />} description="12 Einsatzkräfte" variant="success" />
        <EinsatzStatsCard
          title="ETB-Einträge"
          value={etbEintraegeCount !== undefined ? String(etbEintraegeCount) : '-'}
          icon={<PiClipboard className="h-8 w-8" />}
          description={etbEintraegeCount !== undefined ? 'Dokumentierte Einträge' : 'Wird geladen...'}
        />
        <EinsatzStatsCard
          title="POIs"
          value={poisCount !== undefined ? String(poisCount) : '-'}
          icon={<PiMapPin className="h-8 w-8" />}
          description={poisCount !== undefined ? 'Markierungen auf Karte' : 'Wird geladen...'}
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
          <Button intent="secondary" size="sm" className="justify-start">
            <PiUsers className="mr-2 h-4 w-4" />
            Einheit hinzufügen
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
          {/* Eingesetzte Kräfte */}
          <EinsatzResourceWidget resources={mockResources} onAddResource={() => logger.log('Add resource')} />

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

          {/* Nächste Schritte */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
            <h3 className="mb-3 font-semibold text-amber-900 text-lg dark:text-amber-100">Nächste Schritte</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <PiCheckCircle className="mt-0.5 h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-gray-700 text-sm line-through dark:text-gray-300">Lage erkunden</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-0.5 h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                <span className="text-gray-700 text-sm dark:text-gray-300">Nachalarmierung prüfen</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-0.5 h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                <span className="text-gray-700 text-sm dark:text-gray-300">Einsatzbericht vorbereiten</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
