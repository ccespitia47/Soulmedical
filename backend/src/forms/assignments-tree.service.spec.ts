import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AssignmentsTreeService } from './assignments-tree.service';
import { UserFormAssignment } from './user-form-assignment.schema';
import { Form } from './form.schema';
import { Folder } from '../folders/folder.schema';
import { Project } from '../projects/project.schema';
import { AssignmentsTreeDto } from './assignments-tree.dto';

// No hay mongodb-memory-server en el proyecto (grep en package.json no lo
// encuentra), así que mockeamos los 4 models con Jest. Catálogo estático de
// forms/folders/projects reutilizado por todos los tests:
//   p1 (proyecto) ── folA (carpeta) ── f5 (form)
//   p2 (proyecto) ── folB (carpeta) ── f1 (form)
const formsData = [
  { _id: 'f1', folderId: 'folB' },
  { _id: 'f5', folderId: 'folA' },
];
const foldersData = [
  { _id: 'folA', projectId: 'p1' },
  { _id: 'folB', projectId: 'p2' },
];
const projectsData = [{ _id: 'p1' }, { _id: 'p2' }];

function matches(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([k, v]) => doc[k] === v);
}

function staticReadOnlyModel(data: Array<Record<string, unknown>>) {
  return {
    find: jest.fn((filter: { _id: { $in: string[] } }) => ({
      lean: () =>
        Promise.resolve(data.filter((d) => filter._id.$in.includes(d._id as string))),
    })),
  };
}

describe('AssignmentsTreeService', () => {
  let assignmentStore: Array<Record<string, unknown>>;
  let assignmentModel: {
    find: jest.Mock;
    deleteMany: jest.Mock;
    insertMany: jest.Mock;
    countDocuments: jest.Mock;
  };
  let service: AssignmentsTreeService;

  beforeEach(async () => {
    assignmentStore = [];
    assignmentModel = {
      find: jest.fn((filter: Record<string, unknown>) => ({
        lean: () => Promise.resolve(assignmentStore.filter((d) => matches(d, filter))),
      })),
      deleteMany: jest.fn(async (filter: Record<string, unknown>) => {
        assignmentStore = assignmentStore.filter((d) => !matches(d, filter));
      }),
      insertMany: jest.fn(async (docs: Array<Record<string, unknown>>) => {
        assignmentStore.push(...docs);
      }),
      countDocuments: jest.fn(async (filter: Record<string, unknown>) =>
        assignmentStore.filter((d) => matches(d, filter)).length,
      ),
    };

    const mod = await Test.createTestingModule({
      providers: [
        AssignmentsTreeService,
        { provide: getModelToken(UserFormAssignment.name), useValue: assignmentModel },
        { provide: getModelToken(Form.name), useValue: staticReadOnlyModel(formsData) },
        { provide: getModelToken(Folder.name), useValue: staticReadOnlyModel(foldersData) },
        { provide: getModelToken(Project.name), useValue: staticReadOnlyModel(projectsData) },
      ],
    }).compile();

    service = mod.get(AssignmentsTreeService);
  });

  it('write + read son idempotentes', async () => {
    const dto: AssignmentsTreeDto = {
      projects: ['p1'],
      folders: [],
      forms: [],
      excludedFolders: ['folA'],
      excludedForms: ['f5'],
    };
    await service.write({ userId: 1 }, dto);
    await service.write({ userId: 1 }, dto); // dos veces
    const back = await service.read({ userId: 1 });
    expect(back).toEqual(dto);
    // Y no hay duplicados en la colección:
    const count = await assignmentModel.countDocuments({ userId: 1 });
    expect(count).toBe(3); // 1 project + 1 excluded folder + 1 excluded form
  });

  it('rechaza excludedForm sin ancestro', async () => {
    await expect(
      service.write(
        { userId: 1 },
        { projects: [], folders: [], forms: [], excludedFolders: [], excludedForms: ['f1'] },
      ),
    ).rejects.toThrow(/ancestro/i);
  });

  it('rechaza solape forms/excludedForms', async () => {
    await expect(
      service.write(
        { userId: 1 },
        { projects: [], folders: [], forms: ['f1'], excludedFolders: [], excludedForms: ['f1'] },
      ),
    ).rejects.toThrow(/simultáneamente/i);
  });

  it('rechaza excludedFolder sin projectId ancestro', async () => {
    await expect(
      service.write(
        { userId: 1 },
        { projects: [], folders: [], forms: [], excludedFolders: ['folA'], excludedForms: [] },
      ),
    ).rejects.toThrow(/ancestro/i);
  });

  it('rechaza id de proyecto inexistente', async () => {
    await expect(
      service.write(
        { userId: 1 },
        { projects: ['no-existe'], folders: [], forms: [], excludedFolders: [], excludedForms: [] },
      ),
    ).rejects.toThrow(/no existe/i);
  });

  it('funciona igual para subject de group', async () => {
    const dto: AssignmentsTreeDto = {
      projects: ['p2'],
      folders: [],
      forms: [],
      excludedFolders: [],
      excludedForms: [],
    };
    await service.write({ groupId: 'g1' }, dto);
    const back = await service.read({ groupId: 'g1' });
    expect(back).toEqual(dto);
    // No debe filtrarse hacia lecturas de usuario.
    const userBack = await service.read({ userId: 1 });
    expect(userBack.projects).toEqual([]);
  });
});
