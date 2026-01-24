/**
 * Offline Banner Component
 *
 * Zeigt den aktuellen Offline/Sync-Status am oberen Rand der Anwendung.
 *
 * **Story 1.8 AC1:**
 * - Offline Banner zeigt "Offline - X Aktionen werden synchronisiert"
 * - Variants: Offline (gelb/amber), Syncing (blau), Hidden
 * - Position: Top, full-width mit Slide-Animation
 * - Icons: PiCloudSlash (Offline), PiCloudArrowUp (Syncing)
 */

import { cn } from '@/shared/ui/cn';
import { PiCloudArrowUp, PiCloudSlash } from 'react-icons/pi';

/**
 * Banner Variant Types
 */
export type OfflineBannerVariant = 'offline' | 'syncing' | 'hidden';

/**
 * OfflineBanner Props
 */
interface OfflineBannerProps {
  /** Ob aktuell offline */
  isOffline: boolean;
  /** Anzahl ausstehender Sync-Aktionen */
  pendingCount: number;
  /** Ob gerade synchronisiert wird */
  isSyncing?: boolean;
  /** Zeitpunkt seit dem offline */
  offlineSince?: Date | null;
  /** Zusaetzliche CSS-Klassen */
  className?: string;
}

/**
 * Berechnet die aktuelle Variant basierend auf Props
 */
function getVariant(isOffline: boolean, pendingCount: number, isSyncing?: boolean): OfflineBannerVariant {
  if (isSyncing && pendingCount > 0) {
    return 'syncing';
  }
  if (isOffline) {
    return 'offline';
  }
  return 'hidden';
}

/**
 * Formatiert die Anzahl Aktionen grammatikalisch korrekt
 */
function formatPendingCount(count: number): string {
  if (count === 0) {
    return '';
  }
  if (count === 1) {
    return '1 Aktion wird synchronisiert';
  }
  return `${count} Aktionen werden synchronisiert`;
}

/**
 * Offline Banner Component
 *
 * Zeigt Status-Banner am oberen Rand mit Slide-Animation.
 *
 * **AC1:** Offline-Status mit "Offline" Text und Cloud-Slash Icon
 * **Syncing:** Synchronisations-Status mit Spinner und Cloud-Arrow Icon
 *
 * @example
 * ```tsx
 * <OfflineBanner
 *   isOffline={true}
 *   pendingCount={3}
 *   offlineSince={new Date()}
 * />
 * ```
 */
export function OfflineBanner({ isOffline, pendingCount, isSyncing, offlineSince: _offlineSince, className }: OfflineBannerProps) {
  const variant = getVariant(isOffline, pendingCount, isSyncing);

  // Hidden: Render nothing
  if (variant === 'hidden') {
    return null;
  }

  const isOfflineVariant = variant === 'offline';
  const isSyncingVariant = variant === 'syncing';

  // Issue #13: Dynamisches ARIA-Label fuer Screen Reader
  const ariaLabel = isOfflineVariant ? `Offline${pendingCount > 0 ? ` - ${formatPendingCount(pendingCount)}` : ''}` : `Synchronisiere ${pendingCount} ${pendingCount === 1 ? 'Aktion' : 'Aktionen'}`;

  return (
    // biome-ignore lint/a11y/useSemanticElements: role="status" ist korrekt fuer ARIA Live-Region Status-Updates
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={ariaLabel}
      className={cn(
        // Base styles
        'w-full px-4 py-2 transition-all duration-300 ease-in-out',
        // Flex layout
        'flex items-center justify-center gap-2',
        // Typography
        'font-medium text-sm',
        // Variant: Offline (amber/yellow)
        isOfflineVariant && 'border-amber-200 border-b bg-amber-100 text-amber-800',
        // Variant: Syncing (blue)
        isSyncingVariant && 'border-blue-200 border-b bg-blue-100 text-blue-800',
        className,
      )}
    >
      {/* Icon */}
      {isOfflineVariant && <PiCloudSlash className="h-5 w-5 flex-shrink-0" data-testid="offline-icon" aria-hidden="true" />}
      {isSyncingVariant && <PiCloudArrowUp className="h-5 w-5 flex-shrink-0 animate-pulse" data-testid="syncing-icon" aria-hidden="true" />}

      {/* Text */}
      <span>
        {isOfflineVariant && (
          <>
            <span className="font-semibold">Offline</span>
            {pendingCount > 0 && <span className="ml-1">– {formatPendingCount(pendingCount)}</span>}
          </>
        )}
        {isSyncingVariant && (
          <>
            <span className="font-semibold">Synchronisiere...</span>
            {pendingCount > 0 && <span className="ml-1">({pendingCount})</span>}
          </>
        )}
      </span>
    </div>
  );
}
