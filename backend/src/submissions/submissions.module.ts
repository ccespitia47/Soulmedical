import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormSubmission, FormSubmissionSchema } from './form-submission.schema';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { FormsModule } from '../forms/forms.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { FilesModule } from '../files/files.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { PdfRendererService } from './pdf-renderer.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FormSubmission.name, schema: FormSubmissionSchema },
    ]),
    FormsModule,
    ApiKeysModule,
    FilesModule,
    EmailModule,
    UsersModule,
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, ApiKeyGuard, PdfRendererService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}