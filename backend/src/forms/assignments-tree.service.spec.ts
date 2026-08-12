import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AssignmentsTreeService } from './assignments-tree.service';
import { UserFormAssignment } from './user-form-assignment.schema';
import { Form } from './form.schema';
import { Folder } from '../folders/folder.schema';
import { Project } from '../projects/project.schema';
import { Group } from '../groups/group.schema';
import { UsersService } from '../users/users.service';
import { AssignmentsTreeDto } from './assignments-tree.dto';

// No hay mongodb-memory-server en el proyecto (grep en package.json no lo
// encuentra), así que mockeamos los models con Jest. Catálogo estático de
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
// Subjects existentes para las validaciones de existencia: userId 1 y group g1.
const usersData = [{ id: 1, name: 'Test User' }];
const groupsData = [{ _id: 'g1', isActive: true }];

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

/** Mock mínimo de un Mongoose model que solo necesita findById(...).lean(). */
function findByIdModel(data: Array<Record<string, unknown>>) {
  return {
    findById: jest.fn((id: string) => ({
      lean: () => Promise.resolve(data.find((d) => d._id === id) ?? null),
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

    const usersService = {
      findById: jest.fn(async (id: number) => usersData.find((u) => u.id === id) ?? null),
    };

    const mod = await Test.createTestingModule({
      providers: [
        AssignmentsTreeService,
        { provide: getModelToken(UserFormAssignment.name), useValue: assignmentModel },
        { provide: getModelToken(Form.name), useValue: staticReadOnlyModel(formsData) },
        { provide: getModelToken(Folder.name), useValue: staticReadOnlyModel(foldersData) },
        { provide: getModelToken(Project.name), useValue: staticReadOnlyModel(projectsData) },
        { provide: getModelToken(Group.name), useValue: findByIdModel(groupsData) },
        { provide: UsersService, useValue: usersService },
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

  it('rechaza 404 con userId inexistente', async () => {
    const emptyDto: AssignmentsTreeDto = {
      projects: [],
      folders: [],
      forms: [],
      excludedFolders: [],
      excludedForms: [],
    };
    await expect(service.write({ userId: 99999 }, emptyDto)).rejects.toThrow(
      /no encontrado/i,
    );
    // No debe haber tocado la colección de assignments.
    expect(assignmentModel.deleteMany).not.toHaveBeenCalled();
  });

  it('rechaza 404 con groupId inexistente', async () => {
    const emptyDto: AssignmentsTreeDto = {
      projects: [],
      folders: [],
      forms: [],
      excludedFolders: [],
      excludedForms: [],
    };
    await expect(
      service.write({ groupId: 'grupo-borrado' }, emptyDto),
    ).rejects.toThrow(/no encontrado/i);
    expect(assignmentModel.deleteMany).not.toHaveBeenCalled();
  });
});
