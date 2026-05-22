import { Module } from '@nestjs/common';
import { PatientenApplicationModule } from '@/application/patienten/patienten-application.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { PatientenController } from './patienten.controller';

/**
 * HTTP-Module für die Patienten-Domain (Story 1.2).
 *
 * Bündelt den `PatientenController` und seine Abhängigkeiten:
 *  - `PatientenApplicationModule` für `ErfassePatientHandler`
 *  - `AuthModule` für `JwtAuthGuard` + `EinsatzScopeGuard`
 */
@Module({
  imports: [PatientenApplicationModule, AuthModule],
  controllers: [PatientenController],
})
export class PatientenModule {}
