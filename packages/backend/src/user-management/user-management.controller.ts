import { AdminJwtAuthGuard } from '@/auth/guards/admin-jwt-auth.guard';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { LockUserDto } from './dto/lock-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DeleteUserResponse, UserResponse, UsersListResponse } from './dto/user-management-response.dto';
import { toDeleteUserResponseDto } from './mappers/user-management.mapper';
import { UserManagementService } from './user-management.service';

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
  constructor(private readonly userManagementService: UserManagementService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Benutzer auflisten' })
  @ApiOkResponse({
    type: UsersListResponse,
    description: 'Liste aller Benutzer',
  })
  async findAll() {
    return await this.userManagementService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Neuen Benutzer erstellen' })
  @ApiBody({
    type: CreateUserDto,
    description: 'Daten für den neuen Benutzer',
  })
  @ApiCreatedResponse({
    type: UserResponse,
    description: 'Benutzer erfolgreich erstellt',
  })
  @ApiResponse({ status: 400, description: 'Ungültige Eingabedaten' })
  @ApiResponse({ status: 409, description: 'Benutzername bereits vergeben' })
  async create(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto: CreateUserDto,
  ) {
    return await this.userManagementService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Benutzer aktualisieren' })
  @ApiBody({
    type: UpdateUserDto,
    description: 'Zu aktualisierende Benutzerdaten',
  })
  @ApiOkResponse({
    type: UserResponse,
    description: 'Benutzer erfolgreich aktualisiert',
  })
  @ApiResponse({ status: 400, description: 'Ungültige Eingabedaten' })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  @ApiResponse({ status: 409, description: 'Benutzername bereits vergeben' })
  async update(
    @Param('id', ParseCuidPipe) id: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto: UpdateUserDto,
  ) {
    return await this.userManagementService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Benutzer löschen oder herabstufen' })
  @ApiBody({
    type: DeleteUserDto,
    description: 'Lösch-Optionen (optional)',
    required: false,
  })
  @ApiOkResponse({
    type: DeleteUserResponse,
    description: 'Benutzer erfolgreich gelöscht oder herabgestuft',
  })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  @ApiResponse({
    status: 400,
    description: 'Letzter SUPER_ADMIN kann nicht gelöscht werden',
  })
  async remove(
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
    await this.userManagementService.remove(id, dto?.downgradeAdmin);
    return toDeleteUserResponseDto(id);
  }

  @Put(':id/lock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Benutzer manuell sperren' })
  @ApiBody({
    type: LockUserDto,
    description: 'Sperrgrund (optional)',
    required: false,
  })
  @ApiOkResponse({
    type: UserResponse,
    description: 'Benutzer erfolgreich gesperrt',
  })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  @ApiResponse({
    status: 400,
    description: 'Benutzer ist bereits gesperrt oder letzter SUPER_ADMIN kann nicht gesperrt werden',
  })
  async lock(
    @Param('id', ParseCuidPipe) id: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto?: LockUserDto,
  ) {
    // TODO: Get current admin ID from JWT
    return await this.userManagementService.lock(id, dto?.reason);
  }

  @Put(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Benutzer entsperren' })
  @ApiOkResponse({
    type: UserResponse,
    description: 'Benutzer erfolgreich entsperrt',
  })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  @ApiResponse({
    status: 400,
    description: 'Benutzer ist nicht gesperrt',
  })
  async unlock(@Param('id', new ParseCuidPipe()) id: string) {
    return await this.userManagementService.unlock(id);
  }
}
