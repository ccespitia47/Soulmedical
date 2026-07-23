import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Headers,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import {
  AdminActionTargetType,
  AdminActionType,
} from '../admin-audit/admin-action.entity';

interface AuthRequest {
  user: { id: number; email?: string; name?: string; role: string };
}

function actorFrom(req: AuthRequest) {
  return {
    id: Number(req.user.id),
    name: req.user.name ?? req.user.email ?? `user#${req.user.id}`,
    role: req.user.role,
  };
}

@Controller('forms')
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly auditService: AdminAuditService,
  ) {}

  // ── Rutas públicas (sin auth de usuario) ──────────────────────────────────

  @Get('public/:id')
  getPublicForm(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ) {
    // `auth` opcional: si el formulario requiere verificación por correo y
    // viene un token válido, se devuelve también el schema.
    return this.formsService.findPublic(id, auth);
  }

  // Anti brute force: 5 solicitudes de OTP por IP/minuto.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('public/:id/request-otp')
  requestPublicOtp(
    @Param('id') id: string,
    @Body() body: { email: string },
  ) {
    return this.formsService.requestPublicFormOtp(id, body.email);
  }

  // Verificación del código: 10/min para acomodar reintentos del usuario.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('public/:id/verify-otp')
  verifyPublicOtp(
    @Param('id') id: string,
    @Body() body: { email: string; code: string },
  ) {
    return this.formsService.verifyPublicFormOtp(id, body.email, body.code);
  }

  @Post('public/:id/submit')
  submitPublicForm(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('authorization') auth?: string,
  ) {
    return this.formsService.submitPublic(id, body, auth);
  }

  // ── Rutas protegidas (admin) ───────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.FORMS_CREATE)
  @Post()
  create(@Body() dto: CreateFormDto, @Request() req: AuthRequest) {
    return this.formsService.create(dto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findByFolder(
    @Query('folderId') folderId: string,
    @Request() req: AuthRequest,
  ) {
    return this.formsService.findByFolder(folderId, req.user.id, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Get('assigned')
  findAssigned(@Request() req: AuthRequest) {
    return this.formsService.findAssignedToUser(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.FORMS_EDIT)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFormDto) {
    return this.formsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.FORMS_DELETE)
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: AuthRequest) {
    const before = await this.formsService.findOne(id).catch(() => null);
    const result = await this.formsService.remove(id);
    await this.auditService.log({
      actor: actorFrom(req),
      action: AdminActionType.FORM_DELETE,
      targetType: AdminActionTargetType.FORM,
      targetId: id,
      targetName: before?.name ?? null,
    });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/assign')
  assignUser(@Param('id') id: string, @Body() dto: AssignUserDto) {
    return this.formsService.assignUser(id, dto.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/assign/:userId')
  unassignUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.formsService.unassignUser(id, parseInt(userId));
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/assignments')
  getAssignments(@Param('id') id: string) {
    return this.formsService.getAssignedUsers(id);
  }

  // ── Toggle acceso público ─────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Patch(':id/toggle-public')
  async togglePublic(
    @Param('id') id: string,
    @Body()
    body: {
      isPublic: boolean;
      sendConfirmationEmail?: boolean;
      requiresEmailVerification?: boolean;
    },
    @Request() req: AuthRequest,
  ) {
    const before = await this.formsService.findOne(id).catch(() => null);
    const result = await this.formsService.togglePublic(
      id,
      body.isPublic,
      body.sendConfirmationEmail,
      body.requiresEmailVerification,
    );
    await this.auditService.log({
      actor: actorFrom(req),
      action: AdminActionType.FORM_TOGGLE_PUBLIC,
      targetType: AdminActionTargetType.FORM,
      targetId: id,
      targetName: result.name,
      metadata: {
        before: {
          isPublic: before?.isPublic,
          sendConfirmationEmail: before?.sendConfirmationEmail,
          requiresEmailVerification: before?.requiresEmailVerification,
        },
        after: {
          isPublic: result.isPublic,
          sendConfirmationEmail: result.sendConfirmationEmail,
          requiresEmailVerification: result.requiresEmailVerification,
        },
      },
    });
    return result;
  }
}