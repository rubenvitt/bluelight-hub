import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiWrappedResponse } from '@/modules/common/decorators/api-wrapped-response.decorator';
import { GetErinnerungKonfigurationQuery } from '@/application/erinnerung-konfiguration/queries/get-erinnerung-konfiguration.query';
import { UpdateEskalationsTimeoutCommand } from '@/application/erinnerung-konfiguration/commands/update-eskalations-timeout.command';
import { ErinnerungKonfigurationDto } from './dtos/erinnerung-konfiguration.dto';
import { UpdateEskalationsTimeoutDto } from './dtos/update-eskalations-timeout.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { User, UserRole } from '@/generated/prisma/client';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { Result } from '@/domain/common/result';

@ApiTags('Erinnerung')
@Controller({
  path: 'erinnerung/config',
  version: 'alpha',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class ErinnerungKonfigurationController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Ruft die globale Erinnerungs-Konfiguration ab' })
  @ApiWrappedResponse(ErinnerungKonfigurationDto)
  async getConfig(): Promise<ErinnerungKonfigurationDto> {
    const config = await this.queryBus.execute(new GetErinnerungKonfigurationQuery());
    return {
      eskalationsTimeoutSeconds: config.eskalationsTimeout.seconds,
      eskalationsTimeoutMinutes: config.eskalationsTimeout.value,
    };
  }

  @Put('timeout')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Aktualisiert den Eskalations-Timeout' })
  @ApiWrappedResponse(ErinnerungKonfigurationDto) // Returns updated config implicitly or void? Command returns Result<void>.
  // Usually PUT returns the resource or 204. Let's return the simplified void/success wrapper or the new config.
  // Plan said: PUT /timeout.
  async updateTimeout(@Body() dto: UpdateEskalationsTimeoutDto, @CurrentUser() user: User): Promise<void> {
    const result: Result<void> = await this.commandBus.execute(new UpdateEskalationsTimeoutCommand(dto.timeoutMinutes, user.id));

    if (result.isFailure) {
      throw new Error(result.error as string); // Or use specific Exception mapping
    }
  }
}
