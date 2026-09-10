import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormsModule } from '../forms/forms.module';
import { UsersModule } from '../users/users.module';
import { FilesModule } from '../files/files.module';
import { ConsentsSeeder } from './consents.seeder';
import { ConsentsService } from './consents.service';
import { ConsentValidationService } from './consent-validation.service';
import { ConsentsController } from './consents.controller';
import { ConsentRecord, ConsentRecordSchema } from './consent-record.schema';

@Module({
  imports: [
    FormsModule,
    UsersModule,
    FilesModule,
    MongooseModule.forFeature([
      { name: ConsentRecord.name, schema: ConsentRecordSchema },
    ]),
  ],
  controllers: [ConsentsController],
  providers: [ConsentsSeeder, ConsentsService, ConsentValidationService],
})
export class ConsentsModule {}
