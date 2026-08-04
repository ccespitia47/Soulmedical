import { Module } from '@nestjs/common';
import { ExcelController } from './excel.controller';
import { ExcelService } from './excel.service';
import { ExcelCacheService } from './excel-cache.service';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [
    EmailModule, // exporta GraphTokenService
    UsersModule, // necesario para PermissionsGuard (verifica permisos vs DB)
    AdminAuditModule, // audit trail obligatorio para /excel/* (fix I4)
  ],
  controllers: [ExcelController],
  providers: [ExcelService, ExcelCacheService, PermissionsGuard],
})
export class ExcelModule {}
