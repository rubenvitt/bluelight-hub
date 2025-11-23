import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { ApiWrappedResponse } from '@/common/decorators/api-wrapped-response.decorator';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserBasicDto, UserBasicListResponse } from './dto/user-basic-response.dto';
import { UserDto, UserResponse } from './dto/user-management-response.dto';
import { UserManagementService } from './user-management.service';

@ApiTags('users')
@ApiBearerAuth('jwt')
@Controller({
  path: 'users',
  version: 'alpha',
})
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Benutzerinformationen abrufen' })
  @ApiWrappedResponse(UserResponse, { description: 'Benutzerinformationen' })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  async findOne(@Param('id', ParseCuidPipe) id: string): Promise<UserDto> {
    return await this.userManagementService.findOne(id);
  }

  @Get()
  @ApiOperation({ summary: 'Basis-Benutzerinformationen aller Benutzer' })
  @ApiOkResponse({
    type: UserBasicListResponse,
    description: 'Liste von Benutzer-IDs und Namen für UI-Anzeige',
  })
  async findAllBasic(): Promise<UserBasicDto[]> {
    const users = await this.userManagementService.findAll();
    return users.map((user) => ({
      id: user.id,
      username: user.username,
    }));
  }
}
