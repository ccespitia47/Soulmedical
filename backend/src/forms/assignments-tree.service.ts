import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserFormAssignment,
  UserFormAssignmentDocument,
} from './user-form-assignment.schema';
import { Form, FormDocument } from './form.schema';
import { Folder, FolderDocument } from '../folders/folder.schema';
import { Project, ProjectDocument } from '../projects/project.schema';
import { Group, GroupDocument } from '../groups/group.schema';
import { UsersService } from '../users/users.service';
import { AssignmentsTreeDto } from './assignments-tree.dto';

type Subject = { userId: number } | { groupId: string };

/**
 * Lectura/escritura bulk del árbol de asignaciones (proyectos, carpetas,
 * forms directos + exclusiones de carpeta/form) para un user o un group.
 *
 * `write()` hace un replace-all (delete + insert) del set de assignments
 * del subject — es idempotente: llamarlo 2x con el mismo DTO no duplica
 * filas porque siempre parte de borrar todo lo del subject primero.
 */
@Injectable()
export class AssignmentsTreeService {
  constructor(
    @InjectModel(UserFormAssignment.name)
    private readonly model: Model<UserFormAssignmentDocument>,
    @InjectModel(Form.name)
    private readonly formModel: Model<FormDocument>,
    @InjectModel(Folder.name)
    private readonly folderModel: Model<FolderDocument>,
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
    // Group vive en Mongoose (GroupsModule) — se registra también en
    // FormsModule.forFeature (mismo patrón que Folder/Project) para no
    // tener que importar GroupsModule entero y evitar un ciclo nuevo
    // (GroupsModule ya importa FormsModule).
    @InjectModel(Group.name)
    private readonly groupModel: Model<GroupDocument>,
    // User vive en TypeORM/Postgres (no Mongoose), así que reusamos
    // UsersService.findById en vez de inyectar un repository aparte —
    // UsersService ya está disponible porque FormsModule importa
    // UsersModule (forwardRef) para el flujo de OTP de forms públicos.
    private readonly usersService: UsersService,
  ) {}

  async read(subject: Subject): Promise<AssignmentsTreeDto> {
    const filter = this.subjectFilter(subject);
    const rows = await this.model.find(filter).lean();

    return {
      projects: rows.filter((r) => !r.excluded && r.projectId).map((r) => r.projectId!),
      folders: rows.filter((r) => !r.excluded && r.folderId).map((r) => r.folderId!),
      forms: rows.filter((r) => !r.excluded && r.formId).map((r) => r.formId!),
      excludedFolders: rows.filter((r) => r.excluded && r.folderId).map((r) => r.folderId!),
      excludedForms: rows.filter((r) => r.excluded && r.formId).map((r) => r.formId!),
    };
  }

  /**
   * Reemplaza toda la config de assignments del subject de forma idempotente:
   * dos llamadas iguales dejan el mismo estado en DB.
   *
   * NO ATÓMICO ante concurrencia: si dos PUT distintos llegan al mismo subject
   * simultáneamente (dos pestañas del mismo admin editando), el resultado puede
   * ser la unión de ambos payloads en vez del último. Aceptable en el uso
   * actual (admin edita en una sola tab, no hay editor multiusuario). Si el
   * despliegue Mongo soporta transacciones, envolver deleteMany+insertMany en
   * `session.withTransaction(...)` cierra la ventana.
   */
  async write(subject: Subject, dto: AssignmentsTreeDto): Promise<{ ok: true }> {
    await this.validateSubjectExists(subject);
    this.validateSyntax(dto);
    await this.validateAncestors(dto);

    const subjKey = this.subjectFilter(subject);

    // Replace-all: delete + insertMany. El endpoint es idempotente porque
    // siempre parte de borrar todo lo existente del subject antes de
    // reinsertar el set completo del DTO — llamarlo 2x con el mismo payload
    // deja exactamente los mismos documentos (no acumula duplicados).
    await this.model.deleteMany(subjKey);

    const docs: Partial<UserFormAssignment>[] = [
      ...new Set(dto.projects).values(),
    ].map((id) => ({ ...subjKey, projectId: id, excluded: false }));
    docs.push(
      ...[...new Set(dto.folders)].map((id) => ({ ...subjKey, folderId: id, excluded: false })),
    );
    docs.push(
      ...[...new Set(dto.forms)].map((id) => ({ ...subjKey, formId: id, excluded: false })),
    );
    docs.push(
      ...[...new Set(dto.excludedFolders)].map((id) => ({
        ...subjKey,
        folderId: id,
        excluded: true,
      })),
    );
    docs.push(
      ...[...new Set(dto.excludedForms)].map((id) => ({
        ...subjKey,
        formId: id,
        excluded: true,
      })),
    );

    if (docs.length > 0) await this.model.insertMany(docs);
    return { ok: true };
  }

  private subjectFilter(subject: Subject): { userId: number } | { groupId: string } {
    return 'userId' in subject ? { userId: subject.userId } : { groupId: subject.groupId };
  }

  /**
   * Existence check del subject: si no existe, 404 antes de escribir nada.
   * Sin esto, `PUT /users/99999/assignments/tree` (o un groupId borrado)
   * retornaba 200 y dejaba assignments huérfanos en la colección.
   */
  private async validateSubjectExists(subject: Subject): Promise<void> {
    if ('userId' in subject) {
      const user = await this.usersService.findById(subject.userId);
      if (!user) {
        throw new NotFoundException(`Usuario ${subject.userId} no encontrado`);
      }
    } else {
      const group = await this.groupModel.findById(subject.groupId).lean();
      if (!group || group.isActive === false) {
        throw new NotFoundException(`Grupo ${subject.groupId} no encontrado o inactivo`);
      }
    }
  }

  /** Validaciones puramente sintácticas del DTO (sin tocar la DB). */
  private validateSyntax(dto: AssignmentsTreeDto): void {
    const folderSet = new Set(dto.folders);

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
  }

  /**
   * Valida existencia en DB de todos los ids referenciados y que cada
   * exclusión tenga su ancestro positivo correspondiente:
   * - excludedForms[i]: su form debe existir y su folder o project ancestro
   *   debe estar en dto.folders / dto.projects.
   * - excludedFolders[i]: su folder debe existir y su projectId ancestro
   *   debe estar en dto.projects.
   */
  private async validateAncestors(dto: AssignmentsTreeDto): Promise<void> {
    const projectIds = new Set(dto.projects);
    const folderIdsInput = new Set([...dto.folders, ...dto.excludedFolders]);
    const formIdsInput = new Set([...dto.forms, ...dto.excludedForms]);

    type LeanForm = { _id: string; folderId: string };
    type LeanFolder = { _id: string; projectId: string };
    type LeanProject = { _id: string };

    const forms: LeanForm[] = await (this.formModel as any)
      .find({ _id: { $in: [...formIdsInput] } })
      .lean();
    const formById = new Map<string, LeanForm>(forms.map((f) => [f._id, f]));
    for (const id of formIdsInput) {
      if (!formById.has(id)) {
        throw new BadRequestException(`El formulario ${id} no existe`);
      }
    }

    // Incluimos también las carpetas ancestro de los forms consultados para
    // poder resolver su projectId sin hacer una segunda query por form.
    const allFolderIds = new Set([
      ...folderIdsInput,
      ...forms.map((f) => f.folderId).filter(Boolean),
    ]);
    const folders: LeanFolder[] = await (this.folderModel as any)
      .find({ _id: { $in: [...allFolderIds] } })
      .lean();
    const folderById = new Map<string, LeanFolder>(folders.map((f) => [f._id, f]));
    for (const id of folderIdsInput) {
      if (!folderById.has(id)) {
        throw new BadRequestException(`La carpeta ${id} no existe`);
      }
    }

    const projects: LeanProject[] = await (this.projectModel as any)
      .find({ _id: { $in: [...projectIds] } })
      .lean();
    const foundProjectIds = new Set(projects.map((p) => p._id));
    for (const id of projectIds) {
      if (!foundProjectIds.has(id)) {
        throw new BadRequestException(`El proyecto ${id} no existe`);
      }
    }

    for (const id of dto.excludedFolders) {
      const folder = folderById.get(id);
      if (!folder || !projectIds.has(folder.projectId)) {
        throw new BadRequestException(
          `La carpeta excluida ${id} no tiene un proyecto ancestro asignado en 'projects'`,
        );
      }
    }

    // Nota: si excludedForms[i] tiene su folder también en excludedFolders,
    // es redundante (la carpeta ya bloquea). Se acepta silenciosamente porque
    // el resolver ignora la redundancia sin cambiar el resultado de acceso.
    for (const id of dto.excludedForms) {
      const form = formById.get(id);
      const folderAncestorOk = !!form && dto.folders.includes(form.folderId);
      const folder = form ? folderById.get(form.folderId) : undefined;
      const projectAncestorOk = !!folder && projectIds.has(folder.projectId);
      if (!folderAncestorOk && !projectAncestorOk) {
        throw new BadRequestException(
          `El formulario excluido ${id} no tiene un proyecto o carpeta ancestro asignado`,
        );
      }
    }
  }
}
