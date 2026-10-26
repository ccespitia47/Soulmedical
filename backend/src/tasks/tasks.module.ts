import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from './task.schema';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TasksRemindersService } from './tasks-reminders.service';
import { EmailModule } from '../email/email.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { FormsModule } from '../forms/forms.module';
import { UsersModule } from '../users/users.module';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
    EmailModule,
    SubmissionsModule,
    FormsModule,
    // PermissionsGuard (usado en TasksController vía @RequirePermission) inyecta
    // UsersService, así que UsersModule debe estar disponible aquí.
    UsersModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TasksRemindersService, PermissionsGuard],
  exports: [TasksService],
})
export class TasksModule {}