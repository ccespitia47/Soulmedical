# Asignaciones con jerarquía + exclusiones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir asignaciones jerárquicas (proyecto → carpeta → form) con exclusiones puntuales (quitar carpeta o form específico sin perder la asignación del ancestro).

**Architecture:** Extender `UserFormAssignment` con `folderId` y `excluded`. Nuevo endpoint bulk idempotente `/assignments/tree` reemplaza el N+1 actual. Frontend refactoriza `useAssignmentState` para soportar exclusiones y elimina el `disabled` en `AssignmentTree`.

**Tech Stack:** NestJS 11, Mongoose 9, React 19, TypeScript estricto, Tailwind. Sin nuevas dependencias.

## Global Constraints

- **Backward compat DB**: assignments existentes deben seguir funcionando. `folderId` default null, `excluded` default false.
- **Backward compat API**: endpoints granulares (`POST /projects/:id/assign`, `POST /forms/:id/assign`, sus DELETE, y los `/assignments` de lectura plana) se mantienen intactos — los usa el flujo target-first de `HomePage.tsx`/`useHomeAssignTarget.ts`.
- **Explicit git add**: nunca `git add -A`. Siempre `git add <path>` por archivo.
- **No emojis en código nuevo** salvo que el archivo existente ya los use consistentemente.
- **Copy en español** para toda UI nueva.
- **Reglas de integridad del modelo**: un registro con `excluded=true` debe tener `formId` XOR `folderId` set, más `userId` XOR `groupId`. Positivo tiene exactamente uno de `{formId, folderId, projectId}` set.
- **Idempotencia**: el PUT `/assignments/tree` debe poder llamarse 2× con el mismo payload sin duplicados en DB.
- **Sin nuevos endpoints granulares**: agregar `folderId+userId` NO expone `POST /folders/:id/assign` — solo se manipula vía bulk.

---

### Task 1: Backend schema — extender UserFormAssignment con folderId + excluded

**Files:**
- Modify: `backend/src/forms/user-form-assignment.schema.ts`
- Modify: `backend/src/forms/forms.module.ts` (registrar el schema si hay hook post-init; verificar antes de tocar)
- Create: `backend/src/forms/user-form-assignment-indexes.ts` (helper para drop+create índices al arrancar; ver step 5)

**Interfaces:**
- Consumes: nada (primer task)
- Produces: `UserFormAssignment` con nuevos campos `folderId: string | null` (default null) y `excluded: boolean` (default false). Ambos indexados.

- [ ] **Step 1: Leer el schema actual y verificar que no rompe consumers**

Comando previo (informativo, no editar):
```bash
grep -rn "UserFormAssignment\|assignmentModel" backend/src --include='*.ts'
```

Los consumers hoy solo leen `formId`, `projectId`, `userId`, `groupId`. Los nuevos campos default los ignoran silenciosamente.

- [ ] **Step 2: Agregar los dos campos al `@Schema` class**

En `user-form-assignment.schema.ts`, agregar dentro de `class UserFormAssignment`:

```ts
@Prop({ type: String, required: false, index: true, default: null })
folderId: string | null;

@Prop({ type: Boolean, required: true, default: false, index: true })
excluded: boolean;
```

- [ ] **Step 3: Actualizar los 4 índices existentes para filtrar `excluded: false`**

Reemplazar los 4 índices actuales (formId+userId, projectId+userId, formId+groupId, projectId+groupId) para que su `partialFilterExpression` incluya `excluded: false`. Ejemplo del primero:

```ts
UserFormAssignmentSchema.index(
  { formId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      formId: { $type: 'string' },
      userId: { $type: 'number' },
      excluded: false,
    },
  },
);
```

Repetir análogo para los otros 3.

- [ ] **Step 4: Agregar los 6 nuevos índices**

Al final del bloque de índices:

```ts
// Positivos por carpeta
UserFormAssignmentSchema.index(
  { folderId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      folderId: { $type: 'string' },
      userId: { $type: 'number' },
      excluded: false,
    },
  },
);
UserFormAssignmentSchema.index(
  { folderId: 1, groupId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      folderId: { $type: 'string' },
      groupId: { $type: 'string' },
      excluded: false,
    },
  },
);

// Exclusiones a nivel form
UserFormAssignmentSchema.index(
  { formId: 1, userId: 1, excluded: 1 },
  {
    unique: true,
    partialFilterExpression: {
      formId: { $type: 'string' },
      userId: { $type: 'number' },
      excluded: true,
    },
  },
);
UserFormAssignmentSchema.index(
  { formId: 1, groupId: 1, excluded: 1 },
  {
    unique: true,
    partialFilterExpression: {
      formId: { $type: 'string' },
      groupId: { $type: 'string' },
      excluded: true,
    },
  },
);

// Exclusiones a nivel carpeta
UserFormAssignmentSchema.index(
  { folderId: 1, userId: 1, excluded: 1 },
  {
    unique: true,
    partialFilterExpression: {
      folderId: { $type: 'string' },
      userId: { $type: 'number' },
      excluded: true,
    },
  },
);
UserFormAssignmentSchema.index(
  { folderId: 1, groupId: 1, excluded: 1 },
  {
    unique: true,
    partialFilterExpression: {
      folderId: { $type: 'string' },
      groupId: { $type: 'string' },
      excluded: true,
    },
  },
);
```

- [ ] **Step 5: Crear helper de rebuild de índices al arrancar**

Los índices existentes en producción NO tienen `excluded: false` en su `partialFilterExpression`. Mongoose por defecto NO recrea un índice si el nombre existe (aunque el filtro haya cambiado). Necesitamos un `dropIndex` + `createIndex` explícito en el bootstrap.

Crear `backend/src/forms/user-form-assignment-indexes.ts`:

```ts
import { Model } from 'mongoose';
import { UserFormAssignmentDocument } from './user-form-assignment.schema';

// Nombres canónicos (Mongoose los genera desde las keys). Si Sara personalizó
// nombres a mano en el pasado, tocará ajustar aquí. Los que estamos rebuild-ando
// son los 4 unique-parcial preexistentes que ahora deben filtrar excluded:false.
const LEGACY_INDEX_NAMES = [
  'formId_1_userId_1',
  'projectId_1_userId_1',
  'formId_1_groupId_1',
  'projectId_1_groupId_1',
];

export async function rebuildAssignmentIndexes(
  model: Model<UserFormAssignmentDocument>,
): Promise<void> {
  const existing = await model.collection.indexes();
  const names = new Set(existing.map((i) => i.name));

  for (const name of LEGACY_INDEX_NAMES) {
    const idx = existing.find((i) => i.name === name);
    if (idx && !('excluded' in (idx.partialFilterExpression ?? {}))) {
      // Índice legacy sin filtro excluded: se cae y Mongoose lo recrea con el
      // nuevo shape en el próximo syncIndexes().
      await model.collection.dropIndex(name);
    }
  }

  await model.syncIndexes();
}
```

- [ ] **Step 6: Cablear el helper al bootstrap del módulo**

Verificar cómo se hace en otros módulos del proyecto (grep `syncIndexes\|onModuleInit`). Si `FormsModule` no tiene un `onModuleInit`, agregarlo:

```ts
// backend/src/forms/forms.module.ts (o forms.service.ts si tiene onModuleInit)
async onModuleInit() {
  await rebuildAssignmentIndexes(this.assignmentModel);
}
```

Si el `FormsService` es más apropiado (ya tiene inyectado `assignmentModel`), agregar ahí el hook.

- [ ] **Step 7: Build y verificar arranque**

```bash
cd backend
npm run build
```

Verificar que compila. Reiniciar backend manualmente (fuera de este task) para observar logs del rebuild — pero eso es E2E, no del task.

- [ ] **Step 8: Commit**

```bash
git add backend/src/forms/user-form-assignment.schema.ts backend/src/forms/user-form-assignment-indexes.ts
# Y forms.module.ts o forms.service.ts, lo que se haya tocado
git commit -m "feat(assignments): schema con folderId + excluded + rebuild de indices legacy"
```

---

### Task 2: Backend resolución — nueva lógica de acceso con exclusiones

**Files:**
- Modify: `backend/src/forms/forms.service.ts` (getAssignedForms y otros que resuelvan acceso)
- Modify: `backend/src/projects/projects.service.ts` (si consulta assignments directamente)

**Interfaces:**
- Consumes: schema extendido del Task 1
- Produces: método `resolveAccessibleForms(userId | groupIds[])` que devuelve el set final de formIds accesibles considerando positivos - exclusiones. Los consumers de "¿está este user asignado a este form?" pueden usar `getAssignedForms(userId)` como antes; el nuevo shape es transparente.

- [ ] **Step 1: Leer los métodos que hoy consultan assignments**

Grep-ear en `backend/src`:
```bash
grep -rn "assignmentModel\.find\|assignmentModel\.findOne" backend/src --include='*.ts'
```

Identificar TODOS los sitios que asumen "un assignment con formId=X ⇔ tiene acceso al form X". Esos son los que deben incorporar la nueva resolución.

- [ ] **Step 2: Escribir la función pura `resolveAccess`**

En `backend/src/forms/forms.service.ts` (o un nuevo `assignment-resolver.ts` si crece):

```ts
type AssignmentRow = {
  formId: string | null;
  folderId: string | null;
  projectId: string | null;
  excluded: boolean;
};

/**
 * Dado el set de assignments (positivos + exclusiones) para uno o varios
 * sujetos (user + sus groups), y el catálogo de todos los forms con su
 * folder/project ancestro, devuelve el set de formIds accesibles.
 */
export function resolveAccessibleFormIds(
  assignments: AssignmentRow[],
  allForms: Array<{ id: string; folderId: string; projectId: string }>,
): Set<string> {
  const posProjects = new Set(
    assignments.filter((a) => !a.excluded && a.projectId).map((a) => a.projectId!),
  );
  const posFolders = new Set(
    assignments.filter((a) => !a.excluded && a.folderId).map((a) => a.folderId!),
  );
  const posForms = new Set(
    assignments.filter((a) => !a.excluded && a.formId).map((a) => a.formId!),
  );
  const excFolders = new Set(
    assignments.filter((a) => a.excluded && a.folderId).map((a) => a.folderId!),
  );
  const excForms = new Set(
    assignments.filter((a) => a.excluded && a.formId).map((a) => a.formId!),
  );

  const result = new Set<string>();
  for (const f of allForms) {
    const inheritsFromProject =
      posProjects.has(f.projectId) && !excFolders.has(f.folderId);
    const inheritsFromFolder = posFolders.has(f.folderId);
    const isDirect = posForms.has(f.id);
    const isExcluded = excForms.has(f.id) || excFolders.has(f.folderId);
    if ((isDirect || inheritsFromProject || inheritsFromFolder) && !isExcluded) {
      result.add(f.id);
    }
  }
  return result;
}
```

- [ ] **Step 3: Escribir tests unitarios de `resolveAccessibleFormIds`**

Crear `backend/src/forms/assignment-resolver.spec.ts` (colocar la función en un módulo separado si `forms.service.ts` ya es grande):

```ts
import { resolveAccessibleFormIds } from './assignment-resolver';

describe('resolveAccessibleFormIds', () => {
  const forms = [
    { id: 'f1', folderId: 'folA', projectId: 'p1' },
    { id: 'f2', folderId: 'folA', projectId: 'p1' },
    { id: 'f3', folderId: 'folB', projectId: 'p1' },
    { id: 'f4', folderId: 'folC', projectId: 'p2' },
  ];

  it('proyecto asignado da acceso a todos sus forms', () => {
    const r = resolveAccessibleFormIds(
      [{ projectId: 'p1', folderId: null, formId: null, excluded: false }],
      forms,
    );
    expect([...r].sort()).toEqual(['f1', 'f2', 'f3']);
  });

  it('excluir un form dentro del proyecto lo quita', () => {
    const r = resolveAccessibleFormIds(
      [
        { projectId: 'p1', folderId: null, formId: null, excluded: false },
        { projectId: null, folderId: null, formId: 'f2', excluded: true },
      ],
      forms,
    );
    expect([...r].sort()).toEqual(['f1', 'f3']);
  });

  it('excluir carpeta bloquea todos sus forms', () => {
    const r = resolveAccessibleFormIds(
      [
        { projectId: 'p1', folderId: null, formId: null, excluded: false },
        { projectId: null, folderId: 'folA', formId: null, excluded: true },
      ],
      forms,
    );
    expect([...r].sort()).toEqual(['f3']);
  });

  it('form directo sin proyecto asignado también da acceso', () => {
    const r = resolveAccessibleFormIds(
      [{ projectId: null, folderId: null, formId: 'f4', excluded: false }],
      forms,
    );
    expect([...r]).toEqual(['f4']);
  });

  it('exclusión sin ancestro positivo no bloquea nada de otros', () => {
    const r = resolveAccessibleFormIds(
      [
        { projectId: null, folderId: null, formId: 'f1', excluded: false },
        { projectId: null, folderId: null, formId: 'f2', excluded: true }, // sin efecto
      ],
      forms,
    );
    expect([...r]).toEqual(['f1']);
  });

  it('carpeta asignada + form excluido dentro', () => {
    const r = resolveAccessibleFormIds(
      [
        { projectId: null, folderId: 'folA', formId: null, excluded: false },
        { projectId: null, folderId: null, formId: 'f1', excluded: true },
      ],
      forms,
    );
    expect([...r]).toEqual(['f2']);
  });
});
```

- [ ] **Step 4: Correr los tests**

```bash
cd backend
npx jest src/forms/assignment-resolver.spec.ts
```

Esperado: 6 tests PASS.

- [ ] **Step 5: Refactorizar `FormsService.getAssignedForms` (y análogos) para usar `resolveAccessibleFormIds`**

Reemplazar la lógica actual `assignments.map(a => a.formId)` por una que:
1. Lee assignments del user (+ sus grupos si aplica).
2. Lee `allForms` con folder/project — probablemente ya hay un método `findAll()` que se puede reusar.
3. Llama `resolveAccessibleFormIds`.

Verificar que no rompa consumers que asumían el formato anterior.

- [ ] **Step 6: Build**

```bash
cd backend
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/forms/forms.service.ts backend/src/forms/assignment-resolver.ts backend/src/forms/assignment-resolver.spec.ts
git commit -m "feat(assignments): resolveAccessibleFormIds con exclusiones + tests"
```

---

### Task 3: Backend endpoint bulk — GET/PUT /users/:id/assignments/tree y /groups/:id/assignments/tree

**Files:**
- Create: `backend/src/forms/assignments-tree.dto.ts`
- Modify: `backend/src/users/users.controller.ts` (agregar GET + PUT `/assignments/tree`)
- Modify: `backend/src/groups/groups.controller.ts` (agregar GET + PUT `/assignments/tree`)
- Modify: `backend/src/users/users.service.ts` o crear `backend/src/forms/assignments-tree.service.ts` (lógica compartida)
- Modify: `backend/src/groups/groups.service.ts`
- Create: `backend/src/forms/assignments-tree.service.spec.ts`

**Interfaces:**
- Consumes: schema del Task 1, resolver del Task 2 (opcional)
- Produces: shape API `{ projects, folders, forms, excludedFolders, excludedForms }` para GET y PUT; endpoint idempotente y validado.

- [ ] **Step 1: Escribir el DTO**

`backend/src/forms/assignments-tree.dto.ts`:

```ts
import { IsArray, IsString } from 'class-validator';

export class AssignmentsTreeDto {
  @IsArray() @IsString({ each: true }) projects: string[];
  @IsArray() @IsString({ each: true }) folders: string[];
  @IsArray() @IsString({ each: true }) forms: string[];
  @IsArray() @IsString({ each: true }) excludedFolders: string[];
  @IsArray() @IsString({ each: true }) excludedForms: string[];
}

export type AssignmentsTreeResponse = AssignmentsTreeDto;
```

- [ ] **Step 2: Escribir el service compartido**

Crear `backend/src/forms/assignments-tree.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserFormAssignment,
  UserFormAssignmentDocument,
} from './user-form-assignment.schema';
import { AssignmentsTreeDto } from './assignments-tree.dto';

type Subject = { userId: number } | { groupId: string };

@Injectable()
export class AssignmentsTreeService {
  constructor(
    @InjectModel(UserFormAssignment.name)
    private readonly model: Model<UserFormAssignmentDocument>,
    // Inyectar también los models de forms/folders/projects para validar
    // existencia y estructura padre-hijo. Usar los existentes; no crear
    // duplicados. Ver forms.service.ts para nombres de InjectModel.
  ) {}

  async read(subject: Subject): Promise<AssignmentsTreeDto> {
    const filter = 'userId' in subject
      ? { userId: subject.userId }
      : { groupId: subject.groupId };
    const rows = await this.model.find(filter).lean();

    return {
      projects: rows.filter(r => !r.excluded && r.projectId).map(r => r.projectId!),
      folders:  rows.filter(r => !r.excluded && r.folderId).map(r => r.folderId!),
      forms:    rows.filter(r => !r.excluded && r.formId).map(r => r.formId!),
      excludedFolders: rows.filter(r => r.excluded && r.folderId).map(r => r.folderId!),
      excludedForms:   rows.filter(r => r.excluded && r.formId).map(r => r.formId!),
    };
  }

  async write(subject: Subject, dto: AssignmentsTreeDto): Promise<{ ok: true }> {
    this.validate(dto);
    // Validar existencia de projects/folders/forms — grep en forms.service y
    // projects.service para reusar sus queries.
    // ...

    const subjKey = 'userId' in subject
      ? { userId: subject.userId }
      : { groupId: subject.groupId };

    // Replace-all: delete + insertMany en una sola transacción lógica.
    // Con la conexión Mongoose puede envolverse en session.withTransaction
    // si el cluster lo soporta; de lo contrario, delete-then-insert es
    // aceptable dado que el endpoint es idempotente.
    await this.model.deleteMany(subjKey);

    const docs: Partial<UserFormAssignment>[] = [
      ...dto.projects.map(id => ({ ...subjKey, projectId: id, excluded: false })),
      ...dto.folders.map(id => ({ ...subjKey, folderId: id, excluded: false })),
      ...dto.forms.map(id => ({ ...subjKey, formId: id, excluded: false })),
      ...dto.excludedFolders.map(id => ({ ...subjKey, folderId: id, excluded: true })),
      ...dto.excludedForms.map(id => ({ ...subjKey, formId: id, excluded: true })),
    ];
    if (docs.length > 0) await this.model.insertMany(docs);
    return { ok: true };
  }

  private validate(dto: AssignmentsTreeDto): void {
    const projSet = new Set(dto.projects);
    const folderSet = new Set(dto.folders);

    // Solape positivo/excluido
    for (const id of dto.excludedForms) {
      if (dto.forms.includes(id)) {
        throw new BadRequestException(
          `Form ${id} no puede estar en 'forms' y 'excludedForms' simultáneamente`,
        );
      }
    }
    for (const id of dto.excludedFolders) {
      if (folderSet.has(id)) {
        throw new BadRequestException(
          `Folder ${id} no puede estar en 'folders' y 'excludedFolders' simultáneamente`,
        );
      }
    }

    // Toda exclusión necesita ancestro positivo. Para eso el service necesita
    // saber la jerarquía real; se resuelve más adelante consultando la DB de
    // forms/folders. Aquí solo hacemos las validaciones puramente sintácticas.
    // La validación de ancestro se hace en write() antes del delete/insert.
  }
}
```

- [ ] **Step 3: Extender validaciones — chequeo de ancestros**

En `write()`, después de `validate(dto)` sintáctica y antes de `deleteMany`, consultar:
1. `folders` (todos) → mapa `folderId → projectId`.
2. `forms` (todos los que aparecen en dto.forms, dto.excludedForms) → mapa `formId → {folderId, projectId}`.

Validaciones:
- Cada `dto.excludedForms[i]`: su form debe existir; su folder o project ancestro debe estar en `dto.folders`/`dto.projects`.
- Cada `dto.excludedFolders[i]`: su folder debe existir; su projectId debe estar en `dto.projects`.
- Cada id en `dto.projects/folders/forms/excludedFolders/excludedForms` debe corresponder a una entidad existente.

Lanzar `BadRequestException` con mensaje claro por cada caso.

- [ ] **Step 4: Escribir tests de service**

`backend/src/forms/assignments-tree.service.spec.ts`:

```ts
describe('AssignmentsTreeService', () => {
  // Setup con mongo-memory-server o mocks del assignmentModel.
  // (Buscar cómo otros tests del proyecto mockean Mongoose para replicar patrón.)

  it('write + read son idempotentes', async () => {
    const dto = { projects: ['p1'], folders: [], forms: [], excludedFolders: ['folA'], excludedForms: ['f5'] };
    await service.write({ userId: 1 }, dto);
    await service.write({ userId: 1 }, dto); // dos veces
    const back = await service.read({ userId: 1 });
    expect(back).toEqual(dto);
    // Y no hay duplicados en la colección:
    const count = await model.countDocuments({ userId: 1 });
    expect(count).toBe(3); // 1 project + 1 excluded folder + 1 excluded form
  });

  it('rechaza excludedForm sin ancestro', async () => {
    await expect(service.write({ userId: 1 }, {
      projects: [], folders: [], forms: [], excludedFolders: [], excludedForms: ['f1'],
    })).rejects.toThrow(/ancestro/i);
  });

  it('rechaza solape forms/excludedForms', async () => {
    await expect(service.write({ userId: 1 }, {
      projects: [], folders: [], forms: ['f1'], excludedFolders: [], excludedForms: ['f1'],
    })).rejects.toThrow(/simultáneamente/i);
  });

  it('rechaza excludedFolder sin projectId ancestro', async () => {
    await expect(service.write({ userId: 1 }, {
      projects: [], folders: [], forms: [], excludedFolders: ['folA'], excludedForms: [],
    })).rejects.toThrow(/ancestro/i);
  });
});
```

Nota: si `mongo-memory-server` no está en devDependencies, en su lugar mockear el `model` con jest y validar las llamadas a `deleteMany`/`insertMany`.

- [ ] **Step 5: Wireup en users.controller.ts**

Agregar dos endpoints:

```ts
@UseGuards(JwtAuthGuard)
@Get(':id/assignments/tree')
async getAssignmentsTree(@Param('id') id: string) {
  return this.assignmentsTreeService.read({ userId: parseInt(id) });
}

@UseGuards(JwtAuthGuard)
@Put(':id/assignments/tree')
async putAssignmentsTree(
  @Param('id') id: string,
  @Body() dto: AssignmentsTreeDto,
) {
  return this.assignmentsTreeService.write({ userId: parseInt(id) }, dto);
}
```

Inyectar `AssignmentsTreeService` en el constructor. Registrar el service en el módulo apropiado (`FormsModule` exporta, `UsersModule` importa).

- [ ] **Step 6: Wireup en groups.controller.ts**

Análogo con `{ groupId: id }` en vez de userId.

- [ ] **Step 7: Correr tests y build**

```bash
cd backend
npx jest src/forms/assignments-tree.service.spec.ts
npm run build
```

Esperado: tests PASS + build clean.

- [ ] **Step 8: Commit**

```bash
git add backend/src/forms/assignments-tree.dto.ts backend/src/forms/assignments-tree.service.ts backend/src/forms/assignments-tree.service.spec.ts backend/src/users/users.controller.ts backend/src/groups/groups.controller.ts
# + cambios en modules
git commit -m "feat(assignments): endpoint bulk /assignments/tree con validaciones e idempotencia"
```

---

### Task 4: Frontend useAssignmentState — sets nuevos + helpers + toggles refactor

**Files:**
- Modify: `src/components/common/assignmentTree/useAssignmentState.ts`
- Create: `src/components/common/assignmentTree/useAssignmentState.spec.ts` (opcional; si el proyecto no tiene infra de tests de hooks, saltar)

**Interfaces:**
- Consumes: nada nuevo del backend en este task (solo estado local del hook)
- Produces: `excludedFolders: Set<string>`, `excludedForms: Set<string>`, `isFormEffectivelyAssigned(formId, folderId, projectId): boolean`, `isFolderEffectivelyAssigned(folderId, projectId): boolean`. `toggleFolder` y `toggleForm` con nueva lógica.

- [ ] **Step 1: Agregar los sets nuevos**

En `useAssignmentState.ts`, junto a los existentes:

```ts
const [excludedFolders, setExcludedFolders] = useState<Set<string>>(new Set());
const [excludedForms, setExcludedForms] = useState<Set<string>>(new Set());
```

Y exportarlos junto con sus setters.

- [ ] **Step 2: Reescribir `toggleFolder`**

```ts
const toggleFolder = (
  folderId: string,
  projectId: string,
  folders: FolderItem[],
) => {
  const projectAssigned = assignedProjects.has(projectId);

  if (projectAssigned) {
    // El proyecto está asignado → toggle exclusión de carpeta.
    setExcludedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
        // Al excluir la carpeta, limpiar excludedForms de sus forms
        // (ya no aportan nada; la carpeta entera está excluida).
        const folder = folders.find((f) => f.id === folderId);
        if (folder) {
          setExcludedForms((pf) => {
            const nf = new Set(pf);
            folder.forms.forEach((fm) => nf.delete(fm.id));
            return nf;
          });
        }
      }
      return next;
    });
    return;
  }

  // Comportamiento actual: toggle en assignedFolders + arrastrar assignedForms.
  setAssignedFolders((prev) => {
    const next = new Set(prev);
    const folder = folders.find((f) => f.id === folderId);
    if (next.has(folderId)) {
      next.delete(folderId);
      if (folder)
        setAssignedForms((pf) => {
          const nf = new Set(pf);
          folder.forms.forEach((fm) => nf.delete(fm.id));
          return nf;
        });
    } else {
      next.add(folderId);
      if (folder)
        setAssignedForms((pf) => {
          const nf = new Set(pf);
          folder.forms.forEach((fm) => nf.add(fm.id));
          return nf;
        });
    }
    return next;
  });
};
```

- [ ] **Step 3: Reescribir `toggleForm`**

```ts
const toggleForm = (formId: string, folderId: string, projectId: string) => {
  const projectAssigned = assignedProjects.has(projectId);
  const folderExcluded = excludedFolders.has(folderId);
  const folderAssigned = assignedFolders.has(folderId);
  const inheritsFromAncestor =
    (projectAssigned && !folderExcluded) || folderAssigned;

  if (folderExcluded) {
    // Carpeta excluida: no permitir togglear forms hasta que se re-incluya.
    return;
  }

  if (inheritsFromAncestor) {
    setExcludedForms((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) next.delete(formId);
      else next.add(formId);
      return next;
    });
    return;
  }

  // Comportamiento actual: toggle directo en assignedForms.
  setAssignedForms((prev) => {
    const next = new Set(prev);
    if (next.has(formId)) next.delete(formId);
    else next.add(formId);
    return next;
  });
};
```

- [ ] **Step 4: Agregar helpers al return**

```ts
const isFolderEffectivelyAssigned = (folderId: string, projectId: string) => {
  const isDirect = assignedFolders.has(folderId);
  const inheritsFromProject = assignedProjects.has(projectId);
  const isExcluded = excludedFolders.has(folderId);
  return (isDirect || inheritsFromProject) && !isExcluded;
};

const isFormEffectivelyAssigned = (
  formId: string,
  folderId: string,
  projectId: string,
) => {
  const isDirect = assignedForms.has(formId);
  const inheritsFromProject =
    assignedProjects.has(projectId) && !excludedFolders.has(folderId);
  const inheritsFromFolder = assignedFolders.has(folderId);
  const isExcluded = excludedForms.has(formId) || excludedFolders.has(folderId);
  return (isDirect || inheritsFromProject || inheritsFromFolder) && !isExcluded;
};
```

- [ ] **Step 5: Extender el return del hook**

```ts
return {
  assignedProjects, assignedFolders, assignedForms,
  excludedFolders, excludedForms,
  expandedProjects,
  setAssignedProjects, setAssignedFolders, setAssignedForms,
  setExcludedFolders, setExcludedForms,
  toggleExpand, toggleProject, toggleFolder, toggleForm,
  isFolderEffectivelyAssigned, isFormEffectivelyAssigned,
};
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 7: Commit**

```bash
git add src/components/common/assignmentTree/useAssignmentState.ts
git commit -m "feat(assignments): useAssignmentState con excludedFolders/Forms + helpers"
```

---

### Task 5: Frontend AssignmentTree — quitar disabled + nuevos badges + copy

**Files:**
- Modify: `src/components/common/assignmentTree/AssignmentTree.tsx`

**Interfaces:**
- Consumes: props extendidas del hook Task 4 (nuevos sets + helpers).
- Produces: UI que permite toggle libre de carpetas y forms; badges "hereda", "excluida", "excluido"; nombres tachados en excluidos.

- [ ] **Step 1: Extender props del componente**

```ts
type AssignmentTreeProps = {
  projects: ProjectItem[];
  folders: FolderItem[];
  assignedProjects: Set<string>;
  assignedFolders: Set<string>;
  assignedForms: Set<string>;
  excludedFolders: Set<string>;
  excludedForms: Set<string>;
  expandedProjects: Set<string>;
  onToggleExpand: (projectId: string) => void;
  onToggleProject: (projectId: string) => void;
  onToggleFolder: (folderId: string, projectId: string) => void;
  onToggleForm: (formId: string, folderId: string, projectId: string) => void;
};
```

- [ ] **Step 2: Refactor `FolderRow`**

Eliminar `isProjectAssigned` disabling. Nueva signature:

```tsx
function FolderRow({
  folder,
  isProjectAssigned,
  isFolderChecked,   // check visual (efectivo)
  isFolderExcluded,  // badge amber + tachado
  onToggle,
}: {
  folder: FolderItem;
  isProjectAssigned: boolean;
  isFolderChecked: boolean;
  isFolderExcluded: boolean;
  onToggle: () => void;
}) {
  const showHeredaTag = isProjectAssigned && !isFolderExcluded;
  return (
    <div
      className="flex items-center gap-2.5 border-t border-slate-100 py-2 pl-10 pr-3.5"
      style={{
        background: isFolderExcluded
          ? '#fff7ed'
          : isFolderChecked ? '#f0fdf4' : '#fafafa',
      }}
    >
      <div
        onClick={onToggle}
        className="flex h-4 w-4 flex-shrink-0 cursor-pointer items-center justify-center rounded-[3px]"
        style={{
          border: `2px solid ${isFolderChecked ? ACCENT : '#d1d5db'}`,
          background: isFolderChecked ? ACCENT : '#fff',
        }}
      >
        {isFolderChecked && (
          <span className="text-[10px] font-bold text-white">✓</span>
        )}
      </div>
      <span className="flex" style={{ color: folder.color }}>
        <EntityIcon icon={folder.icon} size={14} />
      </span>
      <span
        className="flex-1 text-xs font-semibold"
        style={{
          color: isFolderExcluded ? '#9a3412' : isFolderChecked ? '#065f46' : '#374151',
          textDecoration: isFolderExcluded ? 'line-through' : 'none',
        }}
      >
        {folder.name}
      </span>
      {showHeredaTag && (
        <span className="text-[10px] italic text-emerald-700">hereda del proyecto</span>
      )}
      {isFolderExcluded && (
        <span className="rounded-[10px] bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-900">
          excluida
        </span>
      )}
      {!isProjectAssigned && isFolderChecked && (
        <span className="rounded-[10px] bg-emerald-100 px-1.5 py-px text-[10px] font-semibold text-emerald-900">
          Carpeta completa
        </span>
      )}
      <span className="text-[11px] text-gray-400">
        {folder.forms.length} forms
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Refactor `FormRow`**

Análogo. Signature nueva:

```tsx
function FormRow({
  name,
  isChecked,
  isExcluded,
  isInheritedFromAncestor,   // ancestro asignado
  isBlockedByFolderExclusion, // folder padre excluido → form no toggle-able
  onToggle,
}: {
  name: string;
  isChecked: boolean;
  isExcluded: boolean;
  isInheritedFromAncestor: boolean;
  isBlockedByFolderExclusion: boolean;
  onToggle: () => void;
})
```

Comportamiento visual:
- `isBlockedByFolderExclusion` → checkbox gris + tag *"carpeta excluida"* + cursor default.
- `isExcluded` → check vacío + fondo `#fff7ed` + nombre tachado + badge amber `excluido`.
- `isChecked && isInheritedFromAncestor` → check verde + tag *"hereda"*.
- `isChecked && !isInheritedFromAncestor` → check verde (sin tag).
- Sino → check vacío.

- [ ] **Step 4: Refactor el body del componente principal**

Usar los helpers desde props para computar los flags de cada row:

```tsx
{projectFolders.map((folder) => {
  const isFolderChecked =
    (isProjAssigned && !excludedFolders.has(folder.id)) ||
    assignedFolders.has(folder.id);
  const isFolderExcluded = excludedFolders.has(folder.id);
  return (
    <div key={folder.id}>
      <FolderRow
        folder={folder}
        isProjectAssigned={isProjAssigned}
        isFolderChecked={isFolderChecked}
        isFolderExcluded={isFolderExcluded}
        onToggle={() => onToggleFolder(folder.id, project.id)}
      />
      {folder.forms.map((form) => {
        const inheritsFromProject = isProjAssigned && !isFolderExcluded;
        const inheritsFromFolder = assignedFolders.has(folder.id);
        const inheritsFromAncestor = inheritsFromProject || inheritsFromFolder;
        const isDirect = assignedForms.has(form.id);
        const isExcluded = excludedForms.has(form.id) || isFolderExcluded;
        const isChecked = (isDirect || inheritsFromAncestor) && !isExcluded;
        return (
          <FormRow
            key={form.id}
            name={form.name}
            isChecked={isChecked}
            isExcluded={excludedForms.has(form.id) && !isFolderExcluded}
            isInheritedFromAncestor={inheritsFromAncestor}
            isBlockedByFolderExclusion={isFolderExcluded}
            onToggle={() => onToggleForm(form.id, folder.id, project.id)}
          />
        );
      })}
    </div>
  );
})}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 6: Commit**

```bash
git add src/components/common/assignmentTree/AssignmentTree.tsx
git commit -m "feat(assignments): AssignmentTree sin disabled + badges de exclusion"
```

---

### Task 6: Frontend AssignmentsTab + GroupAssignmentsPanel — migrar a bulk endpoint

**Files:**
- Modify: `src/services/api.ts` (agregar `getUserAssignmentsTreeApi`, `putUserAssignmentsTreeApi`, `getGroupAssignmentsTreeApi`, `putGroupAssignmentsTreeApi`)
- Modify: `src/components/users/AssignmentsTab.tsx`
- Modify: `src/components/groups/GroupAssignmentsPanel.tsx`

**Interfaces:**
- Consumes: endpoint del Task 3, hook del Task 4, componente del Task 5.
- Produces: UI conectada. Carga en 1 request; guardado en 1 request.

- [ ] **Step 1: Agregar los 4 métodos en `services/api.ts`**

Buscar dónde están `assignFormToUserApi` etc. y agregar al mismo nivel:

```ts
export type AssignmentsTreeDto = {
  projects: string[];
  folders: string[];
  forms: string[];
  excludedFolders: string[];
  excludedForms: string[];
};

export const getUserAssignmentsTreeApi = (userId: number) =>
  api.get<AssignmentsTreeDto>(`/users/${userId}/assignments/tree`);

export const putUserAssignmentsTreeApi = (
  userId: number,
  body: AssignmentsTreeDto,
) => api.put<{ ok: true }>(`/users/${userId}/assignments/tree`, body);

export const getGroupAssignmentsTreeApi = (groupId: string) =>
  api.get<AssignmentsTreeDto>(`/groups/${groupId}/assignments/tree`);

export const putGroupAssignmentsTreeApi = (
  groupId: string,
  body: AssignmentsTreeDto,
) => api.put<{ ok: true }>(`/groups/${groupId}/assignments/tree`, body);
```

- [ ] **Step 2: Refactor `AssignmentsTab.tsx` carga**

Reemplazar el bloque de `useEffect` que hace N calls por:

```tsx
useEffect(() => {
  const load = async () => {
    setLoading(true);
    const res = await getUserAssignmentsTreeApi(userId);
    const tree = res.data;
    state.setAssignedProjects(new Set(tree.projects));
    state.setAssignedFolders(new Set(tree.folders));
    state.setAssignedForms(new Set(tree.forms));
    state.setExcludedFolders(new Set(tree.excludedFolders));
    state.setExcludedForms(new Set(tree.excludedForms));
    setLoading(false);
  };
  if (userId) load();
}, [userId]);
```

Eliminar el efecto de projects/folders (siguen siendo necesarios para el árbol visual, mantener esos). Eliminar el bloque que derivaba `folderIds` empíricamente (ahora viene del backend).

- [ ] **Step 3: Refactor `AssignmentsTab.tsx` guardado**

Reemplazar el `handleSave` entero por:

```tsx
const handleSave = async () => {
  setSaving(true);
  await putUserAssignmentsTreeApi(userId, {
    projects: [...state.assignedProjects],
    folders: [...state.assignedFolders],
    forms: [...state.assignedForms],
    excludedFolders: [...state.excludedFolders],
    excludedForms: [...state.excludedForms],
  });
  setSaving(false);
  setSaved(true);
  setTimeout(() => setSaved(false), 2000);
};
```

Eliminar imports viejos (`assignProjectToUserApi`, `unassignProjectFromUserApi`, `assignFormToUserApi`, `unassignFormFromUserApi`, `getProjectAssignmentsApi`, `getFormAssignmentsApi`) — pero solo si NO se usan en otro lado del archivo. Verificar.

- [ ] **Step 4: Pasar props nuevas al `AssignmentTree`**

```tsx
<AssignmentTree
  projects={projects}
  folders={folders}
  assignedProjects={state.assignedProjects}
  assignedFolders={state.assignedFolders}
  assignedForms={state.assignedForms}
  excludedFolders={state.excludedFolders}
  excludedForms={state.excludedForms}
  expandedProjects={state.expandedProjects}
  onToggleExpand={state.toggleExpand}
  onToggleProject={state.toggleProject}
  onToggleFolder={(folderId, projectId) =>
    state.toggleFolder(folderId, projectId, folders)
  }
  onToggleForm={state.toggleForm}
/>
```

- [ ] **Step 5: Ídem para `GroupAssignmentsPanel.tsx`**

Mismo patrón: reemplazar carga y guardado por `getGroupAssignmentsTreeApi` y `putGroupAssignmentsTreeApi`; pasar props extra al AssignmentTree.

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 7: Commit**

```bash
git add src/services/api.ts src/components/users/AssignmentsTab.tsx src/components/groups/GroupAssignmentsPanel.tsx
git commit -m "feat(assignments): AssignmentsTab y GroupAssignmentsPanel usan bulk endpoint"
```

---

## Notas para el ejecutor SDD

- **Task 1 y 2 son backend-first**. No dispatch al frontend hasta que 1-2-3 estén verdes.
- **Tests requeridos**: Task 2 (resolver) y Task 3 (bulk service). Los demás son sin test unitario (validación E2E manual).
- **Model selection recomendado**: Task 1 (haiku — mecánico), Task 2 (sonnet — lógica), Task 3 (sonnet — integración), Task 4 (haiku — mecánico), Task 5 (sonnet — UI), Task 6 (haiku — cableado).
- **Whole-branch final review** al terminar los 6 tasks: opus.
- **E2E manual** al final (Task 7 implícito): reiniciar backend + validar en browser los escenarios A-D del spec.
