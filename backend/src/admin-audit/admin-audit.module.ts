import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAction } from './admin-action.entity';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditController } from './admin-audit.controller';
import { UsersModule } from '../users/users.module';
import { PermissionsGuard } from '../auth/permissions.guard';

/**
 * Depende de UsersModule (para PermissionsGuard). Como UsersModule también
 * depende de AdminAuditModule (para escribir bitácora), envolvemos con
 * forwardRef() para romper el ciclo — Nest resuelve la dependencia perezosamente.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AdminAction]),
    forwardRef(() => UsersModule),
  ],
  providers: [AdminAuditService, PermissionsGuard],
  controllers: [AdminAuditController],
  exports: [AdminAuditService],
})
export class AdminAuditModule {}
