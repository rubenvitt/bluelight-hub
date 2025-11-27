import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UserInfrastructureModule } from '@infrastructure/user/user-infrastructure.module';
import { AuthInfrastructureModule } from '@infrastructure/auth/auth-infrastructure.module';
import { LoginHandler, LogoutHandler } from './commands';

/**
 * NestJS-Modul für Application Layer - Auth Bounded Context.
 *
 * Dieses Modul registriert alle Command-Handler für Authentifizierung
 * und macht sie über Dependency Injection verfügbar. Ermöglicht
 * Controller (Infrastructure Layer) die Handler zu nutzen, ohne direkt zu
 * importieren (Loose Coupling).
 *
 * **CQRS Pattern:**
 * - Command Handlers: State Mutation (Login, Logout)
 * - Query Handlers: State Reading (aktuell keine, Future: GetCurrentUser)
 *
 * **Warum separate Module pro Bounded Context:**
 * - Klare Modul-Grenzen entsprechend DDD
 * - Selektives Testen möglich (nur Auth-Context)
 * - Einfachere Migration zu Microservices
 * - Dependency Injection Scope pro Context
 *
 * **Module Dependencies:**
 * - CqrsModule: NestJS CQRS Infrastructure (CommandBus, QueryBus, EventBus)
 * - UserInfrastructureModule: IUserRepository Provider
 * - AuthInfrastructureModule: IJwtAuthServicePort Provider
 *
 * **Warum UserInfrastructureModule importiert:**
 * - LoginHandler benötigt IUserRepository für User Lookup
 * - Hexagonal Architecture: Application Layer nutzt Port (Repository Interface)
 * - Infrastructure Layer stellt Adapter bereit (PrismaUserRepository)
 *
 * **Warum AuthInfrastructureModule importiert:**
 * - LoginHandler/LogoutHandler benötigen IJwtAuthServicePort
 * - Hexagonal Architecture: Application Layer nutzt Port (JWT Service Interface)
 * - Infrastructure Layer stellt Adapter bereit (JwtTokenServiceAdapter)
 *
 * @example
 * ```typescript
 * // In Module imports:
 * @Module({
 *   imports: [AuthApplicationModule, UserInfrastructureModule, AuthInfrastructureModule],
 * })
 * export class AuthModule {}
 * ```
 */
@Module({
  imports: [
    // CQRS Infrastructure (CommandBus, QueryBus, EventBus)
    CqrsModule,

    // Repository Infrastructure (IUserRepository)
    UserInfrastructureModule,

    // Service Infrastructure (IJwtAuthServicePort)
    AuthInfrastructureModule,
  ],
  providers: [
    // Command Handlers
    LoginHandler,
    LogoutHandler,
  ],
  exports: [
    // Export handlers for use in Infrastructure Layer (Controllers)
    LoginHandler,
    LogoutHandler,
  ],
})
export class AuthApplicationModule {}
