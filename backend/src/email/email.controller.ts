import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailService } from './email.service';
import type { SendEmailPayload } from './email.types';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  // Solo usuarios autenticados pueden disparar el envío de correos arbitrarios.
  // Los flujos públicos (tareas vía token, reset de contraseña) NO pasan por
  // este endpoint: invocan EmailService directamente desde su propio servicio.
  @UseGuards(JwtAuthGuard)
  @Post('send')
  async send(@Body() payload: SendEmailPayload) {
    return this.emailService.sendEmail(payload);
  }
}
