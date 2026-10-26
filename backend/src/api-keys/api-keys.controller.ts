import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

interface AuthRequest { user: { id: number; role: string } }

// Solo admins pueden gestionar API keys. Las keys emitidas se usan en el MCP y
// otras integraciones (Power BI); dar visibilidad/revocación a usuarios normales
// permitiría escalada de privilegios inadvertida.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  create(@Body() dto: CreateApiKeyDto, @Request() req: AuthRequest) {
    return this.apiKeysService.create(dto, req.user.id);
  }

  @Get()
  findAll() {
    return this.apiKeysService.findAll();
  }

  @Delete(':id')
  revoke(@Param('id') id: string) {
    return this.apiKeysService.revoke(id);
  }
}
