import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BehandlungsstatusEnum, SkEnum, TransportstatusEnum } from '@/generated/prisma/enums';

/**
 * Response-DTO für einen einzelnen Listen-Eintrag in
 * `GET /api/v1/einsaetze/:einsatzId/patienten` (Story 1.6, AC1).
 *
 * Schlanke Projektion über den denormalisierten Patient-Snapshot — nur die
 * Spalten, die `PatientenListe.organism` rendert (Patientennummer, SK,
 * Behandlung, Transport, Erfassungszeit). Erfasser-Kontext und Event-Stream
 * bleiben dem Detail-Endpoint (Story 1.7) vorbehalten.
 *
 * `name` ist Forward-Compat: das aktuelle Prisma-Modell hält kein Pseudonym;
 * die UX-Spec fordert die Spalte trotzdem, damit Story 1.6 vertrags-kompatibel
 * mit dem Pseudonym-Erfassungs-Flow (kommende Story) ist. Bis dahin liefert
 * der Mapper konstant `null`.
 */
export class PatientListItemDto {
  @ApiProperty({ example: 'pat_01HXYZ' })
  id!: string;

  @ApiProperty({ example: 'P-001', description: 'Server-vergebene Patientennummer (`P-NNN`).' })
  patientennummer!: string;

  @ApiPropertyOptional({ example: 'DIVI-2026-0042', nullable: true, description: 'Optionaler Sekundär-Identifier (DIVI-VAK-Nummer).' })
  diviVakNummer!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true, description: 'Pseudonym/Name (sofern erfasst). Aktuell konstant `null` bis Pseudonym-Erfassung folgt.' })
  name!: string | null;

  @ApiProperty({ enum: SkEnum, example: SkEnum.SK_II })
  aktuelleSk!: SkEnum;

  @ApiProperty({ enum: BehandlungsstatusEnum, example: BehandlungsstatusEnum.UNVERSORGT })
  behandlungsstatus!: BehandlungsstatusEnum;

  @ApiProperty({ enum: TransportstatusEnum, example: TransportstatusEnum.WARTEND })
  transportstatus!: TransportstatusEnum;

  @ApiProperty({ example: '2026-05-20T14:21:01.234Z', description: 'ISO-8601-UTC-Zeitstempel der initialen Erfassung.' })
  erfasstAm!: string;

  @ApiProperty({ example: 3, description: 'Monoton inkrementierter Event-Stream-Stand (Append-only-Vertrag).' })
  eventVersion!: number;
}
