import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Project, ProjectDocument } from './project.schema';
import { UserFormAssignment, UserFormAssignmentDocument } from '../forms/user-form-assignment.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(UserFormAssignment.name) private readonly assignmentModel: Model<UserFormAssignmentDocument>,
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
    if (role === 'admin') {
      return this.projectModel.find({ isActive: true }).sort({ createdAt: -1 });
    }
    const assignments = await this.assignmentModel.find({ userId });
    const assignedIds = assignments.map((a) => a.projectId).filter(Boolean);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.projectModel as any).find({ isActive: true, _id: { $in: assignedIds } }).sort({ createdAt: -1 });
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

  async assignUser(projectId: string, userId: number): Promise<UserFormAssignmentDocument> {
    await this.findOne(projectId);
    const exists = await this.assignmentModel.findOne({ projectId, userId });
    if (exists) throw new ConflictException('El usuario ya está asignado a este proyecto');
    const assignment = new this.assignmentModel({ projectId, userId });
    return assignment.save();
  }

  async unassignUser(projectId: string, userId: number): Promise<void> {
    await this.assignmentModel.deleteOne({ projectId, userId });
  }

  async getAssignedUsers(projectId: string): Promise<UserFormAssignmentDocument[]> {
    return this.assignmentModel.find({ projectId });
  }
}