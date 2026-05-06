import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

interface OptionalAuthRequest { user?: { id: number } }

@Controller('')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  // Captura el usuario logueado si hay token, pero no lo requiere
  @UseGuards(OptionalJwtAuthGuard)
  @Post('forms/:formId/submit')
  submit(
    @Param('formId') formId: string,
    @Body() dto: CreateSubmissionDto,
    @Request() req: OptionalAuthRequest,
  ) {
    const userId = req.user?.id ?? undefined;
    return this.submissionsService.submit(formId, dto, userId);
  }

  // Obtener respuestas de un formulario (requiere login)
  @UseGuards(JwtAuthGuard)
  @Get('forms/:formId/submissions')
  findByForm(
    @Param('formId') formId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.submissionsService.findByForm(formId, parseInt(page), parseInt(limit));
  }

  // Detalle de una respuesta especifica
  @UseGuards(JwtAuthGuard)
  @Get('submissions/:id')
  findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }

  // Listado global (solo admin)
  @UseGuards(JwtAuthGuard)
  @Get('submissions')
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.submissionsService.findAll(parseInt(page), parseInt(limit));
  }
}
