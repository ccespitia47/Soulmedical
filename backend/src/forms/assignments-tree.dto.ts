import { IsArray, IsString } from 'class-validator';

export class AssignmentsTreeDto {
  @IsArray() @IsString({ each: true }) projects: string[];
  @IsArray() @IsString({ each: true }) folders: string[];
  @IsArray() @IsString({ each: true }) forms: string[];
  @IsArray() @IsString({ each: true }) excludedFolders: string[];
  @IsArray() @IsString({ each: true }) excludedForms: string[];
}

export type AssignmentsTreeResponse = AssignmentsTreeDto;
