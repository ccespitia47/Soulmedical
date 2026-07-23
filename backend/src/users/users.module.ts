import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { EmailModule } from '../email/email.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';

/**
 * forwardRef() en AdminAuditModule para romper el ciclo:
 *   UsersModule → AdminAuditModule (para users.controller escribir bitacora)
 *   AdminAuditModule → UsersModule (para PermissionsGuard leer permisos)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    EmailModule,
    forwardRef(() => AdminAuditModule),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule implements OnModuleInit {
  constructor(private usersService: UsersService) {}

  async onModuleInit() {
    await this.usersService.seedAdmin();
  }
}
