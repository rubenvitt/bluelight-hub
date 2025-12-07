import { Module } from '@nestjs/common';
import { UserManagementApplicationModule } from '@application/user-management';
import { AuthModule } from '@/modules/auth/auth.module';
import { UserController } from './controllers/user.controller';
import { UserManagementController } from './controllers/user-management.controller';

/**
 * NestJS Module für User Management Infrastructure Layer.
 *
 * Dieses Modul registriert die HTTP-Controllers für User-Verwaltung
 * und verknüpft sie mit dem Application Layer (CQRS Handlers).
 *
 * **Architektur (Hexagonal Architecture):**
 * - Infrastructure Layer (Module) → Application Layer (UserManagementApplicationModule)
 * - Controllers nutzen Command/Query Handlers via Dependency Injection
 * - AuthModule für Guards (JwtAuthGuard, AdminJwtAuthGuard) und CurrentUser Decorator
 *
 * **Controller:**
 * - UserController: Öffentliche User-Endpunkte (/users)
 *   - GET /users - Basis-Benutzerinformationen (id + username)
 *   - GET /users/:id - Vollständige Benutzerinformationen
 *   - Benötigt: JwtAuthGuard (normaler User)
 *
 * - UserManagementController: Admin-Endpunkte (/admin/users)
 *   - GET /admin/users - Alle Benutzer auflisten
 *   - POST /admin/users - Benutzer erstellen
 *   - PATCH /admin/users/:id - Benutzer aktualisieren
 *   - DELETE /admin/users/:id - Benutzer löschen/herabstufen
 *   - PUT /admin/users/:id/lock - Benutzer sperren
 *   - PUT /admin/users/:id/unlock - Benutzer entsperren
 *   - Benötigt: AdminJwtAuthGuard (SUPER_ADMIN)
 *
 * **CQRS Handlers (aus UserManagementApplicationModule):**
 * - Commands: CreateUser, UpdateUser, DeleteUser, LockUser, UnlockUser
 * - Queries: GetAllUsers, GetUserById
 *
 * **Guards (aus AuthModule):**
 * - JwtAuthGuard: Validiert Access Token aus HTTP-Only Cookie
 * - AdminJwtAuthGuard: Validiert Admin Access Token + prüft SUPER_ADMIN Role
 *
 * @example
 * ```typescript
 * // In app.module.ts:
 * @Module({
 *   imports: [
 *     UserManagementModule, // Registriert /users und /admin/users Endpoints
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  imports: [
    // Application Layer mit CQRS Handlers
    UserManagementApplicationModule,
    // Auth Module für Guards und CurrentUser Decorator
    AuthModule,
  ],
  controllers: [
    // Public User Endpoints (/users)
    UserController,
    // Admin User Management Endpoints (/admin/users)
    UserManagementController,
  ],
})
export class UserManagementModule {}
