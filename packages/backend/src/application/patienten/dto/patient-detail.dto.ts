import { ApiProperty } from '@nestjs/swagger';
import { PatientDto } from './patient.dto';
import { PatientEventDto } from './patient-event.dto';

/**
 * Response-DTO für `GET /api/v1/einsaetze/:einsatzId/patienten/:patientId`
 * (Story 1.7, AC1).
 *
 * Komponiert den `PatientDto`-Snapshot (Erfassungs-Kontext + denormalisierte
 * Snapshot-Felder + optional `notiz`) mit dem chronologisch sortierten
 * Event-Stream. Single-Roundtrip — Backend lädt Snapshot und Events parallel
 * (`Promise.all` im Handler) und serialisiert beides als ein Wrapper-DTO.
 */
export class PatientDetailDto extends PatientDto {
  @ApiProperty({
    type: PatientEventDto,
    isArray: true,
    description: 'Chronologisch (asc) sortierte `PatientEvent`-Historie (`PatientErfasst` zuerst, letztes Event zuletzt). Liefert ALLE Events des Patienten — ohne Filter, ohne Pagination.',
  })
  events!: PatientEventDto[];
}
