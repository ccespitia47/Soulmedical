import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { EmailModule } from '../email/email.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { FormsModule } from '../forms/forms.module';

/**
 * forwardRef() en AdminAuditModule para romper el ciclo:
 *   UsersModule → AdminAuditModule (para users.controller escribir bitacora)
 *   AdminAuditModule → UsersModule (para PermissionsGuard leer permisos)
 *
 * Mismo patrón con FormsModule:
 *   UsersModule → FormsModule (para users.controller usar AssignmentsTreeService)
 *   FormsModule → UsersModule (FormsService/OTP usa UsersService)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    EmailModule,
    forwardRef(() => AdminAuditModule),
    forwardRef(() => FormsModule),
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
