import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { OutboxModule } from '@infrastructure/outbox/outbox.module';
import { UserInfrastructureModule } from '@infrastructure/user/user-infrastructure.module';
import { LOGGER } from '@infrastructure/di-tokens';
import { NestLoggerAdapter } from '@infrastructure/common/adapters/nest-logger.adapter';

// Command Handlers
import { CreateUserHandler, UpdateUserHandler, DeleteUserHandler, LockUserHandler, UnlockUserHandler, UpdateProfileHandler } from './commands';

// Query Handlers
import { GetAllUsersQueryHandler, GetUserByIdQueryHandler } from './queries';

/**
 * NestJS-Modul für Application Layer - User Management Bounded Context.
 *
 * Dieses Modul registriert alle CQRS Command- und Query-Handler für
 * User-Verwaltungsoperationen und macht sie über Dependency Injection verfügbar.
 *
 * **CQRS Pattern:**
 * - Command Handlers: State Mutation (Create, Update, Delete, Lock, Unlock)
 * - Query Handlers: State Reading (GetAllUsers, GetUserById)
 *
 * **Transactional Outbox Pattern:**
 * Command-Handler nutzen TransactionalCommandHandler als Basis für atomare
 * Persistierung von Aggregate + Domain Events in einer Transaktion.
 *
 * **Hexagonal Architecture:**
 * - Application Layer importiert Infrastructure Module für Repository DI
 * - Controller (Infrastructure) können Handler via DI nutzen
 * - Domain Layer bleibt frei von Framework-Abhängigkeiten
 *
 * **Business Rules:**
 * - DeleteUserHandler führt Soft-Delete durch (markiert User als gelöscht)
 * - LockUserHandler prüft Min-1-SUPER_ADMIN Constraint
 * - CreateUserHandler macht ersten User zum SUPER_ADMIN (Bootstrap)
 *
 * @example
 * ```typescript
 * // In Controller:
 * constructor(
 *   private readonly createHandler: CreateUserHandler,
 *   private readonly getAllHandler: GetAllUsersQueryHandler,
 * ) {}
 *
 * @Post()
 * async create(@Body() dto: CreateUserDto) {
 *   const command = new CreateUserCommand(dto.username, dto.role, userId);
 *   const result = await this.createHandler.execute(command);
 *   if (result.isFailure) throw new BadRequestException(result.error);
 *   return { id: result.value };
 * }
 * ```
 */
@Module({
  imports: [
    // Database Connection
    PrismaModule,
    // Outbox Infrastructure (IOutboxRepository) - für Transactional Outbox Pattern
    OutboxModule,
    // User Repository Infrastructure (IUserRepository via USER_REPOSITORY Symbol)
    UserInfrastructureModule,
  ],
  providers: [
    // Logger für User Management Handlers
    {
      provide: LOGGER,
      useFactory: () => new NestLoggerAdapter('UserManagement'),
    },
    // Command Handlers
    CreateUserHandler,
    UpdateUserHandler,
    DeleteUserHandler,
    LockUserHandler,
    UnlockUserHandler,
    UpdateProfileHandler,
    // Query Handlers
    GetAllUsersQueryHandler,
    GetUserByIdQueryHandler,
  ],
  exports: [
    // Export handlers for use in Infrastructure Layer (Controllers)
    // Command Handlers
    CreateUserHandler,
    UpdateUserHandler,
    DeleteUserHandler,
    LockUserHandler,
    UnlockUserHandler,
    UpdateProfileHandler,
    // Query Handlers
    GetAllUsersQueryHandler,
    GetUserByIdQueryHandler,
  ],
})
export class UserManagementApplicationModule {}
