/**
 * IntegrationCredential Repository Interface.
 *
 * Port-Interface für die Persistenz von IntegrationCredential Entities.
 * Wird im Infrastructure Layer mit Prisma implementiert.
 *
 * @module domain/integrations/repositories
 */

import type { Result } from '@domain/common/result';
import type { IntegrationCredential, IntegrationType } from '../entities/integration-credential.entity';

/**
 * Repository Interface für IntegrationCredential Entities.
 *
 * **Verwendung im Application Layer:**
 * ```typescript
 * constructor(
 *   @Inject(INTEGRATIONS.CREDENTIAL_REPOSITORY)
 *   private readonly credentialRepo: IIntegrationCredentialRepository,
 * ) {}
 * ```
 */
export interface IIntegrationCredentialRepository {
  /**
   * Findet Credentials nach Integration-Typ.
   *
   * Da type UNIQUE ist, gibt es maximal eine Credential pro Typ.
   *
   * @param type - Der Integration-Typ (z.B. HIORG_SERVER)
   * @returns Result mit Entity oder undefined wenn nicht gefunden
   */
  findByType(type: IntegrationType): Promise<Result<IntegrationCredential | undefined>>;

  /**
   * Speichert eine IntegrationCredential (Create oder Update).
   *
   * Bei Upsert wird nach type gesucht (UNIQUE Constraint).
   *
   * @param credential - Die zu speichernde Entity
   * @returns Result mit gespeicherter Entity (inkl. generierter ID)
   */
  save(credential: IntegrationCredential): Promise<Result<IntegrationCredential>>;

  /**
   * Löscht Credentials nach Integration-Typ.
   *
   * @param type - Der Integration-Typ
   * @returns Result<void> bei Erfolg
   */
  deleteByType(type: IntegrationType): Promise<Result<void>>;
}
