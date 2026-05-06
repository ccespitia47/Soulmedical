import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Form, FormDocument } from './form.schema';
import { UserFormAssignment, UserFormAssignmentDocument } from './user-form-assignment.schema';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';

@Injectable()
export class FormsService {
  constructor(
    @InjectModel(Form.name) private readonly formModel: Model<FormDocument>,
    @InjectModel(UserFormAssignment.name) private readonly assignmentModel: Model<UserFormAssignmentDocument>,
  ) {}

  async create(dto: CreateFormDto, userId: number): Promise<FormDocument> {
    const form = new this.formModel({
      name: dto.name,
      folderId: dto.folderId,
      schema: dto.schema ?? { widgets: [] },
      emailTemplate: dto.emailTemplate ?? null,
      createdById: userId,
    });
    return form.save();
  }

  async findByFolder(folderId: string): Promise<FormDocument[]> {
    return this.formModel.find({ folderId, isActive: true }).sort({ createdAt: 1 });
  }

  async findAssignedToUser(userId: number): Promise<FormDocument[]> {
    const assignments = await this.assignmentModel.find({ userId });
    const formIds = assignments.map((a) => a.formId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.formModel as any).find({ _id: { $in: formIds }, isActive: true }).sort({ createdAt: 1 });
  }

  async findOne(id: string): Promise<FormDocument> {
    const form = await this.formModel.findById(id);
    if (!form || !form.isActive) throw new NotFoundException(`Formulario ${id} no encontrado`);
    return form;
  }

  async update(id: string, dto: UpdateFormDto): Promise<FormDocument> {
    const form = await this.findOne(id);
    if (dto.name !== undefined) form.name = dto.name;
    if (dto.emailTemplate !== undefined) form.emailTemplate = dto.emailTemplate as Record<string, unknown>;
    if (dto.schema !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (form as any).schema = dto.schema;
      form.version += 1;
    }
    return form.save();
  }

  async remove(id: string): Promise<void> {
    const form = await this.findOne(id);
    form.isActive = false;
    await form.save();
  }

  async assignUser(formId: string, userId: number): Promise<UserFormAssignmentDocument> {
    const exists = await this.assignmentModel.findOne({ formId, userId });
    if (exists) throw new ConflictException('El usuario ya está asignado a este formulario');
    const assignment = new this.assignmentModel({ formId, userId });
    return assignment.save();
  }

  async unassignUser(formId: string, userId: number): Promise<void> {
    await this.assignmentModel.deleteOne({ formId, userId });
  }

  async getAssignedUsers(formId: string): Promise<UserFormAssignmentDocument[]> {
    return this.assignmentModel.find({ formId });
  }
}
