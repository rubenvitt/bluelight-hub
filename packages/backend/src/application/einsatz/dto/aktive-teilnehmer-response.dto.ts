import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO fuer aktive Einsatz-Teilnehmer API Responses.
 *
 * Wird verwendet fuer:
 * - GET /einsatz/:einsatzId/teilnehmer (Liste aktiver Teilnehmer)
 *
 * **Story 3.3 AC1:**
 * - Auswahl fuer "Zuweisen an" Feld bei Erinnerung-Erstellung
 * - Filter: Nur aktive Teilnehmer (leftAt === null)
 *
 * **Felder:**
 * - userId: Eindeutige User-ID fuer Zuweisung
 * - username: Anzeigename des Users
 * - funkrufname: Einsatz-spezifischer Funkrufname
 * - joinedAt: Zeitpunkt des Einsatz-Beitritts
 *
 * **Hinweis:** Umbenennung von `EinsatzTeilnehmerResponseDto` zu `AktiveTeilnehmerResponseDto`
 * um Konflikte mit dem bestehenden DTO im `einsatz-teilnehmer` Modul zu vermeiden.
 */
export class AktiveTeilnehmerResponseDto {
  @ApiProperty({
    description: 'Eindeutige User-ID (CUID2)',
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  userId!: string;

  @ApiProperty({
    description: 'Username des Teilnehmers',
    example: 'tschmidt',
  })
  username!: string;

  @ApiProperty({
    description: 'Funkrufname im Einsatz',
    example: 'Florian 11/40',
  })
  funkrufname!: string;

  @ApiProperty({
    description: 'Zeitpunkt des Einsatz-Beitritts (ISO-8601)',
    example: '2026-01-23T08:00:00.000Z',
  })
  joinedAt!: string;
}
