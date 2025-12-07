import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiMeta, ApiPagination } from '@/shared/interfaces/api-response.interface';
import { TextbausteinDto } from './textbaustein.dto';

/**
 * Response DTO fuer die Textbausteine-Liste.
 *
 * Folgt dem Standard-API-Response-Format mit meta, message, pagination und data.
 * Wird vom EtbCqrsController fuer GET /etb/textbausteine verwendet.
 */
export class TextbausteinListResponse {
  @ApiProperty({
    description: 'Metadaten zur Antwort',
    type: ApiMeta,
  })
  meta!: ApiMeta;

  @ApiPropertyOptional({
    description: 'Optionale Nachricht',
    example: 'Textbausteine erfolgreich geladen',
  })
  message?: string;

  @ApiPropertyOptional({
    description: 'Paginierungs-Informationen',
    type: ApiPagination,
  })
  pagination?: ApiPagination;

  @ApiProperty({
    description: 'Liste der verfuegbaren Textbausteine',
    type: [TextbausteinDto],
  })
  data!: TextbausteinDto[];
}
