import {
  BadRequestException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';

// Mismo patrón de mock que tasks-share-link.service.spec.ts: no hay
// mongodb-memory-server, así que simulamos el documento Mongoose con Jest.
// resendStep usa taskModel.findById(...) sin .lean() porque necesita un
// documento "vivo" con .save() para persistir lastReminderAt.
function makeTaskDoc(overrides: {
  createdById: number;
  steps: Array<{
    status: 'pending' | 'in_progress' | 'completed';
    lastReminderAt?: Date | null;
  }>;
}) {
  const doc: {
    _id: string;
    createdById: number;
    steps: Array<{
      status: 'pending' | 'in_progress' | 'completed';
      lastReminderAt: Date | null;
    }>;
    markModified: jest.Mock;
    save: jest.Mock;
  } = {
    _id: 'task-1',
    createdById: overrides.createdById,
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

describe('TasksService.resendStep', () => {
  function buildService(store: Record<string, ReturnType<typeof makeTaskDoc> | undefined>) {
    const taskModel = {
      findById: jest.fn((id: string) => Promise.resolve(store[id] ?? null)),
    };
    const service = new TasksService(
      taskModel as any,
      {} as any,
      {} as any,
      {} as any,
    );
    // sendStepEmail hace side-effects de red (EmailService); lo mockeamos
    // para aislar la lógica de throttle/ownership de resendStep. Es público
    // desde este task, así que jest.spyOn funciona sin trucos de acceso.
    jest.spyOn(service, 'sendStepEmail').mockResolvedValue(true);
    return { service, taskModel };
  }

  it('reenvía y actualiza lastReminderAt', async () => {
    const task = makeTaskDoc({
      createdById: 1,
      steps: [{ status: 'in_progress', lastReminderAt: null }],
    });
    const { service } = buildService({ 'task-1': task });

    const result = await service.resendStep('task-1', 0, 1);

    expect(service.sendStepEmail).toHaveBeenCalledWith(task, 0);
    expect(task.steps[0].lastReminderAt).toBeInstanceOf(Date);
    expect(task.markModified).toHaveBeenCalledWith('steps');
    expect(task.save).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.sentAt).toEqual(task.steps[0].lastReminderAt?.toISOString());
  });

  it('rechaza 429 si lastReminderAt <10min', async () => {
    const recent = new Date(Date.now() - 60_000); // hace 1 min
    const task = makeTaskDoc({
      createdById: 1,
      steps: [{ status: 'in_progress', lastReminderAt: recent }],
    });
    const { service } = buildService({ 'task-1': task });

    await expect(service.resendStep('task-1', 0, 1)).rejects.toThrow(
      HttpException,
    );
    expect(service.sendStepEmail).not.toHaveBeenCalled();
    expect(task.save).not.toHaveBeenCalled();
  });

  it('rechaza 400 si step completed', async () => {
    const task = makeTaskDoc({
      createdById: 1,
      steps: [{ status: 'completed', lastReminderAt: null }],
    });
    const { service } = buildService({ 'task-1': task });

    await expect(service.resendStep('task-1', 0, 1)).rejects.toThrow(
      BadRequestException,
    );
    expect(service.sendStepEmail).not.toHaveBeenCalled();
  });

  it('rechaza 403 si no owner', async () => {
    const task = makeTaskDoc({
      createdById: 1,
      steps: [{ status: 'in_progress', lastReminderAt: null }],
    });
    const { service } = buildService({ 'task-1': task });

    await expect(service.resendStep('task-1', 0, 2)).rejects.toThrow(
      ForbiddenException,
    );
    expect(service.sendStepEmail).not.toHaveBeenCalled();
  });
});
