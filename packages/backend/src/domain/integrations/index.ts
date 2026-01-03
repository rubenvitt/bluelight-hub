/**
 * Integrations Domain Module Exports.
 *
 * Enthält Entities, Repositories und Error Codes für externe Integrationen.
 *
 * @module domain/integrations
 */

// Entities
export {
  IntegrationCredential,
  INTEGRATION_TYPES,
  type IntegrationType,
  type IntegrationCredentialProps,
  type CreateOAuthCredentialDto,
  type UpdateOAuthTokensDto,
} from './entities/integration-credential.entity';

export {
  OAuth2State,
  type OAuth2StateProps,
  type CreateOAuth2StateProps,
} from './entities/oauth2-state.entity';

export {
  QualifikationMapping,
  AUTO_MATCH_CONFIG,
  type QualifikationMappingProps,
  type CreateMappingDto,
  type UpdateMappingDto,
  type AutoMatchType,
  type AutoMatchResult,
} from './entities/qualifikation-mapping.entity';

// Repositories
export type { IIntegrationCredentialRepository } from './repositories/i-integration-credential.repository';
export type { IOAuth2StateRepository } from './repositories/i-oauth2-state.repository';
export type { IQualifikationMappingRepository } from './repositories/i-qualifikation-mapping.repository';

// Error Codes
export {
  INTEGRATION_ERROR_CODES,
  IntegrationError,
  type IntegrationErrorCode,
} from './common/integration-error-codes';
