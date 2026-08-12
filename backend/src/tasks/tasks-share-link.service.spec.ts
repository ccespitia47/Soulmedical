import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';

// No hay mongodb-memory-server en el proyecto, así que mockeamos el model de
// Mongoose con Jest (mismo patrón que assignments-tree.service.spec.ts).
// toggleShareLink solo usa taskModel.findById(...) — no .lean() — porque
// necesita un documento "vivo" con .save() para persistir el shareLink.
function makeTaskDoc(overrides: {
  createdById: number;
  shareLink?: { token: string; enabled: boolean } | null;
}) {
  const doc: {
    _id: string;
    createdById: number;
    shareLink: { token: string; enabled: boolean } | null;
    save: jest.Mock;
  } = {
    _id: 'task-1',
    createdById: overrides.createdById,
    shareLink: overrides.shareLink ?? null,
    save: jest.fn(),
  };
  doc.save.mockImplementation(async () => doc);
  return doc;
}

describe('TasksService.toggleShareLink', () => {
  const OLD_ENV = process.env.APP_BASE_URL;

  beforeEach(() => {
    process.env.APP_BASE_URL = 'https://forms.example.com';
  });

  afterAll(() => {
    process.env.APP_BASE_URL = OLD_ENV;
  });

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

  it('genera token cuando enabled=true y no existe', async () => {
    const task = makeTaskDoc({ createdById: 1, shareLink: null });
    const { service } = buildService({ 'task-1': task });

    const result = await service.toggleShareLink('task-1', true, 1);

    expect(task.shareLink).not.toBeNull();
    expect(task.shareLink?.enabled).toBe(true);
    expect(task.shareLink?.token).toEqual(expect.any(String));
    expect(task.save).toHaveBeenCalledTimes(1);
    expect(result.shareLinkUrl).toBe(
      `https://forms.example.com/t/${task.shareLink?.token}`,
    );
  });

  it('idempotente: dos llamadas con enabled=true no rotan el token', async () => {
    const task = makeTaskDoc({ createdById: 1, shareLink: null });
    const { service } = buildService({ 'task-1': task });

    const first = await service.toggleShareLink('task-1', true, 1);
    const firstToken = task.shareLink?.token;
    const second = await service.toggleShareLink('task-1', true, 1);

    expect(task.shareLink?.token).toBe(firstToken);
    expect(second.shareLinkUrl).toBe(first.shareLinkUrl);
    // save() solo se llama en la primera llamada; la segunda es no-op.
    expect(task.save).toHaveBeenCalledTimes(1);
  });

  it('enabled=false pone shareLink=null', async () => {
    const task = makeTaskDoc({
      createdById: 1,
      shareLink: { token: 'abc123', enabled: true },
    });
    const { service } = buildService({ 'task-1': task });

    const result = await service.toggleShareLink('task-1', false, 1);

    expect(task.shareLink).toBeNull();
    expect(task.save).toHaveBeenCalledTimes(1);
    expect(result.shareLinkUrl).toBeNull();
  });

  it('rechaza 403 si createdById !== userId', async () => {
    const task = makeTaskDoc({ createdById: 1, shareLink: null });
    const { service } = buildService({ 'task-1': task });

    await expect(service.toggleShareLink('task-1', true, 2)).rejects.toThrow(
      ForbiddenException,
    );
    expect(task.save).not.toHaveBeenCalled();
  });

  it('rechaza 404 si task no existe', async () => {
    const { service } = buildService({});

    await expect(
      service.toggleShareLink('missing-task', true, 1),
    ).rejects.toThrow(NotFoundException);
  });
});
