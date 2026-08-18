import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';

// No hay mongodb-memory-server en el proyecto, así que mockeamos el model de
// Mongoose con Jest (mismo patrón que tasks-share-link.service.spec.ts).
// cancel usa taskModel.findById(...) — no .lean() — porque necesita un
// documento "vivo" con .save() para persistir el cambio de status.
function makeTaskDoc(overrides: {
  createdById: number;
  status?: 'in_progress' | 'completed' | 'cancelled';
}) {
  const doc: {
    _id: string;
    createdById: number;
    status: 'in_progress' | 'completed' | 'cancelled';
    save: jest.Mock;
  } = {
    _id: 'task-1',
    createdById: overrides.createdById,
    status: overrides.status ?? 'in_progress',
    save: jest.fn(),
  };
  doc.save.mockImplementation(async () => doc);
  return doc;
}

describe('TasksService.cancel', () => {
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
    return { service, taskModel };
  }

  it('cambia status a cancelled y persiste', async () => {
    const task = makeTaskDoc({ createdById: 1, status: 'in_progress' });
    const { service } = buildService({ 'task-1': task });

    const result = await service.cancel('task-1', 1);

    expect(task.status).toBe('cancelled');
    expect(task.save).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('cancelled');
  });

  it('idempotente: llamar 2× no cambia nada', async () => {
    const task = makeTaskDoc({ createdById: 1, status: 'in_progress' });
    const { service } = buildService({ 'task-1': task });

    await service.cancel('task-1', 1);
    await service.cancel('task-1', 1);

    expect(task.status).toBe('cancelled');
    // save() solo se llama en la primera llamada; la segunda es no-op.
    expect(task.save).toHaveBeenCalledTimes(1);
  });

  it('rechaza 403 si createdById !== userId y no es admin', async () => {
    const task = makeTaskDoc({ createdById: 1, status: 'in_progress' });
    const { service } = buildService({ 'task-1': task });

    await expect(service.cancel('task-1', 2, 'coordinator')).rejects.toThrow(
      ForbiddenException,
    );
    expect(task.save).not.toHaveBeenCalled();
    expect(task.status).toBe('in_progress');
  });

  it('admin puede cancelar tarea ajena (override)', async () => {
    const task = makeTaskDoc({ createdById: 1, status: 'in_progress' });
    const { service } = buildService({ 'task-1': task });

    const result = await service.cancel('task-1', 2, 'admin');

    expect(task.status).toBe('cancelled');
    expect(task.save).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('cancelled');
  });

  it('rechaza 404 si task no existe', async () => {
    const { service } = buildService({});

    await expect(service.cancel('missing-task', 1)).rejects.toThrow(
      NotFoundException,
    );
  });
});
