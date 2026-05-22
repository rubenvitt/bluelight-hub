import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SK_CODES, type SkCode } from '@domain/patienten/value-objects/sichtungskategorie.vo';
import { SICHTUNG_ARTEN, type SichtungArt } from '@domain/patienten/value-objects/sichtung.vo';

/**
 * Request-DTO für `PATCH /api/v1/einsaetze/{einsatzId}/patienten/{patientId}/sichtung` (Story 1.3).
 *
 * Reevaluierung der Sichtungs-Kategorie nach erfasstem Patient (FR17). Der
 * `grund`-Freitext ist optional; Trimming erfolgt im Command-Konstruktor.
 */
export class AktualisiereSichtungDto {
  @ApiProperty({
    enum: SK_CODES,
    description: 'Neue Sichtungskategorie nach SiKoKo/DIN 13050. `TOT` ist eine eigene Kategorie (separat von SK IV).',
    example: 'SK_I',
  })
  @IsEnum(SK_CODES, { message: 'neueSk muss einer der Werte SK_I, SK_II, SK_III, SK_IV oder TOT sein' })
  neueSk!: SkCode;

  @ApiProperty({
    enum: SICHTUNG_ARTEN,
    description: 'Art der Sichtung: `aerztlich` (ärztliche Sichtung, höhere Verbindlichkeit) oder `vorsichtung` (Ersteinschätzung durch Nicht-Arzt).',
    example: 'aerztlich',
  })
  @IsEnum(SICHTUNG_ARTEN, { message: 'sichtungArt muss entweder aerztlich oder vorsichtung sein' })
  sichtungArt!: SichtungArt;

  @ApiPropertyOptional({
    description: 'Optionaler Freitext-Grund (max. 500 Zeichen); wird im ETB-Eintrag gespiegelt und im Audit-Trail persistiert.',
    maxLength: 500,
    example: 'Vitalwerte verschlechtert',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  grund?: string;

  @ApiPropertyOptional({
    description: 'Optionale Geräte-Clock-Drift in Sekunden gegenüber Server-UTC (für Standalone-Capture-Audit).',
    example: 12,
  })
  @IsOptional()
  @IsInt()
  clockDriftSeconds?: number;
}
