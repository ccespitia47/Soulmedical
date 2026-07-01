import {
  Controller,
  Get,
  Post,
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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Listar usuarios: cualquier usuario autenticado (lo usan paneles de asignación).
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() body: { name: string; email: string; password: string; role?: UserRole }) {
    return this.usersService.create(
      body.name,
      body.email,
      body.password,
      body.role ?? UserRole.USER,
    );
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; role?: UserRole; password?: string },
    @Req() req: { user: { id: number; role: string } },
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
    return this.usersService.update(targetId, body);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user: { id: number } }) {
    if (+id === Number(req.user.id)) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta.');
    }
    return this.usersService.remove(+id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @Req() req: { user: { id: number } }) {
    if (+id === Number(req.user.id)) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta.');
    }
    return this.usersService.toggleActive(+id);
  }
}
