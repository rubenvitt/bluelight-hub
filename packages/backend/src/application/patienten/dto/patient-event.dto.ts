import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Bekannte `PatientEvent.eventType`-Werte (Story 1.2/1.3/1.4 + Story 1.7
 * Notiz-Korrektur). Wird als OpenAPI-Enum gerendert, damit der generierte
 * Shared-Client die Diskriminator-Werte typsicher gegen einen Literal-Union
 * mappt. Die discriminated-union der `payload`-Shape wird in 1.7 pragmatisch
 * als `Record<string, unknown>` exposed (siehe AC2-Story-Begründung).
 */
export const PATIENT_EVENT_TYPES = [
  'patient.erfasst',
  'patient.gesichtet',
  'patient.sichtung-aktualisiert',
  'patient.behandlung-begonnen',
  'patient.behandlung-abgeschlossen',
  'patient.transport-gestartet',
  'patient.transport-abgeschlossen',
  'patient.korrigiert',
] as const;

export type PatientEventType = (typeof PATIENT_EVENT_TYPES)[number];

/**
 * Response-DTO für eine `PatientEvent`-Zeile in der Detail-Historie (Story 1.7, AC1/AC2).
 *
 * Spiegelt die canonical-Spalten aus `prisma.PatientEvent` (außer `outboxRef`
 * — interner Outbox-Marker, kein Client-Konsum) und liefert `payload` als
 * `Record<string, unknown>`. Die Frontend-Diskriminierung läuft via switch
 * auf `eventType` plus eigener TypeScript-Type-Definition.
 */
export class PatientEventDto {
  @ApiProperty({ example: 'evt_01HXYZ' })
  id!: string;

  @ApiProperty({ example: 3, description: 'Monoton pro `patientId`. Spiegelt die Append-only-Reihenfolge.' })
  eventVersion!: number;

  @ApiProperty({ enum: PATIENT_EVENT_TYPES, example: 'patient.sichtung-aktualisiert' })
  eventType!: PatientEventType;

  @ApiProperty({ example: '2026-05-20T14:21:01.234Z', description: 'ISO-8601-UTC-Zeitpunkt, an dem das Ereignis fachlich eintrat.' })
  occurredAt!: string;

  @ApiProperty({ example: '2026-05-20T14:21:01.500Z', description: 'ISO-8601-UTC-Zeitpunkt der DB-Persistierung (Drift-Indikator zu `occurredAt`).' })
  recordedAt!: string;

  @ApiPropertyOptional({ example: 'usr_42', nullable: true, description: 'User-Akteur (genau eines von `actorUserId`, `actorDeviceId`, `originSessionId` ist gesetzt).' })
  actorUserId!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true, description: 'Geräte-Akteur (Standalone-Capture).' })
  actorDeviceId!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true, description: 'Capture-Session-Ursprung (Standalone).' })
  originSessionId!: string | null;

  @ApiPropertyOptional({ example: 12, nullable: true, description: 'Optionale Geräte-Clock-Drift in Sekunden; > 30 s wird im Frontend als Drift-Indikator angezeigt.' })
  clockDriftSeconds!: number | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { kind: 'patient.sichtung-aktualisiert', patientId: 'pat_01', vorher: 'SK_II', neu: 'SK_III' },
    description:
      'Event-Payload als JSON. Die discriminated-union-Shape spiegelt das Domain-Schema (`PatientEtbContextSchema`); im OpenAPI bleibt sie pragmatisch als generisches Objekt deklariert (Story 1.7, AC2).',
  })
  payload!: Record<string, unknown>;
}
