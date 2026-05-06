import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Length, Matches, Max, Min, ValidateIf, ValidateNested } from 'class-validator';

/**
 * Request-Body-Sub-DTO für Standort-Coordinate (Story 4.1, AC2).
 */
export class CreateSicherungspostenStandortCoordinateDto {
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

  @ApiPropertyOptional({ description: 'Optionaler Adresshinweis (≤ 500)' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  addressHint?: string;
}

export class CreateSicherungspostenStandortAddressDto {
  @ApiProperty({ enum: ['address'] })
  @IsIn(['address'])
  kind!: 'address';

  @ApiProperty({ description: 'Adress- oder Freitext (1–500)' })
  @IsString()
  @Length(1, 500)
  text!: string;
}

export class CreateSicherungspostenPersonalUserDto {
  @ApiProperty({ enum: ['user'] })
  @IsIn(['user'])
  kind!: 'user';

  @ApiProperty({ description: 'CUID des Stamm-Users' })
  @IsString()
  @Length(1, 40)
  userId!: string;
}

export class CreateSicherungspostenPersonalFreitextDto {
  @ApiProperty({ enum: ['freitext'] })
  @IsIn(['freitext'])
  kind!: 'freitext';

  @ApiProperty({ description: 'Frei eingegebener Name (1–200)' })
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional({ description: 'Optionale Rolle (≤ 120)' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  rolle?: string;
}

/**
 * Request-Body für `POST /api/einsaetze/:einsatzId/sicherheit/eigenschutz/sicherungsposten`
 * (Story 4.1, AC8).
 *
 * Validierung ist klassenbasiert (class-validator) — semantisch identisch mit
 * `createSicherungspostenRequestSchema` aus `@bluelight-hub/shared/schemas`.
 */
export class CreateSicherungspostenDto {
  @ApiProperty({ description: 'Bezeichnung des Postens (1–200)' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  bezeichnung!: string;

  @ApiProperty({
    description: 'Standort als discriminated Union',
    oneOf: [{ $ref: getSchemaPath(CreateSicherungspostenStandortCoordinateDto) }, { $ref: getSchemaPath(CreateSicherungspostenStandortAddressDto) }],
  })
  @ValidateNested()
  @Type(() => Object, {
    discriminator: {
      property: 'kind',
      subTypes: [
        { value: CreateSicherungspostenStandortCoordinateDto, name: 'coordinate' },
        { value: CreateSicherungspostenStandortAddressDto, name: 'address' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  standort!: CreateSicherungspostenStandortCoordinateDto | CreateSicherungspostenStandortAddressDto;

  @ApiProperty({
    description: 'Personal als Liste discriminated Unions',
    type: 'array',
    items: { oneOf: [{ $ref: getSchemaPath(CreateSicherungspostenPersonalUserDto) }, { $ref: getSchemaPath(CreateSicherungspostenPersonalFreitextDto) }] },
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => Object, {
    discriminator: {
      property: 'kind',
      subTypes: [
        { value: CreateSicherungspostenPersonalUserDto, name: 'user' },
        { value: CreateSicherungspostenPersonalFreitextDto, name: 'freitext' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  personal!: Array<CreateSicherungspostenPersonalUserDto | CreateSicherungspostenPersonalFreitextDto>;

  @ApiPropertyOptional({ description: 'CUID der zugeordneten Einheit (optional)' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]{20,32}$/, { message: 'einheitId hat kein gültiges CUID-Format' })
  einheitId?: string;

  @ApiPropertyOptional({ description: 'Zuständigkeitsbereich (Freitext, ≤ 4000)' })
  @IsOptional()
  @IsString()
  @Length(0, 4000)
  zustaendigkeitsbereich?: string;

  @ApiPropertyOptional({ description: 'Ablösezeiten als Freitext (z. B. „08:00 – 12:00 Trupp 1", ≤ 2000)' })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  abloesezeiten?: string;
}

/**
 * Request-Body für `PATCH …/sicherungsposten/:postenId` (Story 4.1, AC8).
 */
export class UpdateSicherungspostenDto {
  @ApiProperty({ description: 'Erwartete Versionsnummer (Optimistic-Concurrency)' })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional({ description: 'Bezeichnung (1–200), optional' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  bezeichnung?: string;

  @ApiPropertyOptional({
    description: 'Standort als discriminated Union, optional',
    oneOf: [{ $ref: getSchemaPath(CreateSicherungspostenStandortCoordinateDto) }, { $ref: getSchemaPath(CreateSicherungspostenStandortAddressDto) }],
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object, {
    discriminator: {
      property: 'kind',
      subTypes: [
        { value: CreateSicherungspostenStandortCoordinateDto, name: 'coordinate' },
        { value: CreateSicherungspostenStandortAddressDto, name: 'address' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  standort?: CreateSicherungspostenStandortCoordinateDto | CreateSicherungspostenStandortAddressDto;

  @ApiPropertyOptional({
    description: 'Personal-Liste, optional',
    type: 'array',
    items: { oneOf: [{ $ref: getSchemaPath(CreateSicherungspostenPersonalUserDto) }, { $ref: getSchemaPath(CreateSicherungspostenPersonalFreitextDto) }] },
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => Object, {
    discriminator: {
      property: 'kind',
      subTypes: [
        { value: CreateSicherungspostenPersonalUserDto, name: 'user' },
        { value: CreateSicherungspostenPersonalFreitextDto, name: 'freitext' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  personal?: Array<CreateSicherungspostenPersonalUserDto | CreateSicherungspostenPersonalFreitextDto>;

  @ApiPropertyOptional({ description: 'CUID der Einheit (null = entkoppeln, optional)', nullable: true })
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @Matches(/^[a-z0-9]{20,32}$/, { message: 'einheitId hat kein gültiges CUID-Format' })
  einheitId?: string | null;

  @ApiPropertyOptional({ description: 'Zuständigkeitsbereich (≤ 4000, null = leeren)', nullable: true })
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @Length(0, 4000)
  zustaendigkeitsbereich?: string | null;

  @ApiPropertyOptional({ description: 'Ablösezeiten (≤ 2000, null = leeren)', nullable: true })
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @Length(0, 2000)
  abloesezeiten?: string | null;
}

/**
 * Request-Body für `POST …/sicherungsposten/:postenId/aufloesen` (Story 4.1, AC8 + UX-DR27).
 */
export class AufloeseSicherungspostenDto {
  @ApiProperty({ description: 'Erwartete Versionsnummer (Optimistic-Concurrency)' })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ description: 'Pflicht-Begründung der Auflösung (1–2000 Zeichen)', minLength: 1, maxLength: 2000 })
  @IsString()
  @Length(1, 2000)
  begruendung!: string;
}
