import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from './user.entity';
import { ALL_PERMISSIONS } from '../auth/permissions';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import {
  AdminActionTargetType,
  AdminActionType,
} from '../admin-audit/admin-action.entity';
import { AssignmentsTreeService } from '../forms/assignments-tree.service';
import { AssignmentsTreeDto } from '../forms/assignments-tree.dto';

// El JWT lleva id/email/role. El `name` no viaja en el token; si el día de
// mañana lo agregamos al payload, lo capturamos automáticamente acá.
type AuthReq = { user: { id: number; email?: string; name?: string; role: string } };

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private auditService: AdminAuditService,
    private assignmentsTreeService: AssignmentsTreeService,
  ) {}

  // Listar usuarios: solo admin y coordinator (los paneles de asignación
  // los usan estos roles). Un usuario normal no necesita ver el listado.
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Roles(UserRole.ADMIN)
  @Post()
  async create(
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
      role?: UserRole;
      documentNumber?: string;
    },
    @Req() req: AuthReq,
  ) {
    const result = await this.usersService.create(
      body.name,
      body.email,
      body.password,
      body.role ?? UserRole.USER,
      true,
      body.documentNumber ?? null,
    );
    await this.auditService.log({
      actor: actorFrom(req),
      action: AdminActionType.USER_CREATE,
      targetType: AdminActionTargetType.USER,
      targetId: result.id,
      targetName: result.name,
      metadata: { email: result.email, role: result.role },
    });
    return result;
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      email?: string;
      role?: UserRole;
      password?: string;
      documentNumber?: string;
    },
    @Req() req: AuthReq,
  ) {
    // Protección: un admin no puede degradarse a sí mismo (evita quedarse sin admins por accidente).
    const targetId = +id;
    if (
      body.role &&
      body.role !== UserRole.ADMIN &&
      targetId === Number(req.user.id) &&
      req.user.role === UserRole.ADMIN
    ) {
      throw new BadRequestException(
        'No puedes quitarte el rol de administrador a ti mismo. Pide a otro admin que lo haga.',
      );
    }
    // Snapshot del estado anterior para el diff en metadata.
    const before = await this.usersService.findById(targetId);
    const result = await this.usersService.update(targetId, body);
    // Solo loguear los campos que efectivamente cambiaron, sin password.
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (before) {
      if (body.name && before.name !== body.name)
        changes.name = { from: before.name, to: body.name };
      if (body.email && before.email !== body.email)
        changes.email = { from: before.email, to: body.email };
      if (body.role && before.role !== body.role)
        changes.role = { from: before.role, to: body.role };
      if (body.password) changes.password = { from: '***', to: '***' };
    }
    await this.auditService.log({
      actor: actorFrom(req),
      action: AdminActionType.USER_UPDATE,
      targetType: AdminActionTargetType.USER,
      targetId,
      targetName: result.name,
      metadata: { changes },
    });
    return result;
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthReq) {
    if (+id === Number(req.user.id)) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta.');
    }
    const before = await this.usersService.findById(+id);
    await this.usersService.remove(+id);
    await this.auditService.log({
      actor: actorFrom(req),
      action: AdminActionType.USER_DELETE,
      targetType: AdminActionTargetType.USER,
      targetId: +id,
      targetName: before?.name ?? null,
      metadata: before ? { email: before.email, role: before.role } : null,
    });
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/toggle')
  async toggle(@Param('id') id: string, @Req() req: AuthReq) {
    if (+id === Number(req.user.id)) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta.');
    }
    const result = await this.usersService.toggleActive(+id);
    await this.auditService.log({
      actor: actorFrom(req),
      action: AdminActionType.USER_TOGGLE_ACTIVE,
      targetType: AdminActionTargetType.USER,
      targetId: +id,
      targetName: result.name,
      metadata: { isActive: result.isActive },
    });
    return result;
  }

  /**
   * Reemplaza los permisos EXTRA del usuario (no los de su rol base).
   * Solo admins pueden modificarlos. Filtra cualquier permiso que no esté
   * en el catálogo conocido para evitar persistir basura.
   */
  @Roles(UserRole.ADMIN)
  @Patch(':id/permissions')
  async updatePermissions(
    @Param('id') id: string,
    @Body() body: { permissions: string[] },
    @Req() req: AuthReq,
  ) {
    const allowed = new Set<string>(ALL_PERMISSIONS);
    const sanitized = Array.isArray(body.permissions)
      ? body.permissions.filter((p) => allowed.has(p))
      : [];
    const before = await this.usersService.findById(+id);
    const result = await this.usersService.updatePermissions(+id, sanitized);
    await this.auditService.log({
      actor: actorFrom(req),
      action: AdminActionType.USER_PERMISSIONS_CHANGE,
      targetType: AdminActionTargetType.USER,
      targetId: +id,
      targetName: result.name,
      metadata: { before: before?.permissions ?? [], after: sanitized },
    });
    return result;
  }

  /**
   * Reset administrativo del doble factor: borra el secret y desactiva 2FA
   * para que el usuario tenga que configurar de nuevo en su próximo login.
   */
  @Roles(UserRole.ADMIN)
  @Post(':id/reset-2fa')
  async resetTwoFactor(@Param('id') id: string, @Req() req: AuthReq) {
    const target = await this.usersService.findById(+id);
    // Pasamos actorId para que usersService notifique por email al usuario
    // reseteado SOLO cuando el actor es otro admin (no en self-reset).
    await this.usersService.resetTotp(+id, Number(req.user.id));
    await this.auditService.log({
      actor: actorFrom(req),
      action: AdminActionType.USER_RESET_2FA,
      targetType: AdminActionTargetType.USER,
      targetId: +id,
      targetName: target?.name ?? null,
      metadata: { selfReset: +id === Number(req.user.id) },
    });
    return { success: true, message: 'Doble factor reiniciado para el usuario.' };
  }

  /**
   * Lectura/escritura bulk del árbol de asignaciones (proyectos, carpetas,
   * forms directos + exclusiones) de un usuario. Coexiste con los endpoints
   * legacy `POST /projects/:id/assign` y `POST /forms/:id/assign` (flujo
   * target-first de HomePage.tsx) — este endpoint no los reemplaza ni los
   * toca; es el shape nuevo que usará el picker jerárquico.
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/assignments/tree')
  async getAssignmentsTree(@Param('id') id: string) {
    return this.assignmentsTreeService.read({ userId: parseInt(id, 10) });
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/assignments/tree')
  async putAssignmentsTree(
    @Param('id') id: string,
    @Body() dto: AssignmentsTreeDto,
  ) {
    return this.assignmentsTreeService.write({ userId: parseInt(id, 10) }, dto);
  }
}

/** Helper para extraer el actor del request JWT. */
function actorFrom(req: AuthReq): { id: number; name: string; role: string } {
  return {
    id: Number(req.user.id),
    // Si no llega `name` (caso actual), usamos email — siempre presente en el
    // JWT. Mantiene el log legible aunque tenga formato "admin@empresa.com".
    name: req.user.name ?? req.user.email ?? `user#${req.user.id}`,
    role: req.user.role,
  };
}
