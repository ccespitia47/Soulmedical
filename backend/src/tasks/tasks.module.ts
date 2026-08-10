import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from './task.schema';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { EmailModule } from '../email/email.module';
import { SubmissionsModule } from '../submissions/submissions.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
    EmailModule,
    SubmissionsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}