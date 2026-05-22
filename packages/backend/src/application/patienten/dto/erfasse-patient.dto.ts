import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SK_CODES, type SkCode } from '@domain/patienten/value-objects/sichtungskategorie.vo';

/**
 * Request-DTO für `POST /api/v1/einsaetze/{einsatzId}/patienten` (Story 1.2).
 *
 * `initialeSk` ist Pflichtfeld; die Aggregat-Factory `Patient.create()` würde
 * sonst auf `SK_III` defaulten — Story 1.2 fordert aber explizite Klassifikation
 * am Behandlungsplatz (siehe AC1 / Architecture §D-1).
 *
 * `diviVakNummer` und `notiz` sind optional; die `notiz` wird zusätzlich in
 * den ETB-`text`-Slot gespiegelt (siehe `ErfassePatientHandler`).
 */
export class ErfassePatientDto {
  @ApiProperty({
    enum: SK_CODES,
    description: 'Initiale Sichtungskategorie nach SiKoKo/DIN 13050. `TOT` ist eine eigene Kategorie (keine SK-V).',
    example: 'SK_II',
  })
  @IsEnum(SK_CODES, { message: 'initialeSk muss einer der Werte SK_I, SK_II, SK_III, SK_IV oder TOT sein' })
  initialeSk!: SkCode;

  @ApiPropertyOptional({
    description: 'Optionaler Sekundär-Identifier (DIVI-VAK-Nummer, max. 64 Zeichen).',
    maxLength: 64,
    example: 'DIVI-2026-0042',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  diviVakNummer?: string;

  @ApiPropertyOptional({
    description: 'Optionale Erfassungs-Notiz (max. 500 Zeichen); wird im ETB-Eintrag gespiegelt.',
    maxLength: 500,
    example: 'Verdacht Polytrauma, bewusstlos',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  notiz?: string;

  @ApiPropertyOptional({
    description: 'Optionale Geräte-Clock-Drift in Sekunden gegenüber Server-UTC (für Standalone-Capture-Audit).',
    example: 12,
  })
  @IsOptional()
  @IsInt()
  clockDriftSeconds?: number;
}
