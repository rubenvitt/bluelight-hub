/**
 * Zeit-Berechnungs-Helper für Erinnerungen
 *
 * **Story 1.2 AC3:**
 * - Berechnet faelligAm basierend auf absoluter Uhrzeit
 * - Falls die Zeit heute bereits vorbei ist, wird morgen verwendet
 */

import type { CustomTime } from '../schemas/erinnerung.schema';

/**
 * Berechnet faelligAm basierend auf absoluter Uhrzeit.
 *
 * **Story 1.2 AC3:**
 * - Wenn 14:45 eingestellt, wird Fälligkeit auf 14:45 des aktuellen Tages gesetzt
 * - Wenn 14:45 bereits vorbei ist, wird es auf morgen 14:45 gesetzt
 *
 * @param hours - Stunde (0-23)
 * @param minutes - Minute (0-59)
 * @returns Date-Objekt mit der berechneten Fälligkeit
 */
export function calculateCustomFaelligAm(hours: number, minutes: number): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  // Wenn Zeit bereits vorbei (oder genau jetzt), morgen nehmen
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target;
}

/**
 * Gibt die Standard-Uhrzeit für den Custom-Modus zurück.
 *
 * **Story 1.2 AC2:**
 * - Time-Picker ist auf die aktuelle Uhrzeit + 30 Min voreingestellt
 * - Gerundet auf 5 Minuten
 *
 * @returns CustomTime mit hours und minutes
 */
export function getDefaultCustomTime(): CustomTime {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);

  // Auf 5 Minuten runden (aufrunden)
  const roundedMinutes = Math.ceil(now.getMinutes() / 5) * 5;

  // Stunde anpassen wenn Minuten >= 60
  let hours = now.getHours();
  let minutes = roundedMinutes;

  if (minutes >= 60) {
    minutes = minutes - 60;
    hours = (hours + 1) % 24;
  }

  return { hours, minutes };
}

/**
 * Formatiert ein Datum für die Toast-Nachricht.
 *
 * **Story 1.2 AC3:**
 * - "Erinnerung für 14:45 Uhr" (heute)
 * - "Erinnerung für morgen 14:45 Uhr" (nächster Tag)
 *
 * @param date - Das zu formatierende Datum
 * @returns Formatierter String für Toast
 */
export function formatTimeForToast(date: Date): string {
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const timeString = `${hours}:${minutes} Uhr`;

  return isToday ? timeString : `morgen ${timeString}`;
}
