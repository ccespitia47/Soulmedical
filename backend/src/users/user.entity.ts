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

  @Column({ type: 'varchar', length: 128, nullable: true })
  resetToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resetTokenExpiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
