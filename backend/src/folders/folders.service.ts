import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Folder, FolderDocument } from './folder.schema';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

@Injectable()
export class FoldersService {
  constructor(
    @InjectModel(Folder.name) private readonly folderModel: Model<FolderDocument>,
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
