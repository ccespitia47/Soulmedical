import { TasksService } from './tasks.service';

// No hay mongodb-memory-server en el proyecto, así que mockeamos el model de
// Mongoose con Jest (mismo patrón que tasks-share-link.service.spec.ts y
// tasks-cancel.service.spec.ts).
//
// submitFromShare lee el task con .lean() (no puede usar .save()), así que
// la invalidación del link one-shot pasa por taskModel.updateOne(...). El
// mock de taskModel expone findOne().lean() y updateOne() por separado.
function makeLeanTask(overrides: {
  formId?: string;
  shareLink?: { token: string; enabled: boolean; oneShot?: boolean } | null;
}) {
  return {
    _id: 'task-1',
    formId: overrides.formId ?? 'form-1',
    status: 'in_progress',
    widgets: [{ id: 'campo1' }],
    shareLink: overrides.shareLink ?? null,
  };
}

function buildService(opts: {
  leanTask: ReturnType<typeof makeLeanTask> | null;
  taskDoc?: { _id: string; createdById: number; shareLink: unknown; save: jest.Mock };
}) {
  const updateOne = jest.fn().mockResolvedValue({ acknowledged: true });
  const findById = jest.fn(() => Promise.resolve(opts.taskDoc ?? null));
  const taskModel = {
    findOne: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(opts.leanTask),
    })),
    updateOne,
    findById,
  };
  const formsService = {
    findOne: jest.fn().mockResolvedValue({
      isActive: true,
      isPublic: true,
      requiresEmailVerification: false,
    }),
  };
  const submissionsService = {
    submit: jest.fn().mockResolvedValue({ _id: 'sub-1' }),
  };
  const service = new TasksService(
    taskModel as any,
    {} as any,
    submissionsService as any,
    formsService as any,
  );
  return { service, taskModel, formsService, submissionsService };
}

describe('OneShot share link', () => {
  it('submitFromShare invalida enabled=false si oneShot=true', async () => {
    const leanTask = makeLeanTask({
      shareLink: { token: 'tok-1', enabled: true, oneShot: true },
    });
    const { service, taskModel } = buildService({ leanTask });

    const result = await service.submitFromShare('tok-1', { campo1: 'hola' });

    expect(result.submissionId).toBe('sub-1');
    expect(taskModel.updateOne).toHaveBeenCalledTimes(1);
    expect(taskModel.updateOne).toHaveBeenCalledWith(
      { _id: 'task-1' },
      { $set: { 'shareLink.enabled': false } },
    );
  });

  it('submitFromShare NO invalida si oneShot=false o undefined (doc legacy)', async () => {
    for (const shareLink of [
      { token: 'tok-1', enabled: true, oneShot: false },
      { token: 'tok-1', enabled: true }, // legacy: sin el campo oneShot
    ]) {
      const leanTask = makeLeanTask({ shareLink });
      const { service, taskModel } = buildService({ leanTask });

      await service.submitFromShare('tok-1', { campo1: 'hola' });

      expect(taskModel.updateOne).not.toHaveBeenCalled();
    }
  });

  it('toggleShareLink con oneShot=true crea link con oneShot en shareLink', async () => {
    const taskDoc = {
      _id: 'task-1',
      createdById: 1,
      shareLink: null as { token: string; enabled: boolean; oneShot: boolean } | null,
      save: jest.fn(),
    };
    taskDoc.save.mockImplementation(async () => taskDoc);
    const { service } = buildService({ leanTask: null, taskDoc });

    await service.toggleShareLink('task-1', true, 1, true);

    expect(taskDoc.shareLink).not.toBeNull();
    expect(taskDoc.shareLink?.oneShot).toBe(true);
    expect(taskDoc.save).toHaveBeenCalledTimes(1);
  });
});
