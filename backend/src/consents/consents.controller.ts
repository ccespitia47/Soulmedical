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

interface AuthRequest { user?: { id: string } }

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(Permission.CONSIENTIFY_ACCESS)
@Controller('consents')
export class ConsentsController {
  constructor(private readonly service: ConsentsService) {}

  @Post()
  create(@Body() dto: CreateConsentDto, @Request() req: AuthRequest) {
    const userId = req.user?.id != null ? Number(req.user.id) : null;
    return this.service.create(dto, userId);
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
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
    return this.service.list({
      page: pageNum, limit: limitNum, tipo, search, from, to,
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
    const userId = req.user?.id != null ? Number(req.user.id) : null;
    return this.service.update(id, dto, userId);
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
