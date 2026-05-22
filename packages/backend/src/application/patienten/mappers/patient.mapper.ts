import { Injectable } from '@nestjs/common';
import type { Patient } from '@domain/patienten/aggregates/patient.aggregate';
import { PatientDto } from '../dto/patient.dto';

/**
 * Mapper Patient (Domain-Aggregate) → `PatientDto` (Application-DTO).
 *
 * Pure Function — keine DI-Abhängigkeiten —, NestJS-`@Injectable` nur damit der
 * Mapper im Application-Module als Provider eingehängt werden kann (Pattern
 * `NotizResponseFactory`).
 */
@Injectable()
export class PatientMapper {
  toDto(patient: Patient): PatientDto {
    const erfasserData = patient.erfasserRef.data;
    const dto = new PatientDto();
    dto.id = patient.id.value;
    dto.einsatzId = patient.einsatzId;
    dto.patientennummer = patient.patientennummer.value;
    dto.diviVakNummer = patient.diviVakNummer?.value ?? undefined;
    dto.aktuelleSk = patient.aktuelleSk.code;
    dto.behandlungsstatus = patient.behandlungsstatus.code;
    dto.transportstatus = patient.transportstatus.code;
    dto.erfasstAm = patient.erfasstAm.toISOString();
    dto.erfasserRef = erfasserData;
    dto.eventVersion = patient.eventVersion;
    dto.clockDriftSeconds = patient.clockDriftSeconds ?? undefined;
    dto.notiz = patient.notiz;
    return dto;
  }
}
