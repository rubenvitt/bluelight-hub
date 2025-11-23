/**
 * ETB Infrastructure Layer Exports.
 *
 * Dieses Modul stellt die Infrastructure-Implementierungen für das
 * Einsatztagebuch (ETB) Feature zur Verfügung.
 *
 * **Module Export:**
 * - EtbInfrastructureModule: NestJS Module mit Repository Provider
 *
 * **Repository Export:**
 * - PrismaEtbRepository: Konkrete Prisma-basierte Repository-Implementierung
 *
 * **Mapper Exports:**
 * - PrismaEtbMapper: Bidirektionale Aggregate <-> Prisma Konvertierung
 * - PrismaEintragMapper: EtbEintrag Entity <-> Prisma Konvertierung
 */

// Module
export { EtbInfrastructureModule } from './etb-infrastructure.module';

// Repository
export { PrismaEtbRepository } from './repositories';

// Mappers
export { PrismaEtbMapper, PrismaEintragMapper, type EinsatztagebuchWithEintraege, type EtbPersistenceData, type EtbEintragPersistenceData } from './mappers';
