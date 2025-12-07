import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '@/modules/auth/guards/admin-jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import type { ValidatedUser } from '@/modules/auth/strategies/jwt.strategy';
import { ParseCuidPipe } from '@/infrastructure/http/pipes/parse-cuid.pipe';
import {
  CreateUserCommand,
  CreateUserHandler,
  UpdateUserCommand,
  UpdateUserHandler,
  DeleteUserCommand,
  DeleteUserHandler,
  LockUserCommand,
  LockUserHandler,
  UnlockUserCommand,
  UnlockUserHandler,
  GetAllUsersQuery,
  GetAllUsersQueryHandler,
  GetUserByIdQuery,
  GetUserByIdQueryHandler,
  CreateUserDto,
  UpdateUserDto,
  DeleteUserDto,
  LockUserDto,
  ManagedUserResponseDto,
  ManagedUsersListResponse,
  ManagedUserResponse,
  DeleteManagedUserResponse,
  toDeleteUserResponseDto,
} from '@application/user-management';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { UserRole as DomainUserRole } from '@domain/value-objects/user-role';
import type { UserDto as AppUserDto } from '@application/user-management';

/**
 * Mappt Application Layer UserDto auf API ManagedUserResponseDto.
 *
 * Application Layer: role ist string (von Value Object via .toString())
 * API Layer: role ist Prisma UserRole enum
 *
 * @param appDto - Application Layer UserDto
 * @returns API ManagedUserResponseDto mit korrektem Prisma enum
 */
function mapToApiUserDto(appDto: AppUserDto): ManagedUserResponseDto {
  return {
    id: appDto.id,
    username: appDto.username,
    role: appDto.role as PrismaUserRole,
    createdAt: appDto.createdAt,
    updatedAt: appDto.updatedAt,
    isLocked: appDto.isLocked,
    lockReason: appDto.lockReason,
  };
}

/**
 * User Management Controller für Admin-Benutzer-Verwaltung.
 *
 * Dieser Controller stellt Admin-Endpunkte für CRUD-Operationen auf Benutzern bereit.
 * Nutzt CQRS Command- und Query-Handlers für State-Änderung und Read-Only Operationen.
 *
 * **Architektur:**
 * - Controller (Infrastructure Layer) → Command/Query Handler (Application Layer) → Repository (Infrastructure)
 * - Result Pattern für explizite Fehlerbehandlung
 * - Domain Aggregate → DTO Mapping im Handler
 *
 * **Authentifizierung:**
 * - Alle Endpoints benötigen Admin-JWT (AdminJwtAuthGuard)
 * - Nur SUPER_ADMIN darf User erstellen, aktualisieren, löschen, sperren
 * - CurrentUser Decorator extrahiert authentifizierten Admin aus JWT
 *
 * **Audit Trail:**
 * - Alle Mutations-Commands erhalten userId des ausführenden Admins
 * - createdBy, updatedBy, deletedBy, lockedBy, unlockedBy werden gesetzt
 *
 * @endpoint /admin/users (version: alpha)
 */
@ApiTags('user-management')
@ApiBearerAuth('admin-jwt')
@ApiUnauthorizedResponse({
  description: 'Keine gültige Admin-Authentifizierung',
})
@Controller({
  path: 'admin/users',
  version: 'alpha',
})
@UseGuards(AdminJwtAuthGuard)
export class UserManagementController {
  constructor(
    private readonly createUserHandler: CreateUserHandler,
    private readonly updateUserHandler: UpdateUserHandler,
    private readonly deleteUserHandler: DeleteUserHandler,
    private readonly lockUserHandler: LockUserHandler,
    private readonly unlockUserHandler: UnlockUserHandler,
    private readonly getAllUsersHandler: GetAllUsersQueryHandler,
    private readonly getUserByIdHandler: GetUserByIdQueryHandler,
  ) {}

  /**
   * Alle Benutzer auflisten.
   *
   * Gibt eine vollständige Liste aller Benutzer mit allen Details zurück.
   * Admin-Endpoint für User-Management UI.
   *
   * **Query Handler:**
   * - GetAllUsersQueryHandler lädt alle User Aggregates
   * - Filtert gelöschte/gesperrte User im Handler
   * - Mappt zu UserDto mit allen Feldern
   *
   * **Fehlerbehandlung:**
   * - Repository-Fehler → InternalServerErrorException
   * - Leeres Array ist valides Resultat
   *
   * @returns ManagedUserResponseDto[] - Liste aller Benutzer mit vollständigen Details
   */
  @Get()
  @ApiOperation({ summary: 'Alle Benutzer auflisten' })
  @ApiOkResponse({
    type: ManagedUsersListResponse,
    description: 'Liste aller Benutzer',
  })
  async findAll(): Promise<ManagedUserResponseDto[]> {
    const result = await this.getAllUsersHandler.execute(new GetAllUsersQuery());

    if (result.isFailure) {
      throw new InternalServerErrorException(result.error ?? 'Failed to fetch users');
    }

    const users = result.value ?? [];
    return users.map(mapToApiUserDto);
  }

  /**
   * Neuen Benutzer erstellen.
   *
   * Erstellt einen neuen User mit optionaler Rollenzuweisung.
   * Der ausführende Admin wird als createdBy im Audit Trail gespeichert.
   *
   * **Command Handler:**
   * - CreateUserHandler validiert username (unique constraint)
   * - Erstellt User Aggregate mit Value Objects
   * - Speichert in Repository via Transactional Outbox Pattern
   * - Erster User im System wird automatisch SUPER_ADMIN
   *
   * **Business Rules:**
   * - Username muss unique sein (409 Conflict)
   * - Bei gleichem Username eines gelöschten Users: Reaktivierung
   * - Role optional (default: USER)
   *
   * **Fehlerbehandlung:**
   * - Ungültige Eingabedaten → BadRequestException (400)
   * - Username bereits vergeben → BadRequestException (409-ähnlich)
   * - Repository-Fehler → InternalServerErrorException (500)
   *
   * @param user - Authentifizierter Admin aus JWT (CurrentUser Decorator)
   * @param dto - CreateUserDto (username, optional role)
   * @returns ManagedUserResponseDto - Erstellter Benutzer mit allen Details
   */
  @Post()
  @ApiOperation({ summary: 'Neuen Benutzer erstellen' })
  @ApiBody({
    type: CreateUserDto,
    description: 'Daten für den neuen Benutzer',
  })
  @ApiCreatedResponse({
    type: ManagedUserResponse,
    description: 'Benutzer erfolgreich erstellt',
  })
  @ApiResponse({ status: 400, description: 'Ungültige Eingabedaten' })
  @ApiResponse({ status: 409, description: 'Benutzername bereits vergeben' })
  async create(
    @CurrentUser() user: ValidatedUser,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto: CreateUserDto,
  ): Promise<ManagedUserResponseDto> {
    // Convert DTO role to Domain UserRole Value Object (optional)
    let userRole: DomainUserRole | undefined;
    if (dto.role) {
      const roleResult = DomainUserRole.create(dto.role);
      if (roleResult.isFailure) {
        throw new BadRequestException(roleResult.error ?? 'Invalid role');
      }
      userRole = roleResult.value ?? undefined;
    }

    // Create Command mit Audit Trail (createdBy)
    const commandResult = CreateUserCommand.create(dto.username, user.userId, userRole);
    if (commandResult.isFailure) {
      throw new BadRequestException(commandResult.error ?? 'Invalid command data');
    }

    const command = commandResult.value;
    if (!command) {
      throw new BadRequestException('Failed to create command');
    }

    // Execute Command
    const result = await this.createUserHandler.execute(command);
    if (result.isFailure) {
      throw new BadRequestException(result.error ?? 'Failed to create user');
    }

    // Handler gibt User-ID zurück - User neu laden für Response
    const userId = result.value;
    if (!userId) {
      throw new InternalServerErrorException('User created but no ID returned');
    }

    const userResult = await this.getUserByIdHandler.execute(new GetUserByIdQuery(userId));
    if (userResult.isFailure || !userResult.value) {
      throw new NotFoundException('User created but could not be loaded');
    }

    return mapToApiUserDto(userResult.value);
  }

  /**
   * Benutzer aktualisieren.
   *
   * Aktualisiert username und/oder role eines existierenden Users.
   * Der ausführende Admin wird als updatedBy im Audit Trail gespeichert.
   *
   * **Command Handler:**
   * - UpdateUserHandler validiert User existiert
   * - Prüft username unique constraint (wenn geändert)
   * - Aktualisiert User Aggregate
   * - Speichert in Repository via Transactional Outbox Pattern
   *
   * **Business Rules:**
   * - User muss existieren (404 Not Found)
   * - Username muss unique sein wenn geändert (409)
   * - Alle Felder optional (nur übergebene werden aktualisiert)
   *
   * **Fehlerbehandlung:**
   * - Ungültige Eingabedaten → BadRequestException (400)
   * - User nicht gefunden → NotFoundException (404)
   * - Username bereits vergeben → BadRequestException (409-ähnlich)
   *
   * @param user - Authentifizierter Admin aus JWT
   * @param id - User-ID (CUID format)
   * @param dto - UpdateUserDto (optional username, optional role)
   * @returns ManagedUserResponseDto - Aktualisierter Benutzer
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Benutzer aktualisieren' })
  @ApiBody({
    type: UpdateUserDto,
    description: 'Zu aktualisierende Benutzerdaten',
  })
  @ApiOkResponse({
    type: ManagedUserResponse,
    description: 'Benutzer erfolgreich aktualisiert',
  })
  @ApiResponse({ status: 400, description: 'Ungültige Eingabedaten' })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  @ApiResponse({ status: 409, description: 'Benutzername bereits vergeben' })
  async update(
    @CurrentUser() currentUser: ValidatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto: UpdateUserDto,
  ): Promise<ManagedUserResponseDto> {
    // UpdateUserCommand erwartet Prisma UserRole enum direkt (nicht Domain Value Object)
    // DTO role ist bereits vom Typ PrismaUserRole durch class-validator
    const userRole: PrismaUserRole | undefined = dto.role;

    // Create Command mit Audit Trail (updatedBy)
    const commandResult = UpdateUserCommand.create(id, currentUser.userId, dto.username, userRole);
    if (commandResult.isFailure) {
      throw new BadRequestException(commandResult.error ?? 'Invalid command data');
    }

    const command = commandResult.value;
    if (!command) {
      throw new BadRequestException('Failed to create command');
    }

    // Execute Command
    const result = await this.updateUserHandler.execute(command);
    if (result.isFailure) {
      // "User not found" ist Business Rule Fehler → 404
      if (result.error?.includes('not found') || result.error?.includes('nicht gefunden')) {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error ?? 'Failed to update user');
    }

    // Handler gibt void zurück - User neu laden für Response
    const userResult = await this.getUserByIdHandler.execute(new GetUserByIdQuery(id));
    if (userResult.isFailure || !userResult.value) {
      throw new NotFoundException('User updated but could not be loaded');
    }

    return mapToApiUserDto(userResult.value);
  }

  /**
   * Benutzer löschen oder herabstufen.
   *
   * Führt Soft Delete durch (isDeleted=true) oder stuft Admin zu USER herab.
   * Der ausführende Admin wird als deletedBy im Audit Trail gespeichert.
   *
   * **Command Handler:**
   * - DeleteUserHandler validiert User existiert
   * - Prüft SUPER_ADMIN Constraint (letzter SUPER_ADMIN geschützt)
   * - Soft Delete: setzt isDeleted=true, deletedAt, deletedBy
   * - Downgrade: ändert Role zu USER (nur wenn downgradeAdmin=true)
   *
   * **Business Rules:**
   * - User muss existieren (404)
   * - Letzter SUPER_ADMIN kann NICHT gelöscht werden (403)
   * - Soft Delete erhält Datenintegrität (ETB createdBy FK)
   *
   * **Fehlerbehandlung:**
   * - User nicht gefunden → NotFoundException (404)
   * - Letzter SUPER_ADMIN → ForbiddenException (403)
   *
   * @param user - Authentifizierter Admin aus JWT
   * @param id - User-ID (CUID format)
   * @param dto - DeleteUserDto (optional downgradeAdmin flag)
   * @returns DeleteUserResponseDto - Bestätigung mit ID und deleted=true
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Benutzer löschen oder herabstufen' })
  @ApiBody({
    type: DeleteUserDto,
    description: 'Lösch-Optionen (optional)',
    required: false,
  })
  @ApiOkResponse({
    type: DeleteManagedUserResponse,
    description: 'Benutzer erfolgreich gelöscht oder herabgestuft',
  })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  @ApiResponse({
    status: 400,
    description: 'Letzter SUPER_ADMIN kann nicht gelöscht werden',
  })
  async remove(
    @CurrentUser() currentUser: ValidatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto?: DeleteUserDto,
  ) {
    // Create Command mit Audit Trail (deletedBy)
    const commandResult = DeleteUserCommand.create({
      id,
      deletedBy: currentUser.userId,
      downgradeAdmin: dto?.downgradeAdmin,
    });
    if (commandResult.isFailure) {
      throw new BadRequestException(commandResult.error ?? 'Invalid command data');
    }

    const command = commandResult.value;
    if (!command) {
      throw new BadRequestException('Failed to create command');
    }

    // Execute Command
    const result = await this.deleteUserHandler.execute(command);
    if (result.isFailure) {
      // "User not found" → 404
      if (result.error?.includes('not found') || result.error?.includes('nicht gefunden')) {
        throw new NotFoundException(result.error);
      }
      // "last SUPER_ADMIN" → 403
      if (result.error?.includes('SUPER_ADMIN') || result.error?.includes('letzter')) {
        throw new ForbiddenException(result.error);
      }
      throw new BadRequestException(result.error ?? 'Failed to delete user');
    }

    return toDeleteUserResponseDto(id);
  }

  /**
   * Benutzer manuell sperren.
   *
   * Setzt isLocked=true mit optionalem Sperrgrund.
   * Der ausführende Admin wird als lockedBy im Audit Trail gespeichert.
   *
   * **Command Handler:**
   * - LockUserHandler validiert User existiert und ist nicht gesperrt
   * - Prüft SUPER_ADMIN Constraint (letzter SUPER_ADMIN geschützt)
   * - Setzt isLocked=true, lockReason, lockedAt, lockedBy
   *
   * **Business Rules:**
   * - User muss existieren (404)
   * - User darf nicht bereits gesperrt sein (400)
   * - Letzter SUPER_ADMIN kann NICHT gesperrt werden (403)
   *
   * **Fehlerbehandlung:**
   * - User nicht gefunden → NotFoundException (404)
   * - Bereits gesperrt → BadRequestException (400)
   * - Letzter SUPER_ADMIN → ForbiddenException (403)
   *
   * @param user - Authentifizierter Admin aus JWT
   * @param id - User-ID (CUID format)
   * @param dto - LockUserDto (optional reason)
   * @returns ManagedUserResponseDto - Gesperrter Benutzer mit isLocked=true
   */
  @Put(':id/lock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Benutzer manuell sperren' })
  @ApiBody({
    type: LockUserDto,
    description: 'Sperrgrund (optional)',
    required: false,
  })
  @ApiOkResponse({
    type: ManagedUserResponse,
    description: 'Benutzer erfolgreich gesperrt',
  })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  @ApiResponse({
    status: 400,
    description: 'Benutzer ist bereits gesperrt oder letzter SUPER_ADMIN kann nicht gesperrt werden',
  })
  async lock(
    @CurrentUser() currentUser: ValidatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto?: LockUserDto,
  ): Promise<ManagedUserResponseDto> {
    // Create Command mit Audit Trail (lockedBy)
    const commandResult = LockUserCommand.create({
      id,
      lockedBy: currentUser.userId,
      reason: dto?.reason,
    });
    if (commandResult.isFailure) {
      throw new BadRequestException(commandResult.error ?? 'Invalid command data');
    }

    const command = commandResult.value;
    if (!command) {
      throw new BadRequestException('Failed to create command');
    }

    // Execute Command
    const result = await this.lockUserHandler.execute(command);
    if (result.isFailure) {
      // "User not found" → 404
      if (result.error?.includes('not found') || result.error?.includes('nicht gefunden')) {
        throw new NotFoundException(result.error);
      }
      // "last SUPER_ADMIN" → 403
      if (result.error?.includes('SUPER_ADMIN') || result.error?.includes('letzter')) {
        throw new ForbiddenException(result.error);
      }
      throw new BadRequestException(result.error ?? 'Failed to lock user');
    }

    // Handler gibt void zurück - User neu laden für Response
    const userResult = await this.getUserByIdHandler.execute(new GetUserByIdQuery(id));
    if (userResult.isFailure || !userResult.value) {
      throw new NotFoundException('User locked but could not be loaded');
    }

    return mapToApiUserDto(userResult.value);
  }

  /**
   * Benutzer entsperren.
   *
   * Entfernt Sperre (isLocked=false, lockReason=null).
   * Der ausführende Admin wird als unlockedBy im Audit Trail gespeichert.
   *
   * **Command Handler:**
   * - UnlockUserHandler validiert User existiert und ist gesperrt
   * - Setzt isLocked=false, lockReason=null, unlockedAt, unlockedBy
   *
   * **Business Rules:**
   * - User muss existieren (404)
   * - User muss gesperrt sein (400)
   *
   * **Fehlerbehandlung:**
   * - User nicht gefunden → NotFoundException (404)
   * - Nicht gesperrt → BadRequestException (400)
   *
   * @param user - Authentifizierter Admin aus JWT
   * @param id - User-ID (CUID format)
   * @returns ManagedUserResponseDto - Entsperrter Benutzer mit isLocked=false
   */
  @Put(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Benutzer entsperren' })
  @ApiOkResponse({
    type: ManagedUserResponse,
    description: 'Benutzer erfolgreich entsperrt',
  })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  @ApiResponse({
    status: 400,
    description: 'Benutzer ist nicht gesperrt',
  })
  async unlock(@CurrentUser() currentUser: ValidatedUser, @Param('id', new ParseCuidPipe()) id: string): Promise<ManagedUserResponseDto> {
    // Create Command mit Audit Trail (unlockedBy)
    const commandResult = UnlockUserCommand.create({
      id,
      unlockedBy: currentUser.userId,
    });
    if (commandResult.isFailure) {
      throw new BadRequestException(commandResult.error ?? 'Invalid command data');
    }

    const command = commandResult.value;
    if (!command) {
      throw new BadRequestException('Failed to create command');
    }

    // Execute Command
    const result = await this.unlockUserHandler.execute(command);
    if (result.isFailure) {
      // "User not found" → 404
      if (result.error?.includes('not found') || result.error?.includes('nicht gefunden')) {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error ?? 'Failed to unlock user');
    }

    // Handler gibt void zurück - User neu laden für Response
    const userResult = await this.getUserByIdHandler.execute(new GetUserByIdQuery(id));
    if (userResult.isFailure || !userResult.value) {
      throw new NotFoundException('User unlocked but could not be loaded');
    }

    return mapToApiUserDto(userResult.value);
  }
}
