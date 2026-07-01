import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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
      select: ['id', 'name', 'email', 'role', 'isActive', 'createdAt'],
    });
    return users;
  }

  async update(
    id: number,
    changes: { name?: string; email?: string; role?: UserRole; password?: string },
  ): Promise<Omit<User, 'password'>> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (changes.password) {
      changes = { ...changes, password: await bcrypt.hash(changes.password, 12) };
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
