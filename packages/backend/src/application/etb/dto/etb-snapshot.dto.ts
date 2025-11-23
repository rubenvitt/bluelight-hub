import { ApiProperty } from '@nestjs/swagger';
import { EintragDto } from './eintrag.dto';

/**
 * ETB Snapshot DTO für historische Ansichten.
 *
 * Repräsentiert einen Snapshot-Zustand des ETB zu einem bestimmten
 * Zeitpunkt. Wird für Audit-Trail, Zeitreisen und Report-Generierung
 * verwendet.
 *
 * **Warum Snapshots:**
 * - Audit-Compliance: Nachvollziehbarkeit für Behörden
 * - PDF-Export: Generierung von Reports zu definiertem Zeitpunkt
 * - Konflikt-Resolution: Basis für 3-Way-Merge bei Offline-Sync
 *
 * **Unterschied zu EtbDto:**
 * - EtbDto: Aktueller Live-Zustand des Aggregates
 * - EtbSnapshotDto: Eingefrorener Zustand zu spezifischem Zeitpunkt
 * - EtbDto: Enthält Status/Lock-Informationen
 * - EtbSnapshotDto: Nur Daten, kein Workflow-State
 */
export class EtbSnapshotDto {
  @ApiProperty({
    description: 'Versionsnummer zum Snapshot-Zeitpunkt',
    example: 5,
    minimum: 1,
  })
  version!: number;

  @ApiProperty({
    description: 'Zeitpunkt der Snapshot-Erstellung',
    example: '2024-01-15T12:00:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  snapshotAt!: Date;

  @ApiProperty({
    description: 'Alle Einträge zum Snapshot-Zeitpunkt',
    type: [EintragDto],
    isArray: true,
  })
  eintraege!: EintragDto[];
}
