import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';

/**
 * Sub-DTO `Wo.coordinate` (Story 5.1, AC2 + AC6).
 */
export class WoCoordinateDto {
  @ApiProperty({ enum: ['coordinate'] })
  @IsIn(['coordinate'])
  kind!: 'coordinate';

  @ApiProperty({ description: 'WGS84 Längengrad (-180..180)' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ description: 'WGS84 Breitengrad (-90..90)' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiPropertyOptional({ description: 'Optionaler Adresshinweis (≤ 300)' })
  @IsOptional()
  @IsString()
  @Length(0, 300)
  addressHint?: string;
}

/**
 * Sub-DTO `Wo.freitext` (Story 5.1, AC2 + AC6). Längen-Cap 480 stellt sicher,
 * dass das stringifizierte JSON in die `VarChar(500)`-DB-Spalte passt.
 */
export class WoFreitextDto {
  @ApiProperty({ enum: ['freitext'] })
  @IsIn(['freitext'])
  kind!: 'freitext';

  @ApiProperty({ description: 'Freitext-Ortsangabe (1–480)' })
  @IsString()
  @Length(1, 480)
  text!: string;
}

/**
 * Sub-DTO `Beteiligter.einsatzPerson` (Story 5.1, AC2 + AC6).
 * Verweist auf eine im jeweiligen Einsatz registrierte `EinsatzPerson`
 * (Existenzprüfung im Command-Handler gegen den `IEinsatzPersonRepository`).
 */
export class BeteiligterEinsatzPersonDto {
  @ApiProperty({ enum: ['einsatzPerson'] })
  @IsIn(['einsatzPerson'])
  kind!: 'einsatzPerson';

  @ApiProperty({ description: 'CUID2 der im Einsatz registrierten EinsatzPerson' })
  @IsString()
  @Matches(/^[a-z0-9]{20,32}$/, { message: 'einsatzPersonId hat kein gültiges CUID-Format' })
  einsatzPersonId!: string;

  @ApiPropertyOptional({ description: 'Optionale Rolle (≤ 100)' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  rolle?: string;
}

export class BeteiligterFreitextDto {
  @ApiProperty({ enum: ['freitext'] })
  @IsIn(['freitext'])
  kind!: 'freitext';

  @ApiProperty({ description: 'Frei eingegebener Name (1–200)' })
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional({ description: 'Optionale Rolle (≤ 100)' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  rolle?: string;
}

/**
 * Request-Body für `POST /api/einsaetze/:einsatzId/sicherheit/eigenschutz/vorfaelle`
 * (Story 5.1, AC6 + AC7).
 *
 * `vorfallZeit` und `wann` sind im 5.1-Drawer identisch; das Modell trennt
 * sie für Phase-2-Backdating (Wallclock-Drift, Spät-Erfassung). 5-Min-Future-
 * Slack wird im Aggregate enforced.
 */
export class ReportVorfallDto {
  @ApiProperty({ description: 'CUID der Einheit, der der Vorfall zugeordnet ist' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]{20,32}$/, { message: 'einheitId hat kein gültiges CUID-Format' })
  einheitId!: string;

  @ApiProperty({ description: 'Kurzbeschreibung „Was" (1–80 Zeichen)' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 80)
  was!: string;

  @ApiProperty({ description: 'Erfass-Zeit „Wann" (ISO-8601)' })
  @IsDateString()
  wann!: string;

  @ApiProperty({ description: 'Vorfall-Zeit (ISO-8601, im MVP gleich „wann")' })
  @IsDateString()
  vorfallZeit!: string;

  @ApiPropertyOptional({
    description: 'Vorfall-Ort als discriminated Union — `null` = nicht angegeben.',
    nullable: true,
    oneOf: [{ $ref: getSchemaPath(WoCoordinateDto) }, { $ref: getSchemaPath(WoFreitextDto) }],
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object, {
    discriminator: {
      property: 'kind',
      subTypes: [
        { value: WoCoordinateDto, name: 'coordinate' },
        { value: WoFreitextDto, name: 'freitext' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  wo?: WoCoordinateDto | WoFreitextDto | null;

  @ApiProperty({
    description: 'Beteiligte als Liste discriminated Unions (kann leer sein)',
    type: 'array',
    items: { oneOf: [{ $ref: getSchemaPath(BeteiligterEinsatzPersonDto) }, { $ref: getSchemaPath(BeteiligterFreitextDto) }] },
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => Object, {
    discriminator: {
      property: 'kind',
      subTypes: [
        { value: BeteiligterEinsatzPersonDto, name: 'einsatzPerson' },
        { value: BeteiligterFreitextDto, name: 'freitext' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  beteiligte!: Array<BeteiligterEinsatzPersonDto | BeteiligterFreitextDto>;

  @ApiProperty({ description: 'Maßnahmen (≤ 4000, leer erlaubt)' })
  @IsString()
  @Length(0, 4000)
  massnahmen!: string;

  @ApiProperty({ description: 'Markierung „Unfallkasse-relevant" — Default `false`' })
  @IsBoolean()
  unfallkasseRelevant!: boolean;
}
