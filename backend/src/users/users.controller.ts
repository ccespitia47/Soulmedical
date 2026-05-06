import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from './user.entity';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(@Body() body: { name: string; email: string; password: string; role?: UserRole }) {
    return this.usersService.create(body.name, body.email, body.password, body.role ?? UserRole.USER);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; role?: UserRole; password?: string },
  ) {
    return this.usersService.update(+id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.usersService.toggleActive(+id);
  }
}
