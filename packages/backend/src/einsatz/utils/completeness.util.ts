import type { Einsatz } from '@prisma/client';
import type { EinsatzCompleteness, MissingField } from '@/application/einsatz/dto/einsatz-response.dto';

/**
 * Berechnet die Vollständigkeit eines Einsatzes
 */

export class EinsatzCompletenessCalculator {
  private static readonly FIELD_WEIGHTS = {
    alarmstichwort: { weight: 30, priority: 'critical' as const },
    alarmierungszeit: { weight: 25, priority: 'critical' as const },
    // Weitere Felder können später hinzugefügt werden
  };

  static calculate(einsatz: Partial<Einsatz>): EinsatzCompleteness {
    const missingFields: MissingField[] = [];
    let totalWeight = 0;
    let achievedWeight = 0;

    // Prüfe Alarmstichwort
    const alarmstichwortConfig = EinsatzCompletenessCalculator.FIELD_WEIGHTS.alarmstichwort;
    totalWeight += alarmstichwortConfig.weight;
    if (!einsatz.alarmstichwort || einsatz.alarmstichwort.trim() === '') {
      missingFields.push({
        field: 'alarmstichwort',
        fieldPath: 'alarmstichwort',
        priority: alarmstichwortConfig.priority,
        message: 'Das Alarmstichwort fehlt',
        suggestedAction: 'Bitte geben Sie ein Alarmstichwort an (z.B. "Brand 3", "TH1")',
      });
    } else {
      achievedWeight += alarmstichwortConfig.weight;
    }

    // Prüfe Alarmierungszeit
    const alarmierungszeitConfig = EinsatzCompletenessCalculator.FIELD_WEIGHTS.alarmierungszeit;
    totalWeight += alarmierungszeitConfig.weight;
    if (!(einsatz.alarmierungszeit instanceof Date) || Number.isNaN(einsatz.alarmierungszeit.getTime())) {
      missingFields.push({
        field: 'alarmierungszeit',
        fieldPath: 'alarmierungszeit',
        priority: alarmierungszeitConfig.priority,
        message: 'Die Alarmierungszeit fehlt',
        suggestedAction: 'Bitte geben Sie den Zeitpunkt der Alarmierung an',
      });
    } else {
      achievedWeight += alarmierungszeitConfig.weight;
    }

    // Berechne Score
    const score = totalWeight > 0 ? Math.round((achievedWeight / totalWeight) * 100) : 100;
    const isComplete = score === 100;

    return {
      score,
      isComplete,
      missingFields,
    };
  }
}
