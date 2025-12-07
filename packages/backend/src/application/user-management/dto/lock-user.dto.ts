import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Data Transfer Object für das Sperren eines Benutzers
 *
 * Erlaubt optionale Angabe eines Sperrgrundes.
 */
export class LockUserDto {
  /**
   * Grund der Sperrung (optional)
   *
   * @example "Verstoß gegen Nutzungsbedingungen"
   */
  @ApiProperty({
    description: 'Grund der Sperrung (optional)',
    example: 'Verstoß gegen Nutzungsbedingungen',
    required: false,
    maxLength: 500,
    type: 'string',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Sperrgrund darf maximal 500 Zeichen lang sein' })
  reason?: string;
}
