import { IsString, IsOptional, IsObject, IsArray } from 'class-validator';

export class UpdateFormDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsOptional()
  schema?: object;

  // LEGACY: configuración singular de email. Se mantiene mientras existan
  // formularios creados antes de que `emailTemplates[]` se adoptara.
  @IsObject()
  @IsOptional()
  emailTemplate?: object;

  // Múltiples configuraciones de email por formulario. Si se envía, el
  // backend la toma como fuente de verdad (ver forms.service.submitPublic).
  @IsArray()
  @IsOptional()
  emailTemplates?: Record<string, unknown>[];
}
