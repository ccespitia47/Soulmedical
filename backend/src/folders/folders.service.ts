import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Folder, FolderDocument } from './folder.schema';
import { Form, FormDocument } from '../forms/form.schema';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

/**
 * Fila de folder enriquecida con la lista de forms (resumen) y el conteo
 * total — es lo que consume el sidebar del HomePage (ver findByProjectWithForms).
 * No usa el documento Mongoose directo porque agregamos campos derivados.
 */
export type FolderWithForms = Folder & {
  _id: string;
  forms: Array<{
    _id: string;
    name: string;
    isActive: boolean;
    folderId: string;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
  formsCount: number;
};

@Injectable()
export class FoldersService {
  constructor(
    @InjectModel(Folder.name) private readonly folderModel: Model<FolderDocument>,
    @InjectModel(Form.name) private readonly formModel: Model<FormDocument>,
  ) {}

  async create(dto: CreateFolderDto): Promise<FolderDocument> {
    const folder = new this.folderModel({
      name: dto.name,
      projectId: dto.projectId,
      color: dto.color ?? '#00c2a8',
      icon: dto.icon ?? '📁',
    });
    return folder.save();
  }

  async findByProject(projectId: string): Promise<FolderDocument[]> {
    return this.folderModel.find({ projectId, isActive: true }).sort({ createdAt: 1 });
  }

  /**
   * Devuelve las carpetas del proyecto con un resumen de sus forms anidado
   * (solo campos livianos — SIN schema/widgets/emailTemplate). Un solo query
   * reemplaza el patrón N+1 que hacía el frontend: `getFoldersByProject` +
   * `getFormsByFolder` por cada carpeta. Con esto el sidebar aparece
   * instantáneo y con el conteo correcto desde el primer frame.
   *
   * El schema completo del form se sigue trayendo cuando el usuario abre
   * un formulario específico vía `GET /forms/:id` — ese flujo no cambia.
   */
  async findByProjectWithForms(projectId: string): Promise<FolderWithForms[]> {
    const rows = await this.folderModel.aggregate<FolderWithForms>([
      { $match: { projectId, isActive: true } },
      { $sort: { createdAt: 1 } },
      {
        $lookup: {
          from: 'forms',
          let: { fid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$folderId', '$$fid'] },
                    { $eq: ['$isActive', true] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 1,
                // El esquema Mongoose expone `id` camelCase vía toJSON; como
                // el aggregate devuelve raw sin pasar por toJSON, lo
                // sintetizamos aquí para que el frontend (que lee `f.id`) no
                // reciba undefined y pueda renderizar los forms del summary.
                id: '$_id',
                name: 1,
                isActive: 1,
                folderId: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
            { $sort: { createdAt: 1 } },
          ],
          as: 'forms',
        },
      },
      {
        $addFields: {
          id: '$_id',
          formsCount: { $size: '$forms' },
        },
      },
    ]);
    return rows;
  }

  async findOne(id: string): Promise<FolderDocument> {
    const folder = await this.folderModel.findById(id);
    if (!folder || !folder.isActive) throw new NotFoundException(`Carpeta ${id} no encontrada`);
    return folder;
  }

  async update(id: string, dto: UpdateFolderDto): Promise<FolderDocument> {
    const folder = await this.findOne(id);
    Object.assign(folder, dto);
    return folder.save();
  }

  async remove(id: string): Promise<void> {
    const folder = await this.findOne(id);
    folder.isActive = false;
    await folder.save();
  }
}
