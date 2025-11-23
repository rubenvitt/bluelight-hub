import { ApiProperty } from '@nestjs/swagger';

/**
 * Marker-DTO für LockEtb-Request.
 *
 * Dieses DTO repräsentiert einen bodyless PUT-Request zum Sperren eines ETB.
 * Die ETB-ID wird aus Route-Parametern extrahiert, die User-ID und Rolle
 * aus dem Auth-Context.
 *
 * **WARNUNG:** Das Sperren eines ETB ist IRREVERSIBEL (DRK-Compliance).
 * Nach dem Sperren sind keine weiteren Änderungen möglich.
 *
 * Die Klasse existiert primär für OpenAPI-Dokumentation und ggf. zukünftige
 * Body-Erweiterungen (z.B. Sperrgrund).
 *
 * @example
 * PUT /api/etb/:etbId/lock
 * Body: {} (leer)
 */
export class LockEtbDto {
  /**
   * Optionaler Sperrgrund für Audit-Zwecke.
   *
   * Wird aktuell nicht verwendet, ermöglicht aber zukünftige Erweiterungen
   * ohne Breaking Change.
   */
  @ApiProperty({
    description: 'Optionaler Sperrgrund (für zukünftige Erweiterungen)',
    example: 'Einsatz abgeschlossen und archiviert',
    required: false,
  })
  reason?: string;
}
