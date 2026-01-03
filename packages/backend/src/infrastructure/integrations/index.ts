/**
 * Integrations Infrastructure Module Exports.
 *
 * Enthält Adapter für externe Dienste wie HiOrg-Server.
 *
 * @module infrastructure/integrations
 */

// Adapter
export { HiOrgServerAdapter } from './hiorg-server.adapter';
export { OAuth2Adapter } from './oauth2.adapter';

// Repositories
export { PrismaIntegrationCredentialRepository } from './repositories/prisma-integration-credential.repository';
export { PrismaOAuth2StateRepository } from './repositories/prisma-oauth2-state.repository';
