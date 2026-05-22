import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Query-Parameter-DTO für `GET /api/v1/einsaetze/:einsatzId/patienten` (Story 1.6).
 *
 * Multi-Select-Filter (`sk`, `behandlungsstatus`, `transportstatus`) werden
 * als CSV-Strings vom Frontend übertragen (`?sk=SK_I,SK_II`) und im Controller
 * vor der Übergabe an `ListPatientenQuery.create()` zu String-Arrays
 * normalisiert. Die fachliche Whitelist-Validation passiert in der Factory —
 * dieses DTO macht nur eine konservative Shape-Prüfung (`IsString`, Max-Length).
 *
 * Pagination via `page`/`pageSize` (statt des generischen `FilterPaginationDto`-
 * `limit`-Felds), damit der Wire-Vertrag mit dem Frontend-Hook
 * `usePatientenList` und dem `ApiWrappedPaginatedResponse`-Schema deckungsgleich
 * ist (Story 1.6 AC1/AC5).
 */
export class ListPatientenQueryDto {
  @ApiPropertyOptional({
    description: 'CSV-separierte Sichtungskategorien (SK_I, SK_II, SK_III, SK_IV, TOT).',
    example: 'SK_I,SK_II',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sk?: string;

  @ApiPropertyOptional({
    description: 'CSV-separierte Behandlungs-Status (UNVERSORGT, IN_BEHANDLUNG, VERSORGT, TRANSPORTBEREIT).',
    example: 'TRANSPORTBEREIT',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  behandlungsstatus?: string;

  @ApiPropertyOptional({
    description: 'CSV-separierte Transport-Status (WARTEND, IM_TRANSPORT, IM_KRANKENHAUS).',
    example: 'WARTEND',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  transportstatus?: string;

  @ApiPropertyOptional({
    description: 'Freitext-Suche über Patientennummer und DIVI-VAK-Nummer (deutsche Umlaut-Normalisierung: Mueller ↔ Müller).',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;

  @ApiPropertyOptional({
    description: 'Sortier-Feld. Default `sk` (SK-Priorität asc + `erfasstAm` asc).',
    enum: ['sk', 'zeit', 'patientennummer'],
    default: 'sk',
  })
  @IsOptional()
  @IsIn(['sk', 'zeit', 'patientennummer'])
  sortBy?: 'sk' | 'zeit' | 'patientennummer';

  @ApiPropertyOptional({
    description: 'Sortier-Richtung. Default `asc`.',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Seiten-Nummer, 1-basiert. Default 1, max 10_000 (Deep-Offset-Schutz).',
    default: 1,
    minimum: 1,
    maximum: 10_000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;

  @ApiPropertyOptional({
    description: 'Seiten-Größe. Default 50, max 100.',
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/**
 * Hilfsfunktion: Wandelt einen CSV-String aus den Query-Params in ein Array
 * von Werten um. Leere Strings werden zu `undefined` normalisiert, damit die
 * Factory den "kein Filter"-Zweig erreicht.
 *
 * `uppercase` normalisiert jeden Token auf Upper-Case (Story 1.6 Code-Review
 * P11): Deep-Link `?sk=sk_i` wird zu `SK_I` und passt die Enum-Whitelist;
 * ohne diese Normalisierung würde der Whitelist-Check mit `Validation:*`
 * fehlschlagen, obwohl der User die Casing-Konvention nur leicht verletzt
 * hat. Für `search` (Freitext) muss der Aufruf `uppercase: false` lassen.
 */
export function parseCsv(value: string | undefined, options: { uppercase?: boolean } = {}): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const items = value
    .split(',')
    .map((s) => (options.uppercase ? s.trim().toUpperCase() : s.trim()))
    .filter((s) => s.length > 0);
  return items.length > 0 ? items : undefined;
}
