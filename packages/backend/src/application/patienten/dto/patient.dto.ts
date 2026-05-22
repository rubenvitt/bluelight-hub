import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BehandlungsstatusEnum, SkEnum, TransportstatusEnum } from '@/generated/prisma/enums';

/**
 * Response-DTO für ein Patient-Aggregate (Story 1.2, Architecture §D-1).
 *
 * Spiegelt den denormalisierten Snapshot (`aktuelleSk`, `behandlungsstatus`,
 * `transportstatus`) plus Erfassungs-Kontext und Sekundär-Identifier. Der
 * Append-only-Event-Stream wird separat unter `GET /patienten/{id}/historie`
 * (Story 1.7) ausgeliefert.
 */
export class PatientErfasserUserRefDto {
  @ApiProperty({ enum: ['user'], example: 'user' })
  type!: 'user';

  @ApiProperty({ example: 'usr_01HXYZ' })
  userId!: string;
}

export class PatientErfasserDeviceRefDto {
  @ApiProperty({ enum: ['device'], example: 'device' })
  type!: 'device';

  @ApiProperty({ example: 'tablet-3a' })
  deviceId!: string;

  @ApiPropertyOptional({ example: 'cs_01HXYZ' })
  captureSessionId?: string;
}

export class PatientDto {
  @ApiProperty({ example: 'pat_01HXYZ' })
  id!: string;

  @ApiProperty({ example: 'ein_01HXYZ' })
  einsatzId!: string;

  @ApiProperty({ example: 'P-001', description: 'Server-vergebene Patientennummer (`P-NNN`)' })
  patientennummer!: string;

  @ApiPropertyOptional({ example: 'DIVI-2026-0042' })
  diviVakNummer?: string;

  @ApiProperty({ enum: SkEnum, example: SkEnum.SK_II })
  aktuelleSk!: SkEnum;

  @ApiProperty({ enum: BehandlungsstatusEnum, example: BehandlungsstatusEnum.UNVERSORGT })
  behandlungsstatus!: BehandlungsstatusEnum;

  @ApiProperty({ enum: TransportstatusEnum, example: TransportstatusEnum.WARTEND })
  transportstatus!: TransportstatusEnum;

  @ApiProperty({ example: '2026-05-19T10:15:00.000Z' })
  erfasstAm!: string;

  @ApiProperty({
    description: 'Erfasser-Referenz (User- oder Device-Bimodalität, Architecture §D-5).',
    oneOf: [{ $ref: '#/components/schemas/PatientErfasserUserRefDto' }, { $ref: '#/components/schemas/PatientErfasserDeviceRefDto' }],
  })
  erfasserRef!: { type: 'user'; userId: string } | { type: 'device'; deviceId: string; captureSessionId?: string };

  @ApiProperty({ example: 1, description: 'Monoton inkrementierter Event-Stream-Stand (Append-only-Vertrag).' })
  eventVersion!: number;

  @ApiPropertyOptional({ example: 12 })
  clockDriftSeconds?: number;

  @ApiPropertyOptional({
    type: String,
    example: 'Verdacht auf Schädel-Hirn-Trauma, Begleitperson: Mutter',
    maxLength: 500,
    nullable: true,
    description: 'Freie Pflege-/Übergabe-Notiz (Story 1.7, AC9). Snapshot-Feld; Edits laufen über `PatientKorrigiert`-Event mit `feld="notiz"`.',
  })
  notiz?: string | null;
}
