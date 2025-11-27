import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { USER_REPOSITORY } from '../di-tokens';
import { PrismaUserRepository } from './repositories/prisma-user.repository';

/**
 * NestJS Module für User Infrastructure Layer.
 *
 * Dieses Modul registriert die Infrastructure-Implementierungen
 * der Domain Repository Ports (Hexagonal Architecture Pattern).
 *
 * **Dependency Injection Strategy:**
 * - IUserRepository wird als Symbol Token bereitgestellt
 * - PrismaUserRepository ist die konkrete Repository-Implementierung
 * - Application Layer kann das Interface injizieren via @Inject(USER_REPOSITORY)
 *
 * **Warum Symbol Token:**
 * - Type Safety: Symbol ist type-safe und unique
 * - Domain Layer kennt NUR das Interface (IUserRepository)
 * - Domain Layer kann NICHT auf Infrastructure Class referenzieren
 * - Symbol Token entkoppelt Domain von Infrastructure
 * - Ermöglicht austauschbare Implementierungen (Prisma, In-Memory für Tests)
 *
 * **Module Dependencies:**
 * - PrismaModule: Stellt PrismaService für Repository zur Verfügung
 *
 * @example
 * ```typescript
 * // In Application Layer Command Handler:
 * @Injectable()
 * export class RegisterUserCommandHandler {
 *   constructor(
 *     @Inject(USER_REPOSITORY)
 *     private readonly userRepository: IUserRepository
 *   ) {}
 * }
 * ```
 */
@Module({
  imports: [PrismaModule],
  providers: [
    // Repository Implementation bound to Symbol Token
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
  ],
  exports: [
    // Export Symbol Token for Application Layer injection
    USER_REPOSITORY,
  ],
})
export class UserInfrastructureModule {}
