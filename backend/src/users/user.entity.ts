import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  COORDINATOR = 'coordinator',
  USER = 'user',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: UserRole.USER })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'simple-array', default: '' })
  permissions: string[];

  @Column({ type: 'varchar', length: 128, nullable: true })
  resetToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resetTokenExpiresAt: Date | null;

  // ── 2FA (TOTP) ──────────────────────────────────────────────────────────
  // Secret base32 de TOTP. Null hasta que el usuario complete el setup.
  @Column({ type: 'varchar', length: 64, nullable: true })
  totpSecret: string | null;

  // true solo después de que el usuario confirma el primer código generado.
  @Column({ default: false })
  totpEnabled: boolean;

  /**
   * Número de documento (cédula, DNI, etc.). Se usa como contraseña del ZIP
   * cifrado que contiene los reportes de envíos que el usuario solicita por
   * correo. Nullable: usuarios pre-existentes no lo tienen y un admin debe
   * registrárselo antes de que puedan solicitar reportes.
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  documentNumber: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}