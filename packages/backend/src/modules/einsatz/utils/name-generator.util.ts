import { formatNatoDateTime } from '@/shared/utils/date.util';
import type { Einsatz } from '@prisma/client';
import { format } from 'date-fns';

/**
 * Generiert einen deterministischen Namen für einen Einsatz
 * basierend auf den verfügbaren Feldern
 */
export class EinsatzNameGenerator {
  static generate(einsatz: Partial<Einsatz>): string {
    const components: string[] = [];

    // Priorität 1: Alarmstichwort
    if (einsatz.alarmstichwort) {
      components.push(einsatz.alarmstichwort);
    }

    // Priorität 2: Alarmierungszeit
    if (einsatz.alarmierungszeit) {
      const date = new Date(einsatz.alarmierungszeit);
      const dateStr = formatNatoDateTime(date);
      components.push(dateStr);
    } else if (einsatz.createdAt) {
      // Fallback: Erstellungszeit
      const date = new Date(einsatz.createdAt);
      const dateStr = formatNatoDateTime(date);
      components.push(dateStr);
    } else {
      // Letzter Fallback: Aktuelle Zeit
      const dateStr = formatNatoDateTime(new Date());
      components.push(dateStr);
    }

    return components.join(' - ');
  }

  static getNameComponents(einsatz: Partial<Einsatz>) {
    const date = einsatz.alarmierungszeit || einsatz.createdAt || new Date();
    const dateObj = new Date(date);

    return {
      alarmstichwort: einsatz.alarmstichwort || undefined,
      zeit: EinsatzNameGenerator.formatTime(dateObj),
      datum: EinsatzNameGenerator.formatDate(dateObj),
    };
  }
  private static formatDate(date: Date): string {
    return format(date, 'dd.MM.yyyy');
  }

  private static formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${hours}:${minutes}`;
  }
}
