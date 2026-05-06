import { IsObject, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSubmissionDto {
  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
