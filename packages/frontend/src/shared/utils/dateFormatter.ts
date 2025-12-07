import { format, isValid, parseISO } from 'date-fns';

/**
 * NATO DateTime Format mit lokaler Zeitzone
 * Format: DDHHmmX MON YY (X = Zeitzone)
 * Example: 031600B DEC 24 (3. Dezember 2024, 16:00 Uhr Bravo/Berlin Zeit)
 */
export function formatNatoDateTime(date: string | Date | null | undefined): string {
  if (!date) return '';

  const d = typeof date === 'string' ? parseISO(date) : date;

  if (!isValid(d)) return '';

  // Format: dd HHmm MMM yy
  return format(d, 'dd HHmm MMM yy').toUpperCase();
}

/**
 * Benutzerfreundliches DateTime Format
 * Format: DD.MM.YYYY HH:mm
 * Example: 03.12.2024 16:00
 */
export function formatDisplayDateTime(date: string | Date | null | undefined): string {
  if (!date) return '';

  const d = typeof date === 'string' ? parseISO(date) : date;

  if (!isValid(d)) return '';

  return format(d, 'dd.MM.yyyy HH:mm');
}
