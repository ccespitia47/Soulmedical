import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Project, ProjectDocument } from './project.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
  ) {}

  async create(dto: CreateProjectDto, userId: number): Promise<ProjectDocument> {
    const project = new this.projectModel({
      name: dto.name,
      color: dto.color ?? '#00c2a8',
      icon: dto.icon ?? '🏢',
      ownerId: userId,
    });
    return project.save();
  }

  async findAll(userId: number, role: string): Promise<ProjectDocument[]> {
    const filter = role === 'admin'
      ? { isActive: true }
      : { isActive: true, ownerId: userId };
    return this.projectModel.find(filter).sort({ createdAt: -1 });
  }

  async findOne(id: string): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(id);
    if (!project || !project.isActive) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, userId: number, role: string): Promise<ProjectDocument> {
    const project = await this.findOne(id);
    if (role !== 'admin' && project.ownerId !== userId) {
      throw new ForbiddenException('No tienes permiso para modificar este proyecto');
    }
    Object.assign(project, dto);
    return project.save();
  }

  async remove(id: string, userId: number, role: string): Promise<void> {
    const project = await this.findOne(id);
    if (role !== 'admin' && project.ownerId !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar este proyecto');
    }
    project.isActive = false;
    await project.save();
  }
}
