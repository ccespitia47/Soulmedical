import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupsService } from './groups.service';

@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  findAll() { return this.groupsService.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.groupsService.findOne(id); }

  @Post()
  create(@Body() dto: { name: string; description?: string; color?: string; icon?: string }) {
    return this.groupsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: { name?: string; description?: string; color?: string; icon?: string }) {
    return this.groupsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.groupsService.remove(id); }

  @Get(':id/members')
  getMembers(@Param('id') id: string) { return this.groupsService.getMembers(id); }

  // Usado por el widget "search" (fuente "group") para autocompletar
  // miembros del grupo por nombre/email. Solo requiere sesión válida
  // (los grupos son datos generales, no sensibles) pero se limita el
  // rate para evitar scraping masivo del listado de usuarios.
  @Get(':id/members/search')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  searchMembers(@Param('id') id: string, @Query('q') q = '') {
    return this.groupsService.searchMembers(id, q);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: { userId: number }) {
    return this.groupsService.addMember(id, body.userId);
  }

  @Delete(':id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.groupsService.removeMember(id, parseInt(userId));
  }

  @Get(':id/assignments')
  getAssignments(@Param('id') id: string) { return this.groupsService.getGroupAssignments(id); }

  @Post(':id/assign/project')
  assignProject(@Param('id') id: string, @Body() body: { projectId: string }) {
    return this.groupsService.assignProjectToGroup(id, body.projectId);
  }

  @Delete(':id/assign/project/:projectId')
  unassignProject(@Param('id') id: string, @Param('projectId') projectId: string) {
    return this.groupsService.unassignProjectFromGroup(id, projectId);
  }

  @Post(':id/assign/form')
  assignForm(@Param('id') id: string, @Body() body: { formId: string }) {
    return this.groupsService.assignFormToGroup(id, body.formId);
  }

  @Delete(':id/assign/form/:formId')
  unassignForm(@Param('id') id: string, @Param('formId') formId: string) {
    return this.groupsService.unassignFormFromGroup(id, formId);
  }
}