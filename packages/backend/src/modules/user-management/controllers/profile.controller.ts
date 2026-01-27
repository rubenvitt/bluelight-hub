import { Body, Controller, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import type { ValidatedUser } from '@/modules/auth/strategies/jwt.strategy';
import { UpdateProfileDto } from '@/modules/user-management/dtos/update-profile.dto';
import { ApiWrappedResponse } from '@/modules/common/decorators/api-wrapped-response.decorator';
import { UpdateProfileHandler } from '@application/user-management/commands/update-profile/update-profile.handler';
import { UpdateProfileCommand } from '@application/user-management/commands/update-profile/update-profile.command';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

// Dummy DTO for response (void) or UserDto?
// For now void / success message.
class ProfileUpdatedResponseDto {
  // Empty for now or specific message
}

@ApiTags('users')
@ApiBearerAuth('access-token') // Assuming default bearer auth name
@Controller({
  path: 'users/profile',
  version: '1',
})
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly updateProfileHandler: UpdateProfileHandler) {}

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eigenes Profil aktualisieren (z.B. Eskalationsperson)' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiWrappedResponse(ProfileUpdatedResponseDto, { description: 'Profil erfolgreich aktualisiert' })
  @ApiUnauthorizedResponse({ description: 'Nicht authentifiziert' })
  async updateProfile(@CurrentUser() user: ValidatedUser, @Body() dto: UpdateProfileDto): Promise<void> {
    const commandResult = UpdateProfileCommand.create(user.userId, dto.defaultEscalationTargetId);
    if (commandResult.isFailure) {
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.updateProfileHandler.execute(commandResult.value!);
    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }
  }
}
