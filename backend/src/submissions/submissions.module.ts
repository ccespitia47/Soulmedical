import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormSubmission, FormSubmissionSchema } from './form-submission.schema';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';
import { PdfRendererService } from './pdf-renderer.service';
import { BulkPdfService } from './bulk-pdf.service';
import { FormsModule } from '../forms/forms.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { FilesModule } from '../files/files.module';
import { UsersModule } from '../users/users.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { EmailModule } from '../email/email.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FormSubmission.name, schema: FormSubmissionSchema },
    ]),
    FormsModule,
    ApiKeysModule,
    FilesModule,
    UsersModule,
    AdminAuditModule,
    EmailModule,
    // ReportsModule exporta SecureDownloadsService (necesario para guardar el
    // ZIP de BulkPdfService). ReportsModule a su vez importa SubmissionsModule
    // (para SubmissionsService) -> dependencia circular entre ambos módulos,
    // resuelta con forwardRef() en los dos lados.
    forwardRef(() => ReportsModule),
  ],
  controllers: [SubmissionsController, RecordsController],
  providers: [
    SubmissionsService,
    RecordsService,
    PdfRendererService,
    BulkPdfService,
    ApiKeyGuard,
    PermissionsGuard,
  ],
  // BulkPdfService se exporta además de SubmissionsService: TasksController
  // (módulo distinto) lo inyecta para el endpoint POST /tasks/:id/bulk-pdf.
  exports: [SubmissionsService, BulkPdfService],
})
export class SubmissionsModule {}