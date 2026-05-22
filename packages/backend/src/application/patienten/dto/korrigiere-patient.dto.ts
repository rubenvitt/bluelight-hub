import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PATIENT_KORREKTUR_FELDER, type PatientKorrekturFeld } from '@domain/patienten/events/patient-korrigiert.event';

/**
 * Request-DTO für `PATCH /api/v1/einsaetze/{einsatzId}/patienten/{patientId}/korrektur`
 * (Story 1.4, FR42).
 *
 * **Append-only Korrektur-Pfad:** überschreibt den Snapshot eines der drei
 * Status-Felder ohne Übergangs-Validierung. `grund` ist Pflicht (Audit-Trail).
 *
 * `neuerWert` ist ein generischer String — die VO-Validierung übernimmt das
 * Aggregate (jedes Feld hat sein eigenes Code-Set).
 */
export class KorrigierePatientDto {
  @ApiProperty({
    enum: PATIENT_KORREKTUR_FELDER,
    description: 'Korrigierbares Snapshot-Feld.',
    example: 'behandlungsstatus',
  })
  @IsEnum(PATIENT_KORREKTUR_FELDER, { message: 'feld muss einer der Werte sichtung, behandlungsstatus oder transportstatus sein' })
  feld!: PatientKorrekturFeld;

  @ApiProperty({
    type: String,
    description:
      'Neuer Wert — VO-validiert im Aggregate (z. B. `SK_II` für `feld=sichtung`). Bei `feld="notiz"` (Story 1.7, AC9) ist `null` zulässig (entspricht „Notiz löschen") und der String darf 0..500 Zeichen lang sein (nach Trim).',
    example: 'IN_BEHANDLUNG',
    nullable: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  neuerWert!: string | null;

  @ApiProperty({
    description: 'Pflicht-Begründung für die Korrektur (max. 500 Zeichen, getrimmt).',
    example: 'Falschmeldung Team C — Patient noch in Behandlung',
    maxLength: 500,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  grund!: string;

  @ApiPropertyOptional({
    description: 'Optionale Geräte-Clock-Drift in Sekunden gegenüber Server-UTC.',
    example: 12,
  })
  @IsOptional()
  @IsInt()
  clockDriftSeconds?: number;

  @ApiPropertyOptional({
    description:
      'Story 1.4 Code-Review Feature 2: explizite Bestätigung für die irreversible TOT-Korrektur eines lebenden Patienten (`feld=sichtung && neuerWert=TOT && aktuelleSk !== TOT`). Ohne `true` lehnt das Aggregate die Korrektur mit `BusinessRule:KorrekturTotBenoetigtBestaetigung` ab.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  bestaetigeTotKorrektur?: boolean;
}
