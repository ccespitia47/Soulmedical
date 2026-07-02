import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportDownloadsService } from './report-downloads.service';
import { ReportDownloadsController } from './report-downloads.controller';
import { ReportDownload, ReportDownloadSchema } from './report-download.schema';
import { UsersModule } from '../users/users.module';
import { FormsModule } from '../forms/forms.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { EmailModule } from '../email/email.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReportDownload.name, schema: ReportDownloadSchema },
    ]),
    UsersModule,
    FormsModule,
    SubmissionsModule,
    EmailModule,
    AdminAuditModule,
    AuthModule, // para TotpService y JwtAuthGuard
  ],
  providers: [ReportsService, ReportDownloadsService, PermissionsGuard],
  controllers: [ReportsController, ReportDownloadsController],
})
export class ReportsModule {}
