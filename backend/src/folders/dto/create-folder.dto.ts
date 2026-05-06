import { IsString, IsNotEmpty, IsUUID, MaxLength, IsOptional } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  projectId: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  color?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  icon?: string;
}
