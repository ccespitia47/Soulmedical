export class CreateTaskStepDto {
  recipientEmail: string;
  recipientName?: string;
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
}

export type SubmitAttachment = {
  name: string;
  contentType: string;
  contentBytes: string;
};

export class SubmitTaskStepDto {
  formData: Record<string, string>;
  attachments?: SubmitAttachment[];
}