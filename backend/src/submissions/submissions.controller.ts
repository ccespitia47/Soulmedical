import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

interface OptionalAuthRequest { user?: { id: number } }
interface AuthedRequest { user?: { id: number } }

@Controller('')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post('forms/:formId/submit')
  submit(
    @Param('formId') formId: string,
    @Body() dto: CreateSubmissionDto,
    @Request() req: OptionalAuthRequest,
  ) {
    return this.submissionsService.submit(formId, dto, req.user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('forms/:formId/submissions')
  findByForm(
    @Param('formId') formId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.submissionsService.findByForm(formId, parseInt(page), parseInt(limit));
  }

  // Endpoint para Power BI y herramientas externas — usa X-Api-Key
  @UseGuards(ApiKeyGuard)
  @Get('forms/:formId/submissions/export')
  exportByForm(
    @Param('formId') formId: string,
    @Query('page') page = '0',
    @Query('limit') limit = '100',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.submissionsService.exportByForm(
      formId,
      parseInt(page),
      parseInt(limit),
      from,
      to,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('submissions/:id')
  findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('submissions')
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.submissionsService.findAll(parseInt(page), parseInt(limit));
  }

  // Envíos hechos por el usuario logueado (vista "Enviados")
  @UseGuards(JwtAuthGuard)
  @Get('submissions/mine/list')
  findMine(
    @Request() req: AuthedRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const user = req.user;
    if (!user) throw new UnauthorizedException('Usuario no autenticado');
    return this.submissionsService.findByUser(user.id, parseInt(page), parseInt(limit));
  }
}
