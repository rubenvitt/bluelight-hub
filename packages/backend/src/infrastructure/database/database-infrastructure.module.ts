import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaTransactionManager } from './prisma-transaction-manager';
import { TRANSACTION_MANAGER } from '../di-tokens';

/**
 * Database Infrastructure Module.
 *
 * Exportiert framework-agnostische Database Services für den Application Layer:
 * - ITransactionManager Implementation (PrismaTransactionManager)
 *
 * **Warum separates Module?**
 * - Kapselung: Alle Database-spezifischen Implementierungen an einem Ort
 * - Wiederverwendbarkeit: Kann von mehreren Feature Modules importiert werden
 * - Single Responsibility: Nur Database Infrastruktur, keine Business Logic
 * - Austauschbarkeit: Wenn DB-Technologie wechselt, nur dieses Module anpassen
 *
 * **Provider Registration:**
 * - TRANSACTION_MANAGER: Symbol Token für ITransactionManager
 * - PrismaTransactionManager: Konkrete Prisma Implementation
 *
 * **Usage in Feature Modules:**
 * ```typescript
 * @Module({
 *   imports: [DatabaseInfrastructureModule],
 *   providers: [MyCommandHandler],
 * })
 * export class MyFeatureModule {}
 *
 * @Injectable()
 * class MyCommandHandler {
 *   constructor(
 *     @Inject(TRANSACTION_MANAGER) private readonly txManager: ITransactionManager,
 *   ) {}
 * }
 * ```
 */
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: TRANSACTION_MANAGER,
      useClass: PrismaTransactionManager,
    },
  ],
  exports: [TRANSACTION_MANAGER],
})
export class DatabaseInfrastructureModule {}
