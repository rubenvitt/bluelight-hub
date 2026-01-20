import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO fuer WebSocket join:einsatz Event.
 *
 * **Security:** Validiert einsatzId vor Room-Join um Room Traversal zu verhindern.
 * MUSS UUID v4 Format sein (verhindert Path Traversal via Room-Namen).
 */
export class JoinEinsatzDto {
  @ApiProperty({
    description: 'ID des Einsatzes dessen Erinnerungen abonniert werden',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'einsatzId muss eine gültige UUID v4 sein' })
  einsatzId!: string;
}
