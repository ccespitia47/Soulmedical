import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Task, TaskDocument } from './task.schema';
import { TasksService } from './tasks.service';

@Injectable()
export class TasksRemindersService {
  private readonly logger = new Logger(TasksRemindersService.name);
  private readonly FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly tasksService: TasksService,
  ) {}

  @Cron('0 9,15 * * *') // 9:00 AM y 3:00 PM diarios
  async sendReminders(): Promise<void> {
    this.logger.log('Cron recordatorios de tareas — inicio');
    const now = Date.now();

    // Tareas in_progress con al menos un step in_progress.
    const tasks = await this.taskModel.find({
      status: 'in_progress',
      'steps.status': 'in_progress',
    });

    let sent = 0;
    let skipped = 0;
    for (const task of tasks) {
      const idx = task.steps.findIndex((s) => s.status === 'in_progress');
      if (idx < 0) continue;
      const step = task.steps[idx];

      // Skip si el ultimo recordatorio fue hace <5h (para deduplicar retries
      // de cron o horarios cercanos como 9AM + retry a 10AM).
      if (
        step.lastReminderAt &&
        now - step.lastReminderAt.getTime() < this.FIVE_HOURS_MS
      ) {
        skipped++;
        continue;
      }

      try {
        await this.tasksService.sendStepEmail(task, idx);
        step.lastReminderAt = new Date(now);
        task.markModified('steps');
        await task.save();
        sent++;
      } catch (err) {
        this.logger.error(
          `Recordatorio task=${task._id} step=${idx} falló: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    this.logger.log(`Cron recordatorios — enviados=${sent} salteados=${skipped}`);
  }
}
