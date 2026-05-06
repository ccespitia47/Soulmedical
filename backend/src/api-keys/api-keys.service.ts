import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { ApiKey, ApiKeyDocument } from './api-key.schema';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectModel(ApiKey.name) private readonly apiKeyModel: Model<ApiKeyDocument>,
  ) {}

  async create(dto: CreateApiKeyDto, userId: number): Promise<ApiKeyDocument> {
    const key = 'sk_' + randomBytes(32).toString('hex');
    const apiKey = new this.apiKeyModel({
      key,
      name: dto.name,
      createdById: userId,
    });
    return apiKey.save();
  }

  async findAll(): Promise<ApiKeyDocument[]> {
    return this.apiKeyModel.find().sort({ createdAt: -1 });
  }

  async revoke(id: string): Promise<void> {
    const apiKey = await this.apiKeyModel.findById(id);
    if (!apiKey) throw new NotFoundException(`API Key ${id} no encontrada`);
    apiKey.isActive = false;
    await apiKey.save();
  }
}
