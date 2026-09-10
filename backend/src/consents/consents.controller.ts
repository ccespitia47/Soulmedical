import {
  Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { ConsentsService } from './consents.service';
import { CreateConsentDto } from './dto/create-consent.dto';
import { UpdateConsentDto } from './dto/update-consent.dto';

interface AuthRequest { user?: { id: number } }

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(Permission.CONSIENTIFY_ACCESS)
@Controller('consents')
export class ConsentsController {
  constructor(private readonly service: ConsentsService) {}

  @Post()
  create(@Body() dto: CreateConsentDto, @Request() req: AuthRequest) {
    return this.service.create(dto, req.user?.id ?? null);
  }

  @Get()
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('tipo') tipo?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.list({
      page: parseInt(page, 10), limit: parseInt(limit, 10), tipo, search, from, to,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateConsentDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.update(id, dto, req.user?.id ?? null);
  }

  @Post(':id/anular')
  anular(@Param('id') id: string) {
    return this.service.anular(id);
  }

  @Get(':id/verificar')
  verificar(@Param('id') id: string) {
    return this.service.verificar(id);
  }
}
