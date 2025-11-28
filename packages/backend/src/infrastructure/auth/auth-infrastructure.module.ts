import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JWT_AUTH_SERVICE } from '../di-tokens';
import { JwtTokenServiceAdapter } from './adapters/jwt-token-service.adapter';

/**
 * NestJS Module für Auth Infrastructure Layer.
 *
 * Dieses Modul registriert die Infrastructure-Implementierungen
 * der Authentication Service Ports (Hexagonal Architecture Pattern).
 *
 * **Dependency Injection Strategy:**
 * - IJwtAuthServicePort wird als Symbol Token bereitgestellt
 * - JwtTokenServiceAdapter ist die konkrete Service-Implementierung
 * - Application Layer kann das Interface injizieren via @Inject(JWT_AUTH_SERVICE)
 *
 * **Warum Symbol Token:**
 * - Type Safety: Symbol ist type-safe und unique
 * - Application Layer kennt NUR das Interface (IJwtAuthServicePort)
 * - Application Layer kann NICHT auf Infrastructure Class referenzieren
 * - Symbol Token entkoppelt Application von Infrastructure
 * - Ermöglicht austauschbare Implementierungen (JWT, OAuth, Mock für Tests)
 *
 * **Module Dependencies:**
 * - JwtModule: NestJS JWT Service für Token-Operationen (mit registerAsync)
 * - ConfigService: Wird vom parent Module (AppModule) global bereitgestellt
 *
 * **JWT Configuration:**
 * - Secret wird aus JWT_SECRET Environment Variable gelesen
 * - Token Expiration: 24 Stunden
 * - JwtModule.registerAsync mit Factory (kein external dependency injection)
 *
 * **Module Scope:**
 * - ConfigService ist global registriert im AppModule
 * - JwtModule ist lokal registriert, wird aber über Factory konfiguriert
 *
 * @example
 * ```typescript
 * // In Application Layer Login Handler:
 * @Injectable()
 * export class LoginCommandHandler {
 *   constructor(
 *     @Inject(JWT_AUTH_SERVICE)
 *     private readonly jwtService: IJwtAuthServicePort
 *   ) {}
 * }
 * ```
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '24h',
      },
    }),
  ],
  providers: [
    JwtTokenServiceAdapter,
    {
      provide: JWT_AUTH_SERVICE,
      useExisting: JwtTokenServiceAdapter,
    },
  ],
  exports: [JWT_AUTH_SERVICE, JwtTokenServiceAdapter, JwtModule],
})
export class AuthInfrastructureModule {}
