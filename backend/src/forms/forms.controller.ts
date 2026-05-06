import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { AssignUserDto } from './dto/assign-user.dto';

interface AuthRequest { user: { id: number; role: string } }

@UseGuards(JwtAuthGuard)
@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Post()
  create(@Body() dto: CreateFormDto, @Request() req: AuthRequest) {
    return this.formsService.create(dto, req.user.id);
  }

  @Get()
  findByFolder(@Query('folderId') folderId: string) {
    return this.formsService.findByFolder(folderId);
  }

  @Get('assigned')
  findAssigned(@Request() req: AuthRequest) {
    return this.formsService.findAssignedToUser(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFormDto) {
    return this.formsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.formsService.remove(id);
  }

  @Post(':id/assign')
  assignUser(@Param('id') id: string, @Body() dto: AssignUserDto) {
    return this.formsService.assignUser(id, dto.userId);
  }

  @Delete(':id/assign/:userId')
  unassignUser(@Param('id') id: string, @Param('userId') userId: string) {
    return this.formsService.unassignUser(id, parseInt(userId));
  }

  @Get(':id/assignments')
  getAssignments(@Param('id') id: string) {
    return this.formsService.getAssignedUsers(id);
  }
}
