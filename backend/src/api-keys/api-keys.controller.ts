import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

interface AuthRequest { user: { id: number; role: string } }

@UseGuards(JwtAuthGuard)
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
