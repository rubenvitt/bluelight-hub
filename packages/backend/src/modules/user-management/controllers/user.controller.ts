import { BadRequestException, Controller, Get, InternalServerErrorException, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { ApiWrappedResponse } from '@/modules/common/decorators/api-wrapped-response.decorator';
import { ParseCuidPipe } from '@/infrastructure/http/pipes/parse-cuid.pipe';
import {
  GetAllUsersQuery,
  GetAllUsersQueryHandler,
  GetUserByIdQuery,
  GetUserByIdQueryHandler,
  type UserDto as AppUserDto,
  UserBasicDto,
  UserBasicListResponse,
  ManagedUserResponseDto,
  ManagedUserResponse,
} from '@application/user-management';
import { UserRole as PrismaUserRole } from '@prisma/client';

/**
 * Mappt Application Layer UserDto auf API ManagedUserResponseDto.
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
 * User Controller für öffentliche Benutzer-Endpunkte.
 *
 * Dieser Controller stellt Endpunkte für das Abrufen von Benutzerinformationen bereit.
 * Nutzt CQRS Query Handlers für Read-Only Operationen.
 *
 * **Architektur:**
 * - Controller (Infrastructure Layer) → Query Handler (Application Layer) → Repository (Infrastructure)
 * - Result Pattern für explizite Fehlerbehandlung
 * - Domain Aggregate → DTO Mapping im Handler
 *
 * **Authentifizierung:**
 * - Alle Endpoints benötigen gültigen JWT (JwtAuthGuard)
 * - Access Token aus HTTP-Only Cookie
 *
 * @endpoint /users (version: alpha)
 */
@ApiTags('users')
@ApiBearerAuth('jwt')
@Controller({
  path: 'users',
  version: 'alpha',
})
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly getAllUsersHandler: GetAllUsersQueryHandler,
    private readonly getUserByIdHandler: GetUserByIdQueryHandler,
  ) {}

  /**
   * Basis-Benutzerinformationen aller Benutzer abrufen.
   *
   * Gibt eine vereinfachte Liste aller Benutzer zurück (id + username).
   * Verwendet für UI-Auswahllisten (z.B. ETB-Ersteller Dropdown).
   *
   * **Query Handler:**
   * - GetAllUsersQueryHandler lädt alle User Aggregates
   * - Filtert gelöschte/gesperrte User im Handler
   * - Mappt zu UserDto, Controller extrahiert nur id + username
   *
   * **Fehlerbehandlung:**
   * - Repository-Fehler → InternalServerErrorException
   * - Leeres Array ist valides Resultat (keine 404)
   *
   * @returns UserBasicDto[] - Liste von User-IDs und Namen
   */
  @Get()
  @ApiOperation({ summary: 'Basis-Benutzerinformationen aller Benutzer' })
  @ApiOkResponse({
    type: UserBasicListResponse,
    description: 'Liste von Benutzer-IDs und Namen für UI-Anzeige',
  })
  async findAllBasic(): Promise<UserBasicDto[]> {
    // Execute Query (keine Parameter)
    const result = await this.getAllUsersHandler.execute(new GetAllUsersQuery());

    // Result Pattern Fehlerbehandlung
    if (result.isFailure) {
      throw new InternalServerErrorException(result.error ?? 'Failed to fetch users');
    }

    // Type Narrowing: value ist garantiert vorhanden wenn isFailure === false
    const users = result.value;
    if (!users) {
      return [];
    }

    // Map UserDto zu UserBasicDto (nur id + username)
    return users.map((user) => ({
      id: user.id,
      username: user.username,
    }));
  }

  /**
   * Benutzerinformationen für einen spezifischen User abrufen.
   *
   * Gibt detaillierte Informationen zu einem Benutzer zurück
   * (id, username, role, createdAt, updatedAt, isLocked, lockReason).
   *
   * **Query Handler:**
   * - GetUserByIdQueryHandler validiert userId via UserId Value Object
   * - Lädt User Aggregate aus Repository
   * - Mappt zu UserDto oder gibt null zurück wenn nicht gefunden
   *
   * **Fehlerbehandlung:**
   * - Ungültige userId → BadRequestException (400)
   * - User nicht gefunden → NotFoundException (404)
   * - Repository-Fehler → InternalServerErrorException (500)
   *
   * @param id - User-ID (CUID format, validiert durch ParseCuidPipe)
   * @returns ManagedUserResponseDto - Vollständige Benutzerinformationen
   */
  @Get(':id')
  @ApiOperation({ summary: 'Benutzerinformationen abrufen' })
  @ApiWrappedResponse(ManagedUserResponse, { description: 'Benutzerinformationen' })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  async findOne(@Param('id', ParseCuidPipe) id: string): Promise<ManagedUserResponseDto> {
    // Execute Query mit userId
    const result = await this.getUserByIdHandler.execute(new GetUserByIdQuery(id));

    // Result Pattern Fehlerbehandlung
    if (result.isFailure) {
      // Business Rule Fehler (z.B. ungültige userId) → BadRequest
      throw new BadRequestException(result.error ?? 'Invalid user ID');
    }

    // User nicht gefunden (null ist valides Result, aber 404 für API)
    if (result.value === null || result.value === undefined) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return mapToApiUserDto(result.value);
  }
}
