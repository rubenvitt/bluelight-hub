import { cn } from '@/utils/cn';
import type { AddEintragDtoKategorieEnum as EtbKategorie } from '@bluelight-hub/shared/client';
import { EtbVersionBadge } from './EtbVersionBadge';
import { EtbKategorieBadge } from './EtbKategorieBadge';
import { formatDisplayDateTime } from '@/utils/dateFormatter';

interface EtbHistoryCardProps {
  version: number;
  timestamp: Date;
  text: string;
  kategorie: EtbKategorie;
  isCurrent?: boolean;
  username?: string | null;
  changeReason?: string | null;
  className?: string;
}

/**
 * Card zur Anzeige eines ETB-Eintrags in der Versionshistorie
 *
 * @param version - Versionsnummer
 * @param timestamp - Zeitstempel der Änderung
 * @param text - Eintragtext
 * @param kategorie - Kategorie des Eintrags
 * @param isCurrent - Ob es die aktuelle Version ist
 * @param username - Benutzername des Bearbeiters
 * @param changeReason - Grund für die Änderung
 * @param className - Zusätzliche CSS-Klassen
 */
export function EtbHistoryCard({ version, timestamp, text, kategorie, isCurrent = false, username, changeReason, className }: EtbHistoryCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg p-4',
        isCurrent ? 'border-2 border-primary-500 bg-primary-50/50 dark:border-primary-600 dark:bg-primary-900/20' : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/50',
        className,
      )}
    >
      {/* Header mit Version und Timestamp */}
      <div className="mb-2 flex items-center gap-2">
        <EtbVersionBadge version={version} isCurrent={isCurrent} variant="solid" />
        <span className="text-gray-500 text-sm dark:text-gray-400">{formatDisplayDateTime(timestamp)}</span>
      </div>

      {/* Username */}
      {username && <p className="mb-2 text-gray-600 text-sm dark:text-gray-400">Bearbeitet von: {username}</p>}

      {/* Change Reason */}
      {changeReason && <p className="mb-2 text-gray-500 text-sm italic dark:text-gray-400">Grund: {changeReason}</p>}

      {/* Kategorie Badge */}
      <div className="mb-2">
        <EtbKategorieBadge kategorie={kategorie} />
      </div>

      {/* Text Content */}
      <p className={cn('text-sm', isCurrent ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300')}>{text}</p>
    </div>
  );
}
