import { IsBoolean, IsOptional } from 'class-validator';

export class CreateTaskStepDto {
  recipientEmail: string;
  recipientName?: string;
  // Nuevo: lista completa de emails que responden ESTE paso en paralelo
  // (incluyendo al primario). Si viene vacía/undefined, se toma
  // [recipientEmail] para compat con clientes viejos.
  recipientEmails?: string[];
}

export class CreateTaskDto {
  formId: string;
  folderId: string;
  formName: string;
  title: string;
  description?: string;
  prefilledData: Record<string, string>;
  steps: CreateTaskStepDto[];
  widgets?: Record<string, unknown>[];
  rules?: Record<string, unknown>[];
  emailTemplate?: Record<string, unknown> | null;
  // Snapshot del array multi-template. Si viene con items, es la fuente
  // de verdad; `emailTemplate` singular queda como fallback para tareas
  // creadas desde forms viejos todavía no migrados.
  emailTemplates?: Record<string, unknown>[];

  @IsBoolean()
  @IsOptional()
  generateShareLink?: boolean;

  @IsBoolean()
  @IsOptional()
  oneShotLink?: boolean;
}

export type SubmitAttachment = {
  name: string;
  contentType: string;
  contentBytes: string;
  // Opcional: id de la configuración de email a la que pertenece este
  // adjunto. Cuando la tarea tiene multiples templates, cada uno genera
  // su propio PDF; esto permite enrutar cada attachment al dispatch
  // correcto en sendCompletionEmail. Si viene undefined, el adjunto se
  // comparte con todas las configuraciones (compat con cliente viejo
  // single-template).
  templateId?: string;
};

export class SubmitTaskStepDto {
  formData: Record<string, string>;
  attachments?: SubmitAttachment[];
}