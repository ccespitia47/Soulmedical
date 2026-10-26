import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtOrApiKeyGuard } from '../auth/jwt-or-api-key.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

// Por defecto JwtOrApiKey (lectura/edición desde MCP, Power BI, integraciones).
// La API key resuelve a su owner en el ApiKeyGuard. DELETE queda restringido a
// JWT abajo: borrar carpetas desde una integración externa es irreversible y
// no debería estar al alcance de una key fugada.
@UseGuards(JwtOrApiKeyGuard)
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  create(@Body() dto: CreateFolderDto) {
    return this.foldersService.create(dto);
  }

  @Get()
  findByProject(
    @Query('projectId') projectId: string,
    @Query('withForms') withForms?: string,
  ) {
    // `?withForms=summary` → devuelve también el array `forms` (resumen
    // liviano sin schema/widgets) + `formsCount`. Un solo request reemplaza
    // el patrón N+1 que hacía el frontend (sidebar del HomePage).
    if (withForms === 'summary') {
      return this.foldersService.findByProjectWithForms(projectId);
    }
    return this.foldersService.findByProject(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.foldersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFolderDto) {
    return this.foldersService.update(id, dto);
  }

  // DELETE: solo JWT + permiso FORMS_DELETE. Nunca por API key.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.FORMS_DELETE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.foldersService.remove(id);
  }
}
