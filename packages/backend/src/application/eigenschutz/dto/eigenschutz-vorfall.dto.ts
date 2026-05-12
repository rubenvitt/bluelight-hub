import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { BeteiligterFreitextDto, BeteiligterEinsatzPersonDto, WoCoordinateDto, WoFreitextDto } from './report-vorfall.dto';

/**
 * Response-DTO für einen Eigenschutz-Vorfall (Story 5.1, AC6).
 *
 * Vollständiger Aggregate-Snapshot inklusive `kontextSnapshot`. Story 5.2
 * erweitert den `kontextSnapshot` für **neue** Vorfälle; bestehende `{}`-
 * Zeilen aus 5.1 bleiben unverändert (Snapshot-Invariante).
 */
export class EigenschutzVorfallDto {
  @ApiProperty({ description: 'CUID des Vorfalls' })
  id!: string;

  @ApiProperty({ description: 'CUID des zugehörigen Einsatzes' })
  einsatzId!: string;

  @ApiProperty({ description: 'CUID der zugeordneten Einheit' })
  einheitId!: string;

  @ApiProperty({ description: 'Vorfall-Zeit (ISO-8601)' })
  vorfallZeit!: string;

  @ApiProperty({ description: 'Erfass-Zeit „Wann" (ISO-8601)' })
  wann!: string;

  @ApiProperty({ description: 'Kurzbeschreibung „Was" (1–80)' })
  was!: string;

  @ApiPropertyOptional({
    description: 'Vorfall-Ort als discriminated Union — `null` = nicht angegeben.',
    nullable: true,
    oneOf: [{ $ref: getSchemaPath(WoCoordinateDto) }, { $ref: getSchemaPath(WoFreitextDto) }],
  })
  wo!: WoCoordinateDto | WoFreitextDto | null;

  @ApiProperty({
    description: 'Beteiligte als Liste discriminated Unions',
    type: 'array',
    items: { oneOf: [{ $ref: getSchemaPath(BeteiligterEinsatzPersonDto) }, { $ref: getSchemaPath(BeteiligterFreitextDto) }] },
  })
  beteiligte!: Array<BeteiligterEinsatzPersonDto | BeteiligterFreitextDto>;

  @ApiProperty({ description: 'Maßnahmen (Freitext, ≤ 4000)' })
  massnahmen!: string;

  @ApiProperty({ description: 'Markierung „Unfallkasse-relevant"' })
  unfallkasseRelevant!: boolean;

  @ApiProperty({ description: 'Erfass-Zeitpunkt aus dem Server (ISO-8601)' })
  erfasstAm!: string;

  @ApiProperty({ description: 'CUID des erfassenden Users' })
  erfasstVonUserId!: string;

  @ApiProperty({
    description: 'Zeitpunkt-genauer Kontext-Snapshot (Story 5.1: leeres Objekt; Story 5.2 befüllt für neue Vorfälle)',
    type: 'object',
    additionalProperties: true,
  })
  kontextSnapshot!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Optionale Verknüpfung zu einer Gefährdungsbeurteilungs-Version (Story 5.2)' })
  gefBeurteilungVersionId?: string | null;
}
