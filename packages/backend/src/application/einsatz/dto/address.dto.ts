import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO fuer Adressen in Einsatz-Daten.
 *
 * Verwendet fuer einsatzort im EinsatzDto. Enthaelt alle
 * Adressfelder die fuer die API-Response relevant sind.
 *
 * **Warum separates DTO statt Address Value Object:**
 * - API-Schicht braucht nur Daten, keine Business Logic
 * - Swagger Decorators sind API-Concern, nicht Domain
 * - Ermoeglicht unabhaengige API-Evolution
 */
export class AddressDto {
  @ApiProperty({
    description: 'Strassenname',
    example: 'Musterstrasse',
  })
  strasse!: string;

  @ApiPropertyOptional({
    description: 'Hausnummer (optional)',
    example: '42a',
  })
  hausnummer?: string;

  @ApiProperty({
    description: 'Postleitzahl',
    example: '80331',
  })
  plz!: string;

  @ApiProperty({
    description: 'Ortsname',
    example: 'Muenchen',
  })
  ort!: string;

  @ApiPropertyOptional({
    description: 'Land (optional, default: Deutschland)',
    example: 'Deutschland',
  })
  land?: string;
}
