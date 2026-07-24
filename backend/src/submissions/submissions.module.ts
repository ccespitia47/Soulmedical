import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormSubmission, FormSubmissionSchema } from './form-submission.schema';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';
import { PdfRendererService } from './pdf-renderer.service';
import { FormsModule } from '../forms/forms.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { FilesModule } from '../files/files.module';
import { UsersModule } from '../users/users.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';

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
  ],
  controllers: [SubmissionsController, RecordsController],
  providers: [
    SubmissionsService,
    RecordsService,
    PdfRendererService,
    ApiKeyGuard,
    PermissionsGuard,
  ],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}