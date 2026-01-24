import type { ErinnerungResponseDto } from '@/shared';
import type { TeamSortType } from '../stores';
import { getUrgencyLevel } from './countdown-utils';

/**
 * Priority values for status-based sorting.
 * Lower value means higher priority (appears first).
 */
export const STATUS_PRIORITY: Record<string, number> = {
  AUSGELOEST: 0,
  ESKALIERT: 1,
  GEPLANT: 2,
  ACKNOWLEDGED: 3,
  SNOOZED: 4,
  ERLEDIGT: 5,
};

/**
 * Fallback priority for unknown statuses.
 */
const DEFAULT_PRIORITY = 8;

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
export function getSortPriority(erinnerung: ErinnerungResponseDto): number {
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
  return DEFAULT_PRIORITY;
}

/**
 * Comparator function for sorting reminders based on the selected sort type.
 *
 * @param a First reminder
 * @param b Second reminder
 * @param selectedSort The currently selected sort mode
 * @returns number - negative if a < b, positive if a > b, 0 if equal
 */
export function compareErinnerungen(a: ErinnerungResponseDto, b: ErinnerungResponseDto, selectedSort: TeamSortType): number {
  if (selectedSort === 'erstellt') {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }

  if (selectedSort === 'status') {
    // Status Prioritaet: AUSGELOEST > ESKALIERT > GEPLANT > ACKNOWLEDGED > SNOOZED > ERLEDIGT
    const orderA = STATUS_PRIORITY[a.status] ?? 99;
    const orderB = STATUS_PRIORITY[b.status] ?? 99;

    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.faelligAm).getTime() - new Date(b.faelligAm).getTime();
  }

  // Default: faelligkeit (Story 1.7 AC5 / Story 3.8 AC1)
  const priorityA = getSortPriority(a);
  const priorityB = getSortPriority(b);

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  return new Date(a.faelligAm).getTime() - new Date(b.faelligAm).getTime();
}
