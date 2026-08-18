// DTOs de solo lectura para la pestaña "Reportes" de Tareas (Task 2 del plan
// 2026-08-11-tasks-optional-link-and-reports-tab). No son class-validator
// DTOs de entrada (no hay body que validar) — son shapes de salida de
// TasksService.listByForm() y TasksService.getDetail().

export type TaskSummaryDto = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  createdByName: string;
  totalRecipients: number;
  completedCount: number;
  pendingCount: number;
  hasShareLink: boolean;
};

export type TaskRecipientDto = {
  stepIndex: number;
  email: string;
  name: string;
  status: 'in_progress' | 'pending' | 'completed';
  submittedAt: string | null;
  canResend: boolean;
  lastResendAt: string | null;
};

export type TaskSubmissionDto = {
  id: string;
  submittedAt: string;
  userName: string;
  hasPdf: boolean;
  summary: Record<string, string>;
};

export type TaskDetailDto = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  createdByName: string;
  shareLinkUrl: string | null;
  shareLinkOneShot: boolean;
  recipients: TaskRecipientDto[];
  submissions: TaskSubmissionDto[];
  /** Cuántos externos diligenciaron la tarea vía el enlace compartible. */
  externalCount: number;
};
