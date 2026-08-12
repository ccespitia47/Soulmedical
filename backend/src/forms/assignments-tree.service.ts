import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserFormAssignment,
  UserFormAssignmentDocument,
} from './user-form-assignment.schema';
import { Form, FormDocument } from './form.schema';
import { Folder, FolderDocument } from '../folders/folder.schema';
import { Project, ProjectDocument } from '../projects/project.schema';
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

  async write(subject: Subject, dto: AssignmentsTreeDto): Promise<{ ok: true }> {
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
