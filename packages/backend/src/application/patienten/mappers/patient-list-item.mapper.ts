import type { PatientListRow } from '@domain/patienten/repositories/patient.repository';
import { PatientListItemDto } from '../dto/patient-list-item.dto';

/**
 * Re-Export der Port-Read-Row, damit Handler/Tests im Application-Layer keinen
 * direkten Bezug zum Repository-Port-Modul brauchen.
 */
export type { PatientListRow };

/**
 * Mapper `PatientListRow` (Persistenz) → `PatientListItemDto` (HTTP)
 * für Story 1.6 (AC1).
 *
 * Pure-Static — kein DI, kein Konstruktor. Wird vom `ListPatientenHandler`
 * pro Row aufgerufen. `name` ist bis zur Pseudonym-Erfassungs-Story
 * konstant `null` (Forward-Compat, siehe DTO-Doku).
 */
export class PatientListItemMapper {
  static fromPersistence(row: PatientListRow): PatientListItemDto {
    const dto = new PatientListItemDto();
    dto.id = row.id;
    dto.patientennummer = row.patientennummer;
    dto.diviVakNummer = row.diviVakNummer;
    dto.name = null;
    dto.aktuelleSk = row.aktuelleSk;
    dto.behandlungsstatus = row.behandlungsstatus;
    dto.transportstatus = row.transportstatus;
    dto.erfasstAm = row.erfasstAm.toISOString();
    dto.eventVersion = row.eventVersion;
    return dto;
  }
}
