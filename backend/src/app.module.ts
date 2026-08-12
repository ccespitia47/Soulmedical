import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { FoldersModule } from './folders/folders.module';
import { FormsModule } from './forms/forms.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { GroupsModule } from './groups/groups.module';
import { EmailModule } from './email/email.module';
import { ExcelModule } from './excel/excel.module';
import { ConsentsModule } from './consents/consents.module';
import { AdminAuditModule } from './admin-audit/admin-audit.module';
import { ReportsModule } from './reports/reports.module';
import { dataSourceOptions } from './data-source';
import {TasksModule} from './tasks/tasks.module';

@Module({
  imports: [
    // Rate limiting global. Por defecto 100 req/min por IP. /auth/login y
    // /auth/forgot-password tienen sus propios @Throttle más estrictos.
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 1 min
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot(dataSourceOptions),
    MongooseModule.forRoot(
      process.env.MONGO_URI || 'mongodb://localhost:27017/soulformsdb',
    ),
    AuthModule,
    UsersModule,
    ProjectsModule,
    FoldersModule,
    FormsModule,
    SubmissionsModule,
    ApiKeysModule,
    GroupsModule,
    EmailModule,
    ConsentsModule,
    AdminAuditModule,
    ReportsModule,
    TasksModule,
    ExcelModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
