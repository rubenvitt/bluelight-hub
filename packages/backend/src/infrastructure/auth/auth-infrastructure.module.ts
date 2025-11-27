import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
 * - ConfigModule: Stellt Umgebungsvariablen bereit
 * - JwtModule: NestJS JWT Service für Token-Operationen
 *
 * **JWT Configuration:**
 * - Secret wird aus JWT_SECRET Environment Variable gelesen
 * - Token Expiration: 24 Stunden (konfigurierbar)
 * - JwtModule wird asynchron registriert für ConfigService Injection
 *
 * **useExisting vs useClass:**
 * - JwtTokenServiceAdapter als direkter Provider registriert
 * - JWT_AUTH_SERVICE Token aliased auf existierende Instanz
 * - Ermöglicht Injection via Token ODER direkte Class
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
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '24h',
        },
      }),
    }),
  ],
  providers: [
    JwtTokenServiceAdapter,
    {
      provide: JWT_AUTH_SERVICE,
      useExisting: JwtTokenServiceAdapter,
    },
  ],
  exports: [JWT_AUTH_SERVICE, JwtTokenServiceAdapter],
})
export class AuthInfrastructureModule {}
