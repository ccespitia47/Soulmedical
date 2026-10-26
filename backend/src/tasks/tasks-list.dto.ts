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

/** Página de TasksService.listByForm() (pestaña "Reportes" de Tareas). */
export type TaskSummaryPageDto = {
  data: TaskSummaryDto[];
  total: number;
  page: number;
  limit: number;
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
  /** Correo del respondent que envió esta submission (si aplica). Permite
   * matchear submission → destinatario en la tabla de reportes. */
  respondentEmail?: string;
  /** Data cruda del formulario para leer valores de widgets como quiz_score. */
  data?: Record<string, string>;
};

export type TaskScoreWidgetDto = {
  id: string;
  label: string;
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
  /** Widgets tipo "quiz_score" del formulario. Si tiene al menos uno, el
   * frontend agrega columna Nota + tarjeta Promedio. */
  scoreWidgets: TaskScoreWidgetDto[];
};
