import { Injectable } from '@nestjs/common';
import type { Patient } from '@domain/patienten/aggregates/patient.aggregate';
import type { PatientEventRow } from '@domain/patienten/repositories/patient.repository';
import { PatientDetailDto } from '../dto/patient-detail.dto';
import { PatientEventDto, type PatientEventType } from '../dto/patient-event.dto';
import { PatientMapper } from './patient.mapper';

/**
 * Mapper für `PatientDetailDto` (Story 1.7, AC1/AC2).
 *
 * Komponiert den `PatientDto`-Snapshot via existierendem `PatientMapper` und
 * hängt die chronologisch sortierte Event-Liste an. Unbekannte `eventType`-
 * Werte aus der DB werden durchgereicht und erst im Frontend-Switch als
 * „Unbekanntes Ereignis" gerendert (defensiv, kein Crash).
 *
 * `payload` wird 1:1 als `Record<string, unknown>` durchgereicht — die
 * discriminated-union-Validierung passiert im Frontend per Zod oder im
 * Outbox-Deserializer (siehe `event-deserializer.ts`).
 */
@Injectable()
export class PatientDetailMapper {
  constructor(private readonly patientMapper: PatientMapper) {}

  toDto(patient: Patient, events: PatientEventRow[]): PatientDetailDto {
    const baseDto = this.patientMapper.toDto(patient);
    const dto = new PatientDetailDto();
    dto.id = baseDto.id;
    dto.einsatzId = baseDto.einsatzId;
    dto.patientennummer = baseDto.patientennummer;
    dto.diviVakNummer = baseDto.diviVakNummer;
    dto.aktuelleSk = baseDto.aktuelleSk;
    dto.behandlungsstatus = baseDto.behandlungsstatus;
    dto.transportstatus = baseDto.transportstatus;
    dto.erfasstAm = baseDto.erfasstAm;
    dto.erfasserRef = baseDto.erfasserRef;
    dto.eventVersion = baseDto.eventVersion;
    dto.clockDriftSeconds = baseDto.clockDriftSeconds;
    dto.notiz = baseDto.notiz;
    dto.events = events.map((row) => this.toEventDto(row));
    return dto;
  }

  private toEventDto(row: PatientEventRow): PatientEventDto {
    const dto = new PatientEventDto();
    dto.id = row.id;
    dto.eventVersion = row.eventVersion;
    // Defensive: unbekannte eventType-Strings fließen 1:1 in den Wire-Body —
    // OpenAPI-Enum-Annotation ist Vertrag, kein Cast. Das Frontend rendert
    // sie als „Unbekanntes Ereignis ({eventType})" (AC8 Fallback).
    dto.eventType = row.eventType as PatientEventType;
    dto.occurredAt = row.occurredAt.toISOString();
    dto.recordedAt = row.recordedAt.toISOString();
    dto.actorUserId = row.actorUserId;
    dto.actorDeviceId = row.actorDeviceId;
    dto.originSessionId = row.originSessionId;
    dto.clockDriftSeconds = row.clockDriftSeconds;
    dto.payload = row.payload;
    return dto;
  }
}
