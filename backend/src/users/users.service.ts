import { Injectable, ConflictException } from '@nestjs/common';
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
    });

    return this.usersRepository.save(user);
  }

  async findAll(): Promise<Omit<User, 'password'>[]> {
    const users = await this.usersRepository.find({
      select: ['id', 'name', 'email', 'role', 'isActive', 'createdAt'],
    });
    return users;
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
