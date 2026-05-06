import { IsString, IsOptional, IsObject } from 'class-validator';

export class UpdateFormDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsOptional()
  schema?: object;

  @IsObject()
  @IsOptional()
  emailTemplate?: object;
}
