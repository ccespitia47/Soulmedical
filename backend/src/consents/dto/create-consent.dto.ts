import {
  IsEnum, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength,
} from 'class-validator';
import { ENTIDADES, Entidad, TipoConsentimiento } from '../consent-record.schema';

export class CreateConsentDto {
  @IsEnum(TipoConsentimiento)
  tipo: TipoConsentimiento;

  @IsOptional()
  @IsIn(ENTIDADES as unknown as string[])
  entidad?: Entidad;

  @IsString() @IsNotEmpty() @MaxLength(20)
  tipoDoc: string;

  @IsString() @IsNotEmpty() @MaxLength(40)
  numDoc: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  nombres: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  apellidos: string;

  @IsOptional() @IsString() @MaxLength(120)
  ciudad?: string;

  @IsOptional() @IsString() @MaxLength(160)
  profesional?: string;

  @IsObject()
  respuestas: Record<string, unknown>;

  // data URL (nueva firma) o referencia gridfs:<id> (edición). Obligatoria.
  @IsString() @IsNotEmpty()
  firmaPaciente: string;

  @IsOptional() @IsString()
  firmaResponsable?: string;

  @IsOptional() @IsString()
  foto?: string;
}
