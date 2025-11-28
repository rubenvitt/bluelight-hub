import { EinsatzCompletenessBar } from '@/components/molecules/einsatz/einsatz-completeness-bar.molecule';
import { EinsatzStatusBadge } from '@/components/molecules/einsatz/einsatz-status-badge.molecule';
import { formatNatoDateTime } from '@/utils/dateFormatter';
import { Textarea } from '@atoms/textarea.atom';
import type { EinsatzResponseDto } from '@bluelight-hub/shared/client';
import { EinsatzResponseDtoStatusEnum } from '@bluelight-hub/shared/client';
import type { ReactFormApi } from '@tanstack/react-form';
import { PiArchive, PiBookOpen, PiCheckCircle, PiClock, PiMapPin as PiMapPinIcon } from 'react-icons/pi';

interface EinsatzInfoCardProps {
  einsatz: EinsatzResponseDto;
  isArchived: boolean;
  isEditing: boolean;
  form: ReactFormApi<{ beschreibung: string }, undefined>;
}

export function EinsatzInfoCard({ einsatz, isArchived, isEditing, form }: EinsatzInfoCardProps) {
  // TODO: Switch to useActiveEinsaetzeWithCounts when available
  // These fields will be available after backend implementation and API regeneration
  const etbEintraegeCount = (einsatz as any).etbEintraegeCount;
  const poisCount = (einsatz as any).poisCount;

  return (
    <div className="mb-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-2">
          {isArchived && <PiArchive className="h-6 w-6 text-amber-500" />}
          <h1 className="font-bold text-2xl text-gray-900 dark:text-white">{einsatz.alarmstichwort || 'Kein Alarmstichwort'}</h1>
        </div>
        <div className="mt-2 flex items-center space-x-4 sm:mt-0">
          <EinsatzStatusBadge status={einsatz.status || EinsatzResponseDtoStatusEnum.Angelegt} size="lg" />
          <span className="text-gray-500 text-sm dark:text-gray-400">ID: {einsatz.id}</span>
        </div>
      </div>

      {/* Einsatz Meta Info */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-start space-x-2">
          <PiClock className="mt-1 h-5 w-5 text-gray-400" />
          <div>
            <p className="font-medium text-gray-700 text-sm dark:text-gray-300">Erstellt am</p>
            <p className="text-gray-900 text-sm dark:text-white">{formatNatoDateTime(einsatz.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-start space-x-2">
          <PiMapPinIcon className="mt-1 h-5 w-5 text-gray-400" />
          <div className="flex-1">
            <p className="font-medium text-gray-700 text-sm dark:text-gray-300">Einsatzort</p>
            <p className="text-gray-900 text-sm dark:text-white">{einsatz.einsatzort || 'Nicht angegeben'}</p>
          </div>
        </div>
        <div className="flex items-start space-x-2">
          <PiCheckCircle className="mt-1 h-5 w-5 text-gray-400" />
          <div className="flex-1">
            <p className="font-medium text-gray-700 text-sm dark:text-gray-300">Status</p>
            <p className="text-gray-900 text-sm dark:text-white">{einsatz.status}</p>
          </div>
        </div>
      </div>

      {/* ETB & POI Counts */}
      {(etbEintraegeCount !== undefined || poisCount !== undefined) && (
        <div className="mt-4 flex gap-3">
          {etbEintraegeCount !== undefined && (
            <div className="flex items-center space-x-2 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
              <PiBookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-medium text-blue-900 text-xs dark:text-blue-100">ETB-Einträge</p>
                <p className="font-semibold text-blue-900 text-lg dark:text-blue-100">{etbEintraegeCount}</p>
              </div>
            </div>
          )}
          {poisCount !== undefined && (
            <div className="flex items-center space-x-2 rounded-lg bg-purple-50 px-3 py-2 dark:bg-purple-900/20">
              <PiMapPinIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="font-medium text-purple-900 text-xs dark:text-purple-100">POIs auf Karte</p>
                <p className="font-semibold text-purple-900 text-lg dark:text-purple-100">{poisCount}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vollständigkeitsanzeige */}
      <div className="mt-6">
        <p className="mb-2 font-medium text-gray-700 text-sm dark:text-gray-300">Vollständigkeit</p>
        <EinsatzCompletenessBar einsatz={einsatz} showTooltip={true} showPercentage={true} size="lg" className="max-w-full" />
      </div>

      {/* Beschreibung */}
      <div className="mt-6">
        <p className="mb-2 font-medium text-gray-700 text-sm dark:text-gray-300">Beschreibung</p>
        {isEditing ? (
          <form.Field name="beschreibung">
            {(field) => (
              <>
                <Textarea
                  value={field.state.value || ''}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Beschreibung eingeben..."
                  rows={4}
                  className="w-full"
                />
                {field.state.meta.errors?.length > 0 && <p className="mt-1 text-red-600 text-sm dark:text-red-400">{field.state.meta.errors.join(', ')}</p>}
              </>
            )}
          </form.Field>
        ) : (
          <p className="whitespace-pre-wrap text-gray-900 text-sm dark:text-white">{einsatz.beschreibung || 'Keine Beschreibung vorhanden'}</p>
        )}
      </div>
    </div>
  );
}
