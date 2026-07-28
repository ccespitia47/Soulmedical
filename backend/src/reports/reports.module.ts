import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { SecureDownloadsService } from './secure-downloads.service';
import { SecureDownloadsController } from './secure-downloads.controller';
import { SecureDownload, SecureDownloadSchema } from './secure-download.schema';
import { UsersModule } from '../users/users.module';
import { FormsModule } from '../forms/forms.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { EmailModule } from '../email/email.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsGuard } from '../auth/permissions.guard';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SecureDownload.name, schema: SecureDownloadSchema },
    ]),
    UsersModule,
    FormsModule,
    // SubmissionsModule importa ReportsModule (para SecureDownloadsService,
    // usado por BulkPdfService) -> dependencia circular resuelta con
    // forwardRef() en ambos lados.
    forwardRef(() => SubmissionsModule),
    EmailModule,
    AdminAuditModule,
    AuthModule, // para TotpService y JwtAuthGuard
    FilesModule, // GridFS para blobs cifrados >16 MB (ZIPs bulk-pdf)
  ],
  providers: [ReportsService, SecureDownloadsService, PermissionsGuard],
  controllers: [ReportsController, SecureDownloadsController],
  exports: [SecureDownloadsService], // exportar para SubmissionsModule
})
export class ReportsModule {}
