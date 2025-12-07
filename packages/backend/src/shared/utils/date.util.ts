import { format, isValid, parseISO } from 'date-fns';

/**
 * Convert Date to NATO Date Time Group format
 * Format: DDHHmmmonYY
 * Example: 011200jan24 for January 1, 2024, 12:00 UTC
 */
export function formatNatoDateTime(date: string | Date | null | undefined): string {
  if (!date) return '';

  const d = typeof date === 'string' ? parseISO(date) : date;

  if (!isValid(d)) return '';

  // Format: dd HHmm MMM yy
  return format(d, 'dd HHmm MMM yy').toUpperCase();
}
