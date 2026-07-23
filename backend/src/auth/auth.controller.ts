import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
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

  // Anti brute force: 5 intentos de login por IP cada minuto.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ── 2FA ───────────────────────────────────────────────────────────────────

  // Genera el QR para que el usuario configure su app authenticator.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/setup')
  async start2FASetup(@Body() body: { setupToken: string }) {
    return this.authService.start2FASetup(body.setupToken);
  }

  // Confirma el primer código generado y activa el 2FA → entrega JWT final.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/confirm-setup')
  async confirm2FASetup(@Body() body: { setupToken: string; code: string }) {
    return this.authService.confirm2FASetup(body.setupToken, body.code);
  }

  // Login normal cuando el usuario ya tiene 2FA activo: valida el código.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/verify-login')
  async verifyLogin2FA(@Body() body: { pendingToken: string; code: string }) {
    return this.authService.verifyLogin2FA(body.pendingToken, body.code);
  }

  // Usuario logueado resetea su propio 2FA (perdió el dispositivo).
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('2fa/reset')
  async reset2FA(
    @Request() req: { user: { id: number } },
    @Body() body: { password: string },
  ) {
    return this.authService.reset2FAWithPassword(req.user.id, body.password);
  }

  // ── Registro / forgot / reset ────────────────────────────────────────────

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: { user: { id: number } }) {
    return this.authService.getProfile(req.user.id);
  }
}