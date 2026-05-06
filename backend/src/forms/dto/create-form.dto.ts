import { IsString, IsNotEmpty, IsUUID, IsOptional, IsObject } from 'class-validator';

export class CreateFormDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  folderId: string;

  @IsObject()
  @IsOptional()
  schema?: object;

  @IsObject()
  @IsOptional()
  emailTemplate?: object;
}
