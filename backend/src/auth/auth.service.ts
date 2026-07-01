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
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  // Registro público: el rol siempre se fuerza a 'user' y la cuenta queda inactiva
  // hasta que un admin la apruebe desde la página de Usuarios.
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
    // Respuesta genérica para no filtrar si el correo existe.
    const genericResponse = {
      success: true,
      message:
        'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    };

    if (!user || !user.isActive) return genericResponse;

    const token = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await this.usersService.setResetToken(user.id, token, expiresAt);

    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
    const emailServiceUrl =
      process.env.EMAIL_SERVICE_URL || 'http://localhost:3002';
    const resetUrl = `${appBaseUrl}/reset-password?token=${token}`;

    try {
      const response = await fetch(`${emailServiceUrl}/api/send-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.email,
          name: user.name,
          resetUrl,
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.error(
          `[forgotPassword] Email service respondió ${response.status}: ${body}`,
        );
      }
    } catch (err) {
      console.error('[forgotPassword] Error contactando al email service:', err);
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
    };
  }
}
