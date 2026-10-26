import {
  Controller,
  ForbiddenException,
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
import { JwtOrApiKeyGuard } from '../auth/jwt-or-api-key.guard';
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
  user: {
    id: number;
    email?: string;
    name?: string;
    role: string;
    authSource?: 'jwt' | 'api_key';
    apiKeyName?: string;
  };
}

// Marca el actor como humano ("Nombre") o integración ("API Key: foo") para que
// la bitácora distinga de dónde vino el cambio. Un reviewer externo no podía
// diferenciarlos antes: todo quedaba a nombre del dueño de la key.
function actorFrom(req: AuthRequest) {
  const baseName = req.user.name ?? req.user.email ?? `user#${req.user.id}`;
  const name =
    req.user.authSource === 'api_key'
      ? `API Key: ${req.user.apiKeyName ?? 'sin nombre'} (owner ${baseName})`
      : baseName;
  return {
    id: Number(req.user.id),
    name,
    role: req.user.role,
  };
}

function auditSourceMeta(req: AuthRequest) {
  return {
    authSource: req.user.authSource ?? 'jwt',
    apiKeyName: req.user.apiKeyName ?? null,
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

  // Create/read/edit aceptan API key para integraciones (MCP, Power BI, agentes).
  // Edit queda limitado por Permission.FORMS_EDIT y auditado explícitamente abajo
  // porque cambia el schema de un formulario en vivo; para dar a una integración
  // sólo poder de editar (no borrar), emitir la API key a un usuario no-admin con
  // permisos extra {FORMS_CREATE, FORMS_EDIT} y SIN FORMS_DELETE.
  // Delete sigue requiriendo JWT: una key fugada no debería poder eliminar.
  @UseGuards(JwtOrApiKeyGuard, PermissionsGuard)
  @RequirePermission(Permission.FORMS_CREATE)
  @Post()
  async create(@Body() dto: CreateFormDto, @Request() req: AuthRequest) {
    // Si se crea un formulario vía API key, bloqueamos definir emailTemplate
    // desde el inicio: la plantilla de correo decide a quién llega el PDF del
    // paciente, y no debe salir de una integración (mismo criterio que PATCH).
    if (
      (dto as { emailTemplate?: unknown }).emailTemplate !== undefined &&
      req.user.authSource === 'api_key'
    ) {
      throw new ForbiddenException(
        'La plantilla de correo (emailTemplate) debe configurarse desde la app, no vía API key.',
      );
    }
    return this.formsService.create(dto, req.user.id);
  }

  @UseGuards(JwtOrApiKeyGuard)
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

  @UseGuards(JwtOrApiKeyGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }

  @UseGuards(JwtOrApiKeyGuard, PermissionsGuard)
  @RequirePermission(Permission.FORMS_EDIT)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFormDto,
    @Request() req: AuthRequest,
  ) {
    // emailTemplate rige quién recibe el PDF firmado del paciente. Si una
    // API key fugada pudiera editarlo, podría agregar un bccRecipients static
    // con un correo externo y recibir copia oculta de todos los consentimientos
    // (nombre, documento, firma) — una fuga reportable bajo Ley 1581. Solo JWT.
    if (dto.emailTemplate !== undefined && req.user.authSource === 'api_key') {
      throw new ForbiddenException(
        'La edición de la plantilla de correo (emailTemplate) requiere sesión de usuario, no se permite vía API key.',
      );
    }

    const before = await this.formsService.findOne(id).catch(() => null);
    const result = await this.formsService.update(id, dto);
    const changedFields: string[] = [];
    if (dto.name !== undefined && dto.name !== before?.name)
      changedFields.push('name');
    if (dto.emailTemplate !== undefined) changedFields.push('emailTemplate');
    if (dto.schema !== undefined) changedFields.push('schema');
    await this.auditService.log({
      actor: actorFrom(req),
      action: AdminActionType.FORM_EDIT,
      targetType: AdminActionTargetType.FORM,
      targetId: id,
      targetName: result.name,
      metadata: {
        changedFields,
        versionBefore: before?.version ?? null,
        versionAfter: result.version,
        nameBefore: before?.name ?? null,
        ...auditSourceMeta(req),
      },
    });
    return result;
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
      metadata: auditSourceMeta(req),
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
        ...auditSourceMeta(req),
      },
    });
    return result;
  }
}