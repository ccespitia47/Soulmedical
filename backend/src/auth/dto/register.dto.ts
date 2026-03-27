import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '../../users/user.entity';

export class RegisterDto {
  @IsNotEmpty({ message: 'El nombre es requerido' })
  name: string;

  @IsEmail({}, { message: 'Correo electrónico no válido' })
  email: string;

  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Rol no válido' })
  role?: UserRole;
}
