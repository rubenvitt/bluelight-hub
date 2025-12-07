import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Data Transfer Object für die Löschung eines Benutzers
 *
 * Erlaubt optionale Herabstufung statt vollständiger Löschung.
 */
export class DeleteUserDto {
  /**
   * Bei true: Admin wird zu USER herabgestuft statt gelöscht
   *
   * @example false
   * @default false
   */
  @ApiProperty({
    description: 'Bei true: Admin wird zu USER herabgestuft statt gelöscht (Passwort wird entfernt)',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  downgradeAdmin?: boolean;
}
