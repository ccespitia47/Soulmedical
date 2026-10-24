import {
  BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { AdminActionTargetType, AdminActionType } from '../admin-audit/admin-action.entity';
import { ConsentsService } from './consents.service';
import { CreateConsentDto } from './dto/create-consent.dto';
import { UpdateConsentDto } from './dto/update-consent.dto';

interface AuthRequest { user?: { id: string; name?: string; email?: string; role?: string } }

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(Permission.CONSIENTIFY_ACCESS)
@Controller('consents')
export class ConsentsController {
  constructor(
    private readonly service: ConsentsService,
    private readonly audit: AdminAuditService,
  ) {}

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

  @Get('paciente')
  async paciente(
    @Query('numDoc') numDoc: unknown,
    @Query('entidad') entidad: unknown,
    @Request() req: AuthRequest,
  ) {
    if (typeof numDoc !== 'string' || !numDoc.trim()) {
      throw new BadRequestException('numDoc es obligatorio y debe ser texto');
    }
    const doc = numDoc.trim();
    // Ausente o vacío = sin entidad (null). Presente: debe ser exactamente SAI o SOUL.
    let ent: 'SAI' | 'SOUL' | null = null;
    if (entidad !== undefined && entidad !== '') {
      if (entidad !== 'SAI' && entidad !== 'SOUL') {
        throw new BadRequestException('entidad debe ser SAI o SOUL');
      }
      ent = entidad;
    }
    const result = await this.service.lookupPaciente(doc, ent);
    await this.audit.log({
      actor: {
        id: Number(req.user?.id),
        name: req.user?.name ?? req.user?.email ?? `user#${req.user?.id}`,
        role: req.user?.role ?? '',
      },
      action: AdminActionType.CONSENT_PATIENT_LOOKUP,
      targetType: AdminActionTargetType.CONSENT_PATIENT,
      targetId: doc.slice(0, 64),
      metadata: { entidad: ent, encontrado: result.ultimo != null, at: new Date().toISOString() },
    });
    return result;
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

  @Get(':id/pdf')
  pdf(@Param('id') id: string) {
    return this.service.pdfPayload(id);
  }
}
