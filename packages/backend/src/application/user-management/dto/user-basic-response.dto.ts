import { ApiProperty } from '@nestjs/swagger';
import { ApiResponse } from '@/shared/interfaces/api-response.interface';

/**
 * DTO für Basis-Benutzerinformationen
 *
 * Enthält nur id und username (minimale User-Info).
 */
export class UserBasicDto {
  /**
   * Eindeutige ID des Benutzers
   */
  @ApiProperty({
    description: 'Eindeutige ID des Benutzers',
    example: 'e2MVL-F3H2Audi4ud4pDG',
  })
  id!: string;

  /**
   * Benutzername
   */
  @ApiProperty({
    description: 'Benutzername',
    example: 'admin',
  })
  username!: string;
}

/**
 * Response-DTO für die Basis-Benutzerliste
 */
export class UserBasicListResponse extends ApiResponse<UserBasicDto[]> {
  @ApiProperty({
    description: 'Liste der Basis-Benutzerinformationen',
    type: UserBasicDto,
    isArray: true,
  })
  data!: UserBasicDto[];
}
