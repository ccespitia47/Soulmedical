import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.entity';
import { EmailService } from '../email/email.service';
import { TotpService } from './totp.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { getEffectivePermissions } from './permissions';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private totpService: TotpService,
  ) {}

  // ── Login en dos pasos ──────────────────────────────────────────────────
  // Paso 1: valida email/password. Si el usuario ya tiene 2FA activo, NO
  // entrega el JWT: entrega un "pendingToken" de vida corta que el cliente
  // debe acompañar del código TOTP en /auth/2fa/verify-login.
  // Si el usuario NO tiene 2FA activo todavía, entrega un "setupToken" para
  // que el cliente lo lleve a configurar el 2FA (obligatorio, no puede
  // saltarse este paso).
  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // 2FA ya configurado y activo → pide el código TOTP.
    if (user.totpEnabled && user.totpSecret) {
      const pendingToken = this.jwtService.sign(
        { sub: user.id, stage: '2fa_pending' },
        { expiresIn: '5m' },
      );
      return {
        requires2FA: true,
        requiresSetup: false,
        pendingToken,
      };
    }

    // 2FA obligatorio pero aún no configurado → fuerza el setup.
    const setupToken = this.jwtService.sign(
      { sub: user.id, stage: '2fa_setup' },
      { expiresIn: '10m' },
    );
    return {
      requires2FA: true,
      requiresSetup: true,
      setupToken,
    };
  }

  // Paso 2a: usuario sin 2FA aún. Genera secret + QR para que lo escanee.
  async start2FASetup(setupToken: string) {
    const payload = this.verifyShortToken(setupToken, '2fa_setup');
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    // Si ya estaba activo (carrera entre pestañas), no regenerar secret.
    if (user.totpEnabled && user.totpSecret) {
      throw new BadRequestException('El doble factor ya está configurado para este usuario');
    }

    const secret = this.totpService.generateSecret();
    await this.usersService.setTotpSecret(user.id, secret);
    const qrDataUrl = await this.totpService.generateQrCodeDataUrl(user.email, secret);

    return { qrDataUrl, secret };
  }

  // Paso 2b: usuario confirma el primer código generado por su app → activa 2FA y entrega JWT.
  async confirm2FASetup(setupToken: string, code: string) {
    const payload = this.verifyShortToken(setupToken, '2fa_setup');
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.totpSecret) {
      throw new BadRequestException('No hay un proceso de configuración de 2FA en curso');
    }

    const valid = await this.totpService.verifyToken(code, user.totpSecret);
    if (!valid) {
      throw new UnauthorizedException('Código incorrecto. Verifica la hora de tu dispositivo e intenta de nuevo.');
    }

    await this.usersService.enableTotp(user.id);
    return this.issueFinalToken(user.id);
  }

  // Paso 2c: usuario con 2FA ya activo, ingresa el código de su app.
  async verifyLogin2FA(pendingToken: string, code: string) {
    const payload = this.verifyShortToken(pendingToken, '2fa_pending');
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.totpSecret || !user.totpEnabled) {
      throw new UnauthorizedException('Sesión inválida, vuelve a iniciar sesión');
    }

    const valid = await this.totpService.verifyToken(code, user.totpSecret);
    if (!valid) {
      throw new UnauthorizedException('Código incorrecto');
    }

    return this.issueFinalToken(user.id);
  }

  // Permite a un usuario (ya logueado) resetear su 2FA si perdió el dispositivo.
  // Requiere contraseña actual por seguridad. El admin también puede forzar
  // un reset desde el panel de Usuarios (ver users.service.resetTotp).
  async reset2FAWithPassword(userId: number, password: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Contraseña incorrecta');

    await this.usersService.resetTotp(user.id);
    return { success: true, message: 'Doble factor reiniciado. Deberás configurarlo de nuevo al ingresar.' };
  }

  private verifyShortToken(token: string, expectedStage: string): { sub: number; stage: string } {
    try {
      const payload = this.jwtService.verify<{ sub: number; stage: string }>(token);
      if (payload.stage !== expectedStage) {
        throw new UnauthorizedException('Token inválido para esta operación');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado, vuelve a iniciar sesión');
    }
  }

  private async issueFinalToken(userId: number) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: getEffectivePermissions(user),
      },
    };
  }

  // ── Registro / forgot / reset (sin cambios funcionales) ─────────────────

  async register(dto: RegisterDto) {
    await this.usersService.create(
      dto.name,
      dto.email,
      dto.password,
      UserRole.USER,
      false,
    );
    return {
      success: true,
      message:
        'Solicitud creada. Un administrador debe aprobar tu cuenta antes de que puedas ingresar.',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    const genericResponse = {
      success: true,
      message:
        'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    };

    if (!user || !user.isActive) return genericResponse;

    const token = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.usersService.setResetToken(user.id, token, expiresAt);

    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
    const resetUrl = `${appBaseUrl}/reset-password?token=${token}`;

    try {
      await this.emailService.sendPasswordReset({
        to: user.email,
        name: user.name,
        resetUrl,
      });
    } catch (err) {
      console.error('[forgotPassword] Error enviando email de reset:', err);
    }

    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByResetToken(dto.token);
    if (
      !user ||
      !user.resetTokenExpiresAt ||
      user.resetTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Token inválido o expirado');
    }
    if (!user.isActive) {
      throw new BadRequestException(
        'La cuenta no está activa. Contacta a un administrador.',
      );
    }

    try {
      await this.usersService.updatePasswordAndClearToken(user.id, dto.password);
    } catch (err) {
      console.error('[resetPassword] Error actualizando contraseña:', err);
      throw new InternalServerErrorException('No se pudo restablecer la contraseña');
    }

    return {
      success: true,
      message: 'Contraseña actualizada. Ya puedes iniciar sesión.',
    };
  }

  async getProfile(userId: number) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: getEffectivePermissions(user),
    };
  }
}