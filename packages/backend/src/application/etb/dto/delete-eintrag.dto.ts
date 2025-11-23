import { ApiProperty } from '@nestjs/swagger';

/**
 * Marker-DTO für DeleteEintrag-Request.
 *
 * Dieses DTO repräsentiert einen bodyless DELETE-Request. Die ETB-ID und
 * Eintrag-ID werden aus Route-Parametern extrahiert, die User-ID aus dem
 * Auth-Context.
 *
 * Die Klasse existiert primär für OpenAPI-Dokumentation und ggf. zukünftige
 * Body-Erweiterungen (z.B. Löschgrund).
 *
 * @example
 * DELETE /api/etb/:etbId/eintraege/:eintragId
 * Body: {} (leer)
 */
export class DeleteEintragDto {
  /**
   * Optionaler Löschgrund für Audit-Zwecke.
   *
   * Wird aktuell nicht verwendet, ermöglicht aber zukünftige Erweiterungen
   * ohne Breaking Change.
   */
  @ApiProperty({
    description: 'Optionaler Löschgrund (für zukünftige Erweiterungen)',
    example: 'Doppelter Eintrag',
    required: false,
  })
  reason?: string;
}
