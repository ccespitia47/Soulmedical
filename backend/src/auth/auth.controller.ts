import { Controller, Post, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Rate limits calibrados para uso corporativo: 300+ usuarios detrás del
  // mismo NAT/IP pública. Con 5/min por IP, un evento masivo (capacitación,
  // jornada) bloqueaba al 6º usuario legítimo. La defensa real contra
  // brute-force sobre un usuario específico es la contraseña + 2FA — el
  // throttle por IP es solo una segunda barrera contra scripts abusivos.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ── 2FA ───────────────────────────────────────────────────────────────────

  // Genera el QR para que el usuario configure su app authenticator.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('2fa/setup')
  async start2FASetup(@Body() body: { setupToken: string }) {
    return this.authService.start2FASetup(body.setupToken);
  }

  // Confirma el primer código generado y activa el 2FA → entrega JWT final.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('2fa/confirm-setup')
  async confirm2FASetup(@Body() body: { setupToken: string; code: string }) {
    return this.authService.confirm2FASetup(body.setupToken, body.code);
  }

  // Login normal cuando el usuario ya tiene 2FA activo: valida el código.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('2fa/verify-login')
  async verifyLogin2FA(@Body() body: { pendingToken: string; code: string }) {
    return this.authService.verifyLogin2FA(body.pendingToken, body.code);
  }

  // Usuario logueado resetea su propio 2FA (perdió el dispositivo).
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/reset')
  async reset2FA(
    @Request() req: { user: { id: number } },
    @Body() body: { password: string },
  ) {
    return this.authService.reset2FAWithPassword(req.user.id, body.password);
  }

  // ── Registro / forgot / reset ────────────────────────────────────────────

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Envía email real — limitamos más para evitar flooding del proveedor SMTP.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: { user: { id: number } }) {
    return this.authService.getProfile(req.user.id);
  }

  /**
   * Auto-edición del propio perfil. Cualquier usuario logueado puede
   * actualizar su nombre, email, número de documento y (opcionalmente)
   * su contraseña. NUNCA su rol ni sus permisos ni su 2FA — esos son
   * privilegios de admin (ver users.controller: PATCH /users/:id,
   * PATCH /users/:id/permissions, POST /users/:id/reset-2fa).
   *
   * Se filtran silenciosamente esos campos si vienen en el body, para
   * que un cliente malicioso o un frontend con bug no pueda escalar
   * privilegios con este endpoint.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Patch('profile')
  async updateProfile(
    @Request() req: { user: { id: number } },
    @Body()
    body: {
      name?: string;
      email?: string;
      password?: string;
      documentNumber?: string;
    },
  ) {
    return this.authService.updateOwnProfile(req.user.id, {
      name: body.name,
      email: body.email,
      password: body.password,
      documentNumber: body.documentNumber,
    });
  }

  // Renueva el JWT sin pedir credenciales otra vez. El frontend lo llama
  // periódicamente mientras haya actividad del usuario (cada ~15 min)
  // para evitar que la sesión caiga por el TTL absoluto del JWT.
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  async refresh(@Request() req: { user: { id: number } }) {
    return this.authService.refreshToken(req.user.id);
  }
}