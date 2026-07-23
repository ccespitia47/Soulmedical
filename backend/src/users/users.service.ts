import { Injectable, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './user.entity';
import { EmailService } from '../email/email.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly emailService: EmailService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(
    name: string,
    email: string,
    password: string,
    role: UserRole = UserRole.USER,
    isActive = true,
    documentNumber?: string | null,
  ): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Ya existe un usuario con este correo');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = this.usersRepository.create({
      name,
      email,
      password: hashedPassword,
      role,
      isActive,
      documentNumber: documentNumber?.trim() || null,
    });

    return this.usersRepository.save(user);
  }

  async findByResetToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { resetToken: token } });
  }

  async setResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
    await this.usersRepository.update(userId, {
      resetToken: token,
      resetTokenExpiresAt: expiresAt,
    });
  }

  async updatePasswordAndClearToken(userId: number, newPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.usersRepository.update(userId, {
      password: hashed,
      resetToken: null,
      resetTokenExpiresAt: null,
    });
  }

  async findAll(): Promise<Omit<User, 'password'>[]> {
    const users = await this.usersRepository.find({
      select: [
        'id',
        'name',
        'email',
        'role',
        'isActive',
        'permissions',
        'totpEnabled',
        'documentNumber',
        'createdAt',
      ],
    });
    return users;
  }

  async updatePermissions(
    id: number,
    permissions: string[],
  ): Promise<Omit<User, 'password'>> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    await this.usersRepository.update(id, { permissions });
    const updated = await this.findById(id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, ...rest } = updated!;
    return rest;
  }

  async update(
    id: number,
    changes: {
      name?: string;
      email?: string;
      role?: UserRole;
      password?: string;
      documentNumber?: string | null;
    },
  ): Promise<Omit<User, 'password'>> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (changes.password) {
      changes = { ...changes, password: await bcrypt.hash(changes.password, 12) };
    }
    // Trim del documento; string vacío se guarda como null.
    if ('documentNumber' in changes) {
      changes.documentNumber = changes.documentNumber?.trim() || null;
    }
    await this.usersRepository.update(id, changes);
    const updated = await this.findById(id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, ...rest } = updated!;
    return rest;
  }

  async remove(id: number): Promise<void> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    await this.usersRepository.delete(id);
  }

  async toggleActive(id: number): Promise<Omit<User, 'password'>> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    await this.usersRepository.update(id, { isActive: !user.isActive });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, ...rest } = { ...user, isActive: !user.isActive };
    return rest;
  }

  // ── 2FA (TOTP) ────────────────────────────────────────────────────────────

  /** Guarda el secret generado mientras el usuario aún no confirma el setup. */
  async setTotpSecret(id: number, secret: string): Promise<void> {
    await this.usersRepository.update(id, { totpSecret: secret });
  }

  /** Activa el 2FA tras la confirmación del primer código válido. */
  async enableTotp(id: number): Promise<void> {
    await this.usersRepository.update(id, { totpEnabled: true });
  }

  /**
   * Borra el secret y desactiva el 2FA. Si `actorId` se provee y es distinto
   * al `id` reseteado, notificamos por email al usuario afectado (es decir,
   * un admin reseteó a otro usuario — el usuario debe enterarse por seguridad).
   *
   * Self-reset (actorId === id, o sin actorId) NO envía email — el usuario
   * lo hizo a propósito.
   *
   * El envío del email es best-effort: si falla, la operación de reset
   * sigue exitosa (el log queda como rastro).
   */
  async resetTotp(id: number, actorId?: number): Promise<void> {
    const targetBefore = await this.findById(id);
    if (!targetBefore) throw new NotFoundException('Usuario no encontrado');

    await this.usersRepository.update(id, { totpSecret: null, totpEnabled: false });

    if (!actorId || actorId === id) return;
    try {
      const actor = await this.findById(actorId);
      await this.emailService.sendTwoFactorResetNotice({
        to: targetBefore.email,
        userName: targetBefore.name,
        actorName: actor?.name,
      });
    } catch (err) {
      this.logger.error('[resetTotp] No se pudo enviar el aviso por email:', err);
    }
  }

  /** Crea un admin inicial si no existe ningún usuario */
  async seedAdmin(): Promise<void> {
    const count = await this.usersRepository.count();
    if (count === 0) {
      await this.create(
        'Julian Leonardo Cobos Rodriguez',
        'bi2@sarapacientes.com',
        'Julian1030*',
        UserRole.ADMIN,
      );
      console.log('Usuario admin seed creado: bi2@sarapacientes.com');
    }
  }
}