import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EintragDto } from './eintrag.dto';
import { EtbVersionDto } from './etb-version.dto';

/**
 * ETB (Einsatztagebuch) Response DTO für Query Operations.
 *
 * Repräsentiert ein vollständiges Einsatztagebuch mit allen Einträgen
 * und Versionierungsinformationen für die API-Rückgabe.
 *
 * **Warum separates DTO statt direkt Aggregate:**
 * - Versionierung: API-Struktur kann unabhängig von Domain evolvieren
 * - Projektion: Nur API-relevante Felder (z.B. keine Domain Events)
 * - Performance: Optimierte Serialisierung ohne Domain-Overhead
 * - Security: Verhindert Leakage von internen Domain-Details
 *
 * **Status-Lifecycle:**
 * - DRAFT: Initiale Erstellung, noch nicht aktiv
 * - ACTIVE: Normaler Betrieb, Einträge können hinzugefügt werden
 * - LOCKED: Archiviert, keine Änderungen mehr möglich
 *
 * **Locking-Konzept:**
 * - Lock ist permanent (kein Unlock vorgesehen)
 * - lockedAt/lockedBy dokumentieren wer wann gesperrt hat
 * - Nach Lock nur noch Lese-Operationen möglich
 */
export class EtbDto {
  @ApiProperty({
    description: 'Eindeutige ETB-ID (CUID)',
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  id!: string;

  @ApiProperty({
    description: 'Referenz zum übergeordneten Einsatz',
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  einsatzId!: string;

  @ApiProperty({
    description: 'Aktueller Status des ETB im Lifecycle',
    example: 'ACTIVE',
    enum: ['DRAFT', 'ACTIVE', 'LOCKED'],
  })
  status!: 'DRAFT' | 'ACTIVE' | 'LOCKED';

  @ApiProperty({
    description: 'Liste aller Einträge im ETB (sortiert nach sequenceNumber)',
    type: () => [EintragDto],
  })
  eintraege!: EintragDto[];

  @ApiProperty({
    description: 'Aktuelle Versionsinformation für Optimistic Locking',
    type: EtbVersionDto,
  })
  version!: EtbVersionDto;

  @ApiProperty({
    description: 'Erstellungszeitpunkt des ETB',
    example: '2024-01-15T12:00:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Zeitpunkt der Sperrung (nur bei Status LOCKED)',
    example: '2024-01-15T18:00:00.000Z',
    type: 'string',
    format: 'date-time',
    nullable: true,
  })
  lockedAt?: Date;

  @ApiPropertyOptional({
    description: 'User-ID der sperrenden Person (nur bei Status LOCKED)',
    example: 'clw3h8x9y0000qwertyuiopas',
    nullable: true,
  })
  lockedBy?: string;
}
