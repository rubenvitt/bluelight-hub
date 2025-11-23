import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaEtbRepository } from './repositories/prisma-etb.repository';

/**
 * NestJS Module für ETB Infrastructure Layer.
 *
 * Dieses Modul registriert die Infrastructure-Implementierungen
 * der Domain Repository Ports (Hexagonal Architecture Pattern).
 *
 * **Dependency Injection Strategy:**
 * - IEtbRepository wird als String Token bereitgestellt
 * - PrismaEtbRepository ist die konkrete Repository-Implementierung
 * - Application Layer kann das Interface injizieren via @Inject()
 *
 * **Warum String Token statt Class Token:**
 * - Domain Layer kennt NUR das Interface (IEtbRepository)
 * - Domain Layer kann NICHT auf Infrastructure Class referenzieren
 * - String Token entkoppelt Domain von Infrastructure
 * - Ermöglicht austauschbare Implementierungen:
 *   - Repository: Prisma, TypeORM, In-Memory
 *
 * **Module Dependencies:**
 * - PrismaModule: Stellt PrismaService für Repository zur Verfügung
 *
 * @example
 * ```typescript
 * // In Application Layer Command Handler:
 * @Injectable()
 * export class CreateEtbCommandHandler {
 *   constructor(
 *     @Inject('IEtbRepository')
 *     private readonly etbRepository: IEtbRepository
 *   ) {}
 * }
 * ```
 */
@Module({
  imports: [PrismaModule],
  providers: [
    // Repository Implementation bound to Interface Token
    {
      provide: 'IEtbRepository',
      useClass: PrismaEtbRepository,
    },
  ],
  exports: [
    // Export Interface Token for Application Layer injection
    'IEtbRepository',
  ],
})
export class EtbInfrastructureModule {}
