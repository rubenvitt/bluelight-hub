import { EinsatzCompletenessBar } from '@/components/molecules/einsatz/einsatz-completeness-bar.molecule';
import { EinsatzStatus, EinsatzStatusBadge } from '@/components/molecules/einsatz/einsatz-status-badge.molecule';
import { useActiveEinsatz } from '@/hooks/useActiveEinsatz';
import { formatNatoDateTime } from '@/utils/dateFormatter';
import type { EinsatzListItemDto, EinsatzResponseDto } from '@bluelight-hub/shared/client';
import { PiBookOpen, PiMapPin } from 'react-icons/pi';

interface EinsatzListItemProps {
  einsatz: EinsatzResponseDto | EinsatzListItemDto;
}

export const EinsatzListItem = ({ einsatz }: EinsatzListItemProps) => {
  const { activeEinsatz } = useActiveEinsatz();
  const isCurrentlyActive = activeEinsatz?.id === einsatz.id;

  // Extract counts if available (present in EinsatzListItemDto)
  const etbEintraegeCount = 'etbEintraegeCount' in einsatz ? einsatz.etbEintraegeCount : undefined;
  const poisCount = 'poisCount' in einsatz ? einsatz.poisCount : undefined;

  return (
    <div className="cursor-pointer px-3 py-3 transition-all hover:bg-gray-50 sm:px-4 sm:py-4 dark:hover:bg-gray-700/50">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-2 sm:mb-2 sm:items-center">
            <h3 className="line-clamp-2 font-medium text-base text-gray-900 sm:line-clamp-1 sm:text-lg dark:text-white">{einsatz.alarmstichwort || 'Kein Alarmstichwort'}</h3>
            <div className="flex items-center gap-2">
              {isCurrentlyActive && (
                <span className="inline-flex items-center gap-1 font-medium text-green-600 text-xs dark:text-green-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                  </span>
                  AKTIV
                </span>
              )}
              <EinsatzStatusBadge status={einsatz.status || EinsatzStatus.ANGELEGT} size="sm" className="flex-shrink-0" />
            </div>
          </div>
          <div className="flex flex-col gap-1 text-gray-500 text-xs sm:flex-row sm:items-center sm:gap-2 sm:space-x-2 sm:text-sm dark:text-gray-400">
            <span className="font-mono">{formatNatoDateTime(einsatz.createdAt)}</span>

            {/* ETB & POI Counts */}
            {(etbEintraegeCount !== undefined || poisCount !== undefined) && (
              <div className="flex items-center gap-2">
                {etbEintraegeCount !== undefined && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 text-xs dark:bg-blue-900/30 dark:text-blue-400">
                    <PiBookOpen className="h-3 w-3" />
                    {etbEintraegeCount}
                  </span>
                )}
                {poisCount !== undefined && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-800 text-xs dark:bg-purple-900/30 dark:text-purple-400">
                    <PiMapPin className="h-3 w-3" />
                    {poisCount}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="mt-2">
            <EinsatzCompletenessBar einsatz={einsatz} showTooltip={false} showPercentage={true} size="sm" className="max-w-full sm:max-w-xs" />
          </div>
        </div>
      </div>
    </div>
  );
};
