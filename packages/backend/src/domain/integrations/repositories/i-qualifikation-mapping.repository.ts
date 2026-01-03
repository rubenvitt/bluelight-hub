/**
 * IQualifikationMappingRepository - Repository Interface für Qualifikations-Mappings.
 *
 * Story 7.2: HiOrg-Server Import - Qualifikations-Mapping
 *
 * Definiert die Persistence-Schnittstelle für QualifikationMapping Entities.
 * Implementierung erfolgt im Infrastructure Layer via Prisma.
 *
 * @module domain/integrations/repositories
 */

import type { Result } from '@domain/common/result';
import type { TransactionContext } from '@domain/common/transaction';
import type { IntegrationType } from '../entities/integration-credential.entity';
import type { QualifikationMapping } from '../entities/qualifikation-mapping.entity';

/**
 * Repository Interface für QualifikationMapping.
 *
 * **Verwendung:**
 * ```typescript
 * // Alle Mappings für HiOrg-Server laden
 * const mappings = await repository.findByExternalSource('HIORG_SERVER');
 *
 * // Einzelnes Mapping finden
 * const mapping = await repository.findByExternalName('Gruppenführer', 'HIORG_SERVER');
 *
 * // Batch-Speicherung
 * await repository.saveMany(newMappings, tx);
 * ```
 */
export interface IQualifikationMappingRepository {
  /**
   * Findet alle Mappings für eine externe Quelle.
   *
   * @param source - Externe Quelle (z.B. "HIORG_SERVER")
   * @param tx - Optional: Transaction Context
   * @returns Result mit Array von Mappings oder Fehler
   */
  findByExternalSource(source: IntegrationType, tx?: TransactionContext): Promise<Result<QualifikationMapping[]>>;

  /**
   * Findet ein Mapping nach externem Namen und Quelle.
   *
   * @param name - Externer Qualifikations-Name (z.B. "Gruppenführer")
   * @param source - Externe Quelle (z.B. "HIORG_SERVER")
   * @param tx - Optional: Transaction Context
   * @returns Result mit Mapping oder null wenn nicht gefunden
   */
  findByExternalName(name: string, source: IntegrationType, tx?: TransactionContext): Promise<Result<QualifikationMapping | null>>;

  /**
   * Findet ein Mapping nach ID.
   *
   * @param id - Mapping ID
   * @param tx - Optional: Transaction Context
   * @returns Result mit Mapping oder null wenn nicht gefunden
   */
  findById(id: string, tx?: TransactionContext): Promise<Result<QualifikationMapping | null>>;

  /**
   * Findet alle Mappings die auf eine bestimmte Qualifikation verweisen.
   *
   * @param qualifikationId - ID der internen Qualifikation
   * @param tx - Optional: Transaction Context
   * @returns Result mit Array von Mappings oder Fehler
   */
  findByQualifikationId(qualifikationId: string, tx?: TransactionContext): Promise<Result<QualifikationMapping[]>>;

  /**
   * Findet alle ungemappten Einträge für eine Quelle.
   *
   * @param source - Externe Quelle (z.B. "HIORG_SERVER")
   * @param tx - Optional: Transaction Context
   * @returns Result mit Array von ungemappten Mappings
   */
  findUnmapped(source: IntegrationType, tx?: TransactionContext): Promise<Result<QualifikationMapping[]>>;

  /**
   * Speichert ein Mapping (Create oder Update).
   *
   * Bei bereits existierendem externalName+externalSource wird ein Update durchgeführt.
   *
   * @param mapping - Zu speicherndes Mapping
   * @param tx - Optional: Transaction Context
   * @returns Result mit void oder Fehler
   */
  save(mapping: QualifikationMapping, tx?: TransactionContext): Promise<Result<void>>;

  /**
   * Speichert mehrere Mappings in einem Batch.
   *
   * Verwendet Upsert-Semantik: existierende Einträge werden aktualisiert,
   * neue Einträge werden erstellt.
   *
   * @param mappings - Array von Mappings
   * @param tx - Optional: Transaction Context
   * @returns Result mit void oder Fehler
   */
  saveMany(mappings: QualifikationMapping[], tx?: TransactionContext): Promise<Result<void>>;

  /**
   * Löscht ein Mapping nach ID.
   *
   * @param id - Mapping ID
   * @param tx - Optional: Transaction Context
   * @returns Result mit void oder Fehler
   */
  delete(id: string, tx?: TransactionContext): Promise<Result<void>>;

  /**
   * Löscht alle Mappings für eine externe Quelle.
   *
   * Nützlich beim Reset der Integration.
   *
   * @param source - Externe Quelle
   * @param tx - Optional: Transaction Context
   * @returns Result mit Anzahl gelöschter Einträge
   */
  deleteBySource(source: IntegrationType, tx?: TransactionContext): Promise<Result<number>>;

  /**
   * Zählt die Mappings für eine Quelle.
   *
   * @param source - Externe Quelle
   * @param onlyMapped - Nur gemappte zählen (default: false)
   * @param tx - Optional: Transaction Context
   * @returns Result mit Anzahl
   */
  count(source: IntegrationType, onlyMapped?: boolean, tx?: TransactionContext): Promise<Result<{ total: number; mapped: number; unmapped: number }>>;
}
