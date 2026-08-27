import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';

// Mismo patrón que tasks-share-link.service.spec.ts: mockeamos el model de
// Mongoose con Jest (no hay mongodb-memory-server en el proyecto).
// listByForm/getDetail solo usan taskModel.find()/.findById() con .lean() —
// no necesitan documentos "vivos" con .save().

type StepFixture = {
  order: number;
  recipientEmail: string;
  recipientName?: string;
  token: string;
  status: 'pending' | 'in_progress' | 'completed';
  formData?: Record<string, string>;
  completedAt?: Date;
  lastReminderAt?: Date | null;
};

function makeTask(overrides: {
  id: string;
  formId?: string;
  title?: string;
  status?: string;
  createdAt?: Date;
  createdByName?: string;
  steps?: StepFixture[];
  shareLink?: { token: string; enabled: boolean } | null;
}) {
  return {
    _id: overrides.id,
    formId: overrides.formId ?? 'form-1',
    title: overrides.title ?? 'Tarea de prueba',
    status: overrides.status ?? 'in_progress',
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    createdByName: overrides.createdByName ?? 'Admin',
    steps: overrides.steps ?? [],
    shareLink: overrides.shareLink ?? null,
  };
}

function buildService(opts: {
  tasks?: ReturnType<typeof makeTask>[];
  taskById?: Record<string, ReturnType<typeof makeTask> | undefined>;
  submissions?: Array<{
    _id: string;
    submittedAt: Date;
    submittedById: number | null;
    templateSnapshot: string | null;
  }>;
}) {
  const tasks = opts.tasks ?? [];
  const taskById = opts.taskById ?? {};

  const taskModel = {
    find: jest.fn(() => ({
      sort: jest.fn(() => ({
        skip: jest.fn((skip: number) => ({
          limit: jest.fn((limit: number) => ({
            lean: jest.fn(() =>
              Promise.resolve(
                limit > 0 ? tasks.slice(skip, skip + limit) : tasks.slice(skip),
              ),
            ),
          })),
        })),
      })),
    })),
    countDocuments: jest.fn(() => Promise.resolve(tasks.length)),
    findById: jest.fn((id: string) => ({
      lean: jest.fn(() => Promise.resolve(taskById[id] ?? null)),
    })),
  };

  const submissionsService = {
    findByTaskId: jest.fn(() => Promise.resolve(opts.submissions ?? [])),
  };

  const service = new TasksService(
    taskModel as any,
    {} as any, // emailService — no se usa en listByForm/getDetail
    submissionsService as any,
    {} as any, // formsService — no se usa en listByForm/getDetail
  );

  return { service, taskModel, submissionsService };
}

describe('TasksService.listByForm', () => {
  it('devuelve stats correctas (total, completed, pending)', async () => {
    const task = makeTask({
      id: 'task-1',
      steps: [
        { order: 1, recipientEmail: 'a@x.com', token: 't1', status: 'completed' },
        { order: 2, recipientEmail: 'b@x.com', token: 't2', status: 'in_progress' },
        { order: 3, recipientEmail: 'c@x.com', token: 't3', status: 'pending' },
      ] as any,
    });
    const { service } = buildService({ tasks: [task] });

    const result = await service.listByForm('form-1');

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'task-1',
      totalRecipients: 3,
      completedCount: 1,
      pendingCount: 2,
      hasShareLink: false,
    });
  });

  it('sort por createdAt desc (delegado al query de Mongo)', async () => {
    const task = makeTask({ id: 'task-1' });
    const { service, taskModel } = buildService({ tasks: [task] });

    await service.listByForm('form-1');

    expect(taskModel.find).toHaveBeenCalledWith({ formId: 'form-1' });
    const sortMock = taskModel.find.mock.results[0].value.sort;
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('vacío si no hay tareas', async () => {
    const { service } = buildService({ tasks: [] });

    const result = await service.listByForm('form-sin-tareas');

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('hasShareLink=true solo si shareLink.token existe', async () => {
    const task = makeTask({
      id: 'task-1',
      shareLink: { token: 'abc', enabled: true },
    });
    const { service } = buildService({ tasks: [task] });

    const result = await service.listByForm('form-1');

    expect(result.data[0].hasShareLink).toBe(true);
  });

  it('shape del response tiene data, total, page, limit', async () => {
    const task = makeTask({ id: 'task-1' });
    const { service } = buildService({ tasks: [task] });

    const result = await service.listByForm('form-1');

    expect(result).toEqual(
      expect.objectContaining({
        data: expect.any(Array),
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
      }),
    );
  });

  it('page=1, limit=20 (default) devuelve máximo 20 items', async () => {
    const tasks = Array.from({ length: 35 }, (_, i) =>
      makeTask({ id: `task-${i}` }),
    );
    const { service } = buildService({ tasks });

    const result = await service.listByForm('form-1');

    expect(result.data).toHaveLength(20);
    expect(result.total).toBe(35);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('page=2 hace skip=20', async () => {
    const tasks = Array.from({ length: 35 }, (_, i) =>
      makeTask({ id: `task-${i}` }),
    );
    const { service, taskModel } = buildService({ tasks });

    const result = await service.listByForm('form-1', { page: 2 });

    expect(result.data).toHaveLength(15);
    expect(result.page).toBe(2);
    const sortMock = taskModel.find.mock.results[0].value.sort;
    const skipMock = sortMock.mock.results[0].value.skip;
    expect(skipMock).toHaveBeenCalledWith(20);
  });

  it('limit=200 clampa a 100', async () => {
    const tasks = Array.from({ length: 5 }, (_, i) => makeTask({ id: `task-${i}` }));
    const { service } = buildService({ tasks });

    const result = await service.listByForm('form-1', { limit: 200 });

    expect(result.limit).toBe(100);
  });

  it('page=0 clampa a 1', async () => {
    const task = makeTask({ id: 'task-1' });
    const { service } = buildService({ tasks: [task] });

    const result = await service.listByForm('form-1', { page: 0 });

    expect(result.page).toBe(1);
  });
});

describe('TasksService.getDetail', () => {
  it('canResend=false si status completed', async () => {
    const task = makeTask({
      id: 'task-1',
      steps: [
        {
          order: 1,
          recipientEmail: 'a@x.com',
          token: 't1',
          status: 'completed',
          completedAt: new Date('2026-01-01T00:00:00.000Z'),
          lastReminderAt: null,
        },
      ] as any,
    });
    const { service } = buildService({ taskById: { 'task-1': task } });

    const result = await service.getDetail('task-1');

    expect(result.recipients[0].canResend).toBe(false);
  });

  it('canResend=false si lastReminderAt <10min', async () => {
    const recentReminder = new Date(Date.now() - 5 * 60 * 1000); // hace 5 min
    const task = makeTask({
      id: 'task-1',
      steps: [
        {
          order: 1,
          recipientEmail: 'a@x.com',
          token: 't1',
          status: 'in_progress',
          lastReminderAt: recentReminder,
        },
      ] as any,
    });
    const { service } = buildService({ taskById: { 'task-1': task } });

    const result = await service.getDetail('task-1');

    expect(result.recipients[0].canResend).toBe(false);
  });

  it('canResend=true si lastReminderAt >10min o nunca se envió', async () => {
    const oldReminder = new Date(Date.now() - 15 * 60 * 1000); // hace 15 min
    const task = makeTask({
      id: 'task-1',
      steps: [
        {
          order: 1,
          recipientEmail: 'a@x.com',
          token: 't1',
          status: 'pending',
          lastReminderAt: oldReminder,
        },
        {
          order: 2,
          recipientEmail: 'b@x.com',
          token: 't2',
          status: 'pending',
          lastReminderAt: null,
        },
      ] as any,
    });
    const { service } = buildService({ taskById: { 'task-1': task } });

    const result = await service.getDetail('task-1');

    expect(result.recipients[0].canResend).toBe(true);
    expect(result.recipients[1].canResend).toBe(true);
  });

  it('shareLinkUrl correcto si hay shareLink', async () => {
    const OLD_ENV = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = 'https://forms.example.com';

    const task = makeTask({
      id: 'task-1',
      shareLink: { token: 'xyz789', enabled: true },
    });
    const { service } = buildService({ taskById: { 'task-1': task } });

    const result = await service.getDetail('task-1');

    expect(result.shareLinkUrl).toBe('https://forms.example.com/t/xyz789');
    process.env.APP_BASE_URL = OLD_ENV;
  });

  it('shareLinkUrl=null si no hay shareLink', async () => {
    const task = makeTask({ id: 'task-1', shareLink: null });
    const { service } = buildService({ taskById: { 'task-1': task } });

    const result = await service.getDetail('task-1');

    expect(result.shareLinkUrl).toBeNull();
  });

  it('incluye submissions ligadas via submissionsService.findByTaskId', async () => {
    const task = makeTask({ id: 'task-1' });
    const { service, submissionsService } = buildService({
      taskById: { 'task-1': task },
      submissions: [
        {
          _id: 'sub-1',
          submittedAt: new Date('2026-01-02T00:00:00.000Z'),
          submittedById: null,
          templateSnapshot: '<html></html>',
        },
      ],
    });

    const result = await service.getDetail('task-1');

    expect(submissionsService.findByTaskId).toHaveBeenCalledWith('task-1');
    expect(result.submissions).toHaveLength(1);
    expect(result.submissions[0]).toMatchObject({
      id: 'sub-1',
      userName: 'Anónimo',
      hasPdf: true,
    });
  });

  it('rechaza 404 si task no existe', async () => {
    const { service } = buildService({ taskById: {} });

    await expect(service.getDetail('missing-task')).rejects.toThrow(
      NotFoundException,
    );
  });
});
