import { ApiProperty } from '@nestjs/swagger';

/**
 * Sichtungskategorien-Bucket-Counts (Story 1.5, AC1).
 *
 * Alle fünf Buckets sind Pflicht und garantiert mit `0` initialisiert, falls
 * im Einsatz keine Patienten in der jeweiligen Kategorie existieren. Damit
 * kann das Frontend den `KpiStrip` ohne Defensiv-Checks rendern.
 */
export class SkCountsDto {
  @ApiProperty({ example: 12, description: 'Patienten mit Sichtungskategorie SK I (Akut, Rot).' })
  SK_I!: number;

  @ApiProperty({ example: 48, description: 'Patienten mit Sichtungskategorie SK II (Dringlich, Gelb).' })
  SK_II!: number;

  @ApiProperty({ example: 130, description: 'Patienten mit Sichtungskategorie SK III (Nicht dringlich, Grün).' })
  SK_III!: number;

  @ApiProperty({ example: 55, description: 'Patienten mit Sichtungskategorie SK IV (Abwartend, Blau).' })
  SK_IV!: number;

  @ApiProperty({ example: 5, description: 'Verstorbene Patienten (separate Kategorie nach SiKoKo/DIN 13050, Schwarz).' })
  TOT!: number;
}

/**
 * Behandlungs-Bucket-Counts (Story 1.5, AC1).
 */
export class BehandlungCountsDto {
  @ApiProperty({ example: 60, description: 'Patienten mit Behandlungsstatus UNVERSORGT.' })
  UNVERSORGT!: number;

  @ApiProperty({ example: 80, description: 'Patienten mit Behandlungsstatus IN_BEHANDLUNG.' })
  IN_BEHANDLUNG!: number;

  @ApiProperty({ example: 70, description: 'Patienten mit Behandlungsstatus VERSORGT.' })
  VERSORGT!: number;

  @ApiProperty({ example: 40, description: 'Patienten mit Behandlungsstatus TRANSPORTBEREIT.' })
  TRANSPORTBEREIT!: number;
}

/**
 * Transport-Bucket-Counts (Story 1.5, AC1).
 */
export class TransportCountsDto {
  @ApiProperty({ example: 200, description: 'Patienten mit Transportstatus WARTEND.' })
  WARTEND!: number;

  @ApiProperty({ example: 30, description: 'Patienten mit Transportstatus IM_TRANSPORT.' })
  IM_TRANSPORT!: number;

  @ApiProperty({ example: 20, description: 'Patienten mit Transportstatus IM_KRANKENHAUS.' })
  IM_KRANKENHAUS!: number;
}

/**
 * Response-DTO für `GET /api/v1/einsaetze/:einsatzId/patienten/kpis`
 * (Story 1.5, AC1/AC2, Architecture §D-7).
 *
 * Aggregat über drei `prisma.patient.groupBy()`-Calls (Promise.all) auf dem
 * denormalisierten Patient-Snapshot — kein Event-Replay, keine Materialized
 * View für MVP. Alle Buckets sind Pflicht und auf `0` initialisiert.
 */
export class KpiAggregatDto {
  @ApiProperty({ type: SkCountsDto, description: 'Aggregat über die fünf Sichtungskategorien.' })
  sk!: SkCountsDto;

  @ApiProperty({ type: BehandlungCountsDto, description: 'Aggregat über die vier Behandlungs-Status.' })
  behandlung!: BehandlungCountsDto;

  @ApiProperty({ type: TransportCountsDto, description: 'Aggregat über die drei Transport-Status.' })
  transport!: TransportCountsDto;

  @ApiProperty({ example: 250, description: 'Gesamtzahl der Patienten im Einsatz.' })
  totalPatienten!: number;

  @ApiProperty({
    example: '2026-05-20T14:23:01.234Z',
    description: 'ISO-8601-UTC-Zeitstempel des Aggregat-Snapshots (gesetzt vor dem ersten groupBy-Call).',
  })
  stand!: string;
}
