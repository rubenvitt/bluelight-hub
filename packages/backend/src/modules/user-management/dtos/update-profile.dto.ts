import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

/**
 * DTO für das Aktualisieren des eigenen Benutzerprofils.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'ID des Users, an den Erinnerungen standardmäßig eskaliert werden sollen (Story 4.8)',
    example: 'cuid...',
  })
  @IsOptional()
  @IsString()
  @Length(20, 30) // CUID length validation
  defaultEscalationTargetId?: string | null;
}
