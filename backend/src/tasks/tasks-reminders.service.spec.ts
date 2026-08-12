import { TasksRemindersService } from './tasks-reminders.service';

// Mismo patrón de mock que tasks-resend.service.spec.ts: no hay
// mongodb-memory-server, así que simulamos el documento Mongoose con Jest.
// sendReminders usa taskModel.find(...) sin .lean() porque necesita
// documentos "vivos" con .save() para persistir lastReminderAt.
function makeTaskDoc(overrides: {
  id?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  steps: Array<{
    status: 'pending' | 'in_progress' | 'completed';
    lastReminderAt?: Date | null;
  }>;
}) {
  const doc: {
    _id: string;
    status: string;
    steps: Array<{
      status: 'pending' | 'in_progress' | 'completed';
      lastReminderAt: Date | null;
    }>;
    markModified: jest.Mock;
    save: jest.Mock;
  } = {
    _id: overrides.id ?? 'task-1',
    status: overrides.status ?? 'in_progress',
    steps: overrides.steps.map((s) => ({
      status: s.status,
      lastReminderAt: s.lastReminderAt ?? null,
    })),
    markModified: jest.fn(),
    save: jest.fn(),
  };
  doc.save.mockImplementation(async () => doc);
  return doc;
}

describe('TasksRemindersService.sendReminders', () => {
  function buildService(tasks: ReturnType<typeof makeTaskDoc>[]) {
    const taskModel = {
      find: jest.fn().mockResolvedValue(tasks),
    };
    const tasksService = {
      sendStepEmail: jest.fn().mockResolvedValue(true),
    };
    const service = new TasksRemindersService(
      taskModel as any,
      tasksService as any,
    );
    return { service, taskModel, tasksService };
  }

  it('envía recordatorio a step in_progress sin lastReminderAt', async () => {
    const task = makeTaskDoc({
      steps: [{ status: 'in_progress', lastReminderAt: null }],
    });
    const { service, taskModel, tasksService } = buildService([task]);

    await service.sendReminders();

    expect(taskModel.find).toHaveBeenCalledWith({
      status: 'in_progress',
      'steps.status': 'in_progress',
    });
    expect(tasksService.sendStepEmail).toHaveBeenCalledWith(task, 0);
    expect(task.steps[0].lastReminderAt).toBeInstanceOf(Date);
    expect(task.markModified).toHaveBeenCalledWith('steps');
    expect(task.save).toHaveBeenCalledTimes(1);
  });

  it('salta step con lastReminderAt <5h', async () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000); // hace 1h
    const task = makeTaskDoc({
      steps: [{ status: 'in_progress', lastReminderAt: recent }],
    });
    const { service, tasksService } = buildService([task]);

    await service.sendReminders();

    expect(tasksService.sendStepEmail).not.toHaveBeenCalled();
    expect(task.save).not.toHaveBeenCalled();
    expect(task.steps[0].lastReminderAt).toBe(recent);
  });

  it('no actualiza lastReminderAt si el envío falla', async () => {
    const task = makeTaskDoc({
      steps: [{ status: 'in_progress', lastReminderAt: null }],
    });
    const { service, tasksService } = buildService([task]);
    // sendStepEmail nunca rethrow — atrapa el error de emailService y
    // resuelve `false`. El cron debe respetar ese boolean, no un catch.
    tasksService.sendStepEmail.mockResolvedValue(false);

    await service.sendReminders();

    expect(tasksService.sendStepEmail).toHaveBeenCalledWith(task, 0);
    expect(task.steps[0].lastReminderAt).toBeNull();
    expect(task.markModified).not.toHaveBeenCalled();
    expect(task.save).not.toHaveBeenCalled();
  });
});
