import { ApiProperty } from '@nestjs/swagger';

/**
 * Informationen über ein fehlendes oder unvollständiges Feld.
 *
 * Repraesentiert ein Feld das zur Vervollstaendigung des Einsatzes fehlt
 * oder unvollstaendig ist, inkl. Prioritaet und Handlungsempfehlung.
 */
class CompletenessFieldInfo {
  @ApiProperty({
    description: 'Der Name des Feldes',
    example: 'ansprechpartner',
  })
  field!: string;

  @ApiProperty({
    description: 'Der vollstaendige Pfad zum Feld',
    example: 'einsatz.ansprechpartner',
  })
  fieldPath!: string;

  @ApiProperty({
    description: 'Die Prioritaet des fehlenden Feldes',
    enum: ['critical', 'important', 'optional'],
    example: 'critical',
  })
  priority!: 'critical' | 'important' | 'optional';

  @ApiProperty({
    description: 'Beschreibung des fehlenden Feldes',
    example: 'Kein Ansprechpartner definiert',
  })
  message!: string;

  @ApiProperty({
    description: 'Empfohlene Aktion zur Behebung',
    example: 'Fuegen Sie einen Ansprechpartner mit Name und Kontaktdaten hinzu',
  })
  suggestedAction!: string;
}

/**
 * Response DTO fuer Einsatz-Vollstaendigkeitsinformationen.
 *
 * Enthaelt den Vollstaendigkeits-Score (0-100), Flag ob vollstaendig,
 * und Liste der fehlenden Felder mit Prioritaeten.
 *
 * **Verwendung:**
 * - GET /api/einsatz/:id/completeness
 * - Einsatz-Detail-View: Zeigt Vollstaendigkeits-Indikatoren
 * - Dashboard: Filter nach Vollstaendigkeit
 *
 * **Business Rules:**
 * - score: 0-100 (Prozent vollstaendiger Felder gewichtet)
 * - isComplete: true wenn score === 100
 * - missingFields: Sortiert nach priority (critical → important → optional)
 *
 * @example
 * ```json
 * {
 *   "score": 75,
 *   "isComplete": false,
 *   "missingFields": [
 *     {
 *       "field": "einsatzleiter",
 *       "fieldPath": "einsatz.einsatzleiter",
 *       "priority": "critical",
 *       "message": "Kein Einsatzleiter definiert",
 *       "suggestedAction": "Weisen Sie einen Einsatzleiter zu"
 *     }
 *   ]
 * }
 * ```
 */
export class CompletenessResponseDto {
  @ApiProperty({
    description: 'Vollstaendigkeits-Score in Prozent',
    example: 75,
    minimum: 0,
    maximum: 100,
  })
  score!: number;

  @ApiProperty({
    description: 'Gibt an, ob der Einsatz vollstaendig ist',
    example: false,
  })
  isComplete!: boolean;

  @ApiProperty({
    description: 'Liste der fehlenden oder unvollstaendigen Felder',
    type: [CompletenessFieldInfo],
    isArray: true,
  })
  missingFields!: CompletenessFieldInfo[];
}
