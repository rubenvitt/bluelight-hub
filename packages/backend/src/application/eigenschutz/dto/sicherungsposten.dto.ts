import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

/**
 * DTO-Variante des Standort-Value-Objects (Story 4.1, AC2). Spiegelt die
 * Shared-Zod-Schema `standortSchema`-discriminated Union für die OpenAPI-
 * Generierung 1:1.
 */
export class StandortCoordinateDto {
  @ApiProperty({ description: 'Discriminator', enum: ['coordinate'] })
  kind!: 'coordinate';

  @ApiProperty({ description: 'WGS84 Längengrad (-180..180)' })
  longitude!: number;

  @ApiProperty({ description: 'WGS84 Breitengrad (-90..90)' })
  latitude!: number;

  @ApiPropertyOptional({ description: 'Optionaler Adresshinweis (≤ 500 Zeichen)', nullable: true })
  addressHint?: string;
}

export class StandortAddressDto {
  @ApiProperty({ description: 'Discriminator', enum: ['address'] })
  kind!: 'address';

  @ApiProperty({ description: 'Adress- oder Freitext (1–500 Zeichen, getrimmt)' })
  text!: string;
}

/**
 * DTO-Variante eines Personal-Eintrags (Story 4.1, AC7).
 * Discriminated Union mit `kind: 'einsatzPerson' | 'freitext'`.
 */
export class PersonalEinsatzPersonEntryDto {
  @ApiProperty({ description: 'Discriminator', enum: ['einsatzPerson'] })
  kind!: 'einsatzPerson';

  @ApiProperty({ description: 'CUID2 einer im Einsatz registrierten EinsatzPerson' })
  einsatzPersonId!: string;
}

export class PersonalFreitextEntryDto {
  @ApiProperty({ description: 'Discriminator', enum: ['freitext'] })
  kind!: 'freitext';

  @ApiProperty({ description: 'Frei eingegebener Name (1–200 Zeichen, getrimmt)' })
  name!: string;

  @ApiPropertyOptional({ description: 'Optionale Rolle / Funktion (≤ 120 Zeichen)' })
  rolle?: string;
}

export class SicherungspostenDto {
  @ApiProperty({ description: 'CUID des Sicherungspostens' })
  id!: string;

  @ApiProperty({ description: 'CUID des Einsatzes' })
  einsatzId!: string;

  @ApiPropertyOptional({ description: 'CUID der zugeordneten Einheit (optional)', nullable: true })
  einheitId!: string | null;

  @ApiProperty({ description: 'Bezeichnung (1–200 Zeichen)' })
  bezeichnung!: string;

  @ApiProperty({
    description: 'Standort als discriminated Union (Coordinate oder Address)',
    oneOf: [{ $ref: getSchemaPath(StandortCoordinateDto) }, { $ref: getSchemaPath(StandortAddressDto) }],
  })
  standort!: StandortCoordinateDto | StandortAddressDto;

  @ApiProperty({
    description: 'Personal als Liste discriminated Unions (einsatzPerson oder freitext)',
    type: 'array',
    items: { oneOf: [{ $ref: getSchemaPath(PersonalEinsatzPersonEntryDto) }, { $ref: getSchemaPath(PersonalFreitextEntryDto) }] },
  })
  personal!: Array<PersonalEinsatzPersonEntryDto | PersonalFreitextEntryDto>;

  @ApiPropertyOptional({ description: 'Zuständigkeitsbereich (Freitext, ≤ 4000)', nullable: true })
  zustaendigkeitsbereich!: string | null;

  @ApiPropertyOptional({ description: 'Ablösezeiten (Freitext, ≤ 500). Editor-UI kommt mit Story 4.2.', nullable: true })
  abloesezeiten!: string | null;

  @ApiProperty({ description: 'Versionsnummer (monoton steigend)' })
  version!: number;

  @ApiProperty({ description: 'Zeitpunkt der Erstellung (ISO 8601)' })
  erstelltAm!: string;

  @ApiProperty({ description: 'User-ID des Erstellers' })
  erstelltVonUserId!: string;

  @ApiProperty({ description: 'Zeitpunkt der letzten Änderung (ISO 8601)' })
  aktualisiertAm!: string;

  @ApiProperty({ description: 'User-ID des letzten Bearbeiters' })
  aktualisiertVonUserId!: string;

  @ApiPropertyOptional({ description: 'Zeitpunkt der Auflösung (ISO 8601, null = aktiv)', nullable: true })
  aufgeloestAm!: string | null;

  @ApiPropertyOptional({ description: 'User-ID der Person, die den Posten aufgelöst hat', nullable: true })
  aufgeloestVonUserId!: string | null;

  @ApiPropertyOptional({ description: 'Begründung der Auflösung (≤ 2000 Zeichen)', nullable: true })
  aufloeseBegruendung!: string | null;
}
