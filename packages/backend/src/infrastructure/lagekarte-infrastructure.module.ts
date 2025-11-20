import { Module } from '@nestjs/common';
import { PrismaLagekarteRepository } from './repositories/prisma-lagekarte.repository';
import { PrismaModule } from '@/prisma/prisma.module';

/**
 * NestJS Module für Lagekarte Infrastructure Layer.
 *
 * Dieses Modul registriert die Infrastructure-Implementierungen
 * der Domain Repository Ports (Hexagonal Architecture Pattern).
 *
 * **Dependency Injection Strategy:**
 * - ILagekarteRepository wird als String Token bereitgestellt
 * - PrismaLagekarteRepository ist die konkrete Implementierung
 * - Application Layer kann das Interface injizieren via @Inject()
 *
 * **Warum String Token statt Class Token:**
 * - Domain Layer kennt NUR das Interface (ILagekarteRepository)
 * - Domain Layer kann NICHT auf Infrastructure Class referenzieren
 * - String Token "ILagekarteRepository" entkoppelt Domain von Infrastructure
 * - Ermöglicht austauschbare Implementierungen (Prisma, TypeORM, In-Memory)
 *
 * **Module Dependencies:**
 * - PrismaModule: Stellt PrismaService für Repository zur Verfügung
 *
 * @example
 * ```typescript
 * // In Application Layer Command Handler:
 * @Injectable()
 * export class CreateLagekarteCommandHandler {
 *   constructor(
 *     @Inject('ILagekarteRepository')
 *     private readonly lagekarteRepository: ILagekarteRepository
 *   ) {}
 * }
 * ```
 */
@Module({
  imports: [PrismaModule], // Import PrismaModule für PrismaService
  providers: [
    {
      provide: 'ILagekarteRepository', // String Token (Interface-Name)
      useClass: PrismaLagekarteRepository, // Konkrete Implementation
    },
  ],
  exports: ['ILagekarteRepository'], // Export für andere Module
})
export class LagekarteInfrastructureModule {}
