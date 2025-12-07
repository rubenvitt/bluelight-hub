/**
 * Database Infrastructure Exports.
 *
 * Exportiert alle Database-spezifischen Infrastruktur-Komponenten:
 * - Modules: DatabaseInfrastructureModule, PrismaModule
 * - Services: PrismaService
 * - Implementations: PrismaTransactionManager
 */

export { DatabaseInfrastructureModule } from './database-infrastructure.module';
export { PrismaTransactionManager } from './prisma-transaction-manager';
export { PrismaService } from './prisma.service';
export { PrismaModule } from './prisma.module';
