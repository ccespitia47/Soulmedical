import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FormSubmission, FormSubmissionDocument } from './form-submission.schema';
import { FormsService } from '../forms/forms.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

export interface SubmissionsPage {
  data: FormSubmissionDocument[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectModel(FormSubmission.name) private readonly submissionModel: Model<FormSubmissionDocument>,
    private readonly formsService: FormsService,
  ) {}

  async submit(formId: string, dto: CreateSubmissionDto, userId?: number): Promise<FormSubmissionDocument> {
    const form = await this.formsService.findOne(formId);
    const submission = new this.submissionModel({
      formId,
      formVersion: form.version,
      data: dto.data,
      metadata: dto.metadata ?? null,
      submittedById: userId ?? null,
    });
    return submission.save();
  }

  async findByForm(formId: string, page = 1, limit = 50): Promise<SubmissionsPage> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.submissionModel.find({ formId }).sort({ submittedAt: -1 }).skip(skip).limit(limit),
      this.submissionModel.countDocuments({ formId }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<FormSubmissionDocument> {
    const submission = await this.submissionModel.findById(id);
    if (!submission) throw new NotFoundException(`Respuesta ${id} no encontrada`);
    return submission;
  }

  async findAll(page = 1, limit = 50): Promise<SubmissionsPage> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.submissionModel.find().sort({ submittedAt: -1 }).skip(skip).limit(limit),
      this.submissionModel.countDocuments(),
    ]);
    return { data, total, page, limit };
  }

  async countByForm(formId: string): Promise<number> {
    return this.submissionModel.countDocuments({ formId });
  }
}
