import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Catálogo de acciones auditables. Si se añade una nueva acción aquí,
 * sincronizar con el frontend (auth/admin-audit labels) para que la UI
 * muestre etiquetas legibles.
 */
export enum AdminActionType {
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_TOGGLE_ACTIVE = 'USER_TOGGLE_ACTIVE',
  USER_PERMISSIONS_CHANGE = 'USER_PERMISSIONS_CHANGE',
  USER_RESET_2FA = 'USER_RESET_2FA',
  FORM_DELETE = 'FORM_DELETE',
  FORM_TOGGLE_PUBLIC = 'FORM_TOGGLE_PUBLIC',
  REPORT_REQUESTED = 'REPORT_REQUESTED',
  REPORT_DOWNLOADED = 'REPORT_DOWNLOADED',
  REPORT_DOWNLOAD_FAILED = 'REPORT_DOWNLOAD_FAILED',
  SUBMISSION_PDF_VIEWED = 'SUBMISSION_PDF_VIEWED',
  SUBMISSION_PDF_DOWNLOADED = 'SUBMISSION_PDF_DOWNLOADED',
  SUBMISSIONS_BULK_PDF_REQUESTED = 'SUBMISSIONS_BULK_PDF_REQUESTED',
  SUBMISSIONS_BULK_PDF_DOWNLOADED = 'SUBMISSIONS_BULK_PDF_DOWNLOADED',
  SUBMISSIONS_BULK_PDF_FAILED = 'SUBMISSIONS_BULK_PDF_FAILED',
}

export enum AdminActionTargetType {
  USER = 'USER',
  FORM = 'FORM',
  PROJECT = 'PROJECT',
  FOLDER = 'FOLDER',
  SUBMISSION = 'SUBMISSION',
}

/**
 * Bitácora de acciones administrativas. Inmutable: nunca se actualiza ni
 * se borra desde la app — solo se inserta. El operador puede purgar
 * registros viejos manualmente si la tabla crece demasiado.
 *
 * Los campos *Name guardan SNAPSHOT del nombre al momento de la acción
 * para que el log siga siendo legible aunque el actor o el target se
 * borren posteriormente.
 */
@Entity('admin_actions')
@Index(['createdAt'])
@Index(['actorId', 'createdAt'])
@Index(['targetType', 'targetId'])
export class AdminAction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64 })
  action: AdminActionType;

  @Column()
  actorId: number;

  @Column({ type: 'varchar', length: 200 })
  actorName: string;

  @Column({ type: 'varchar', length: 32 })
  actorRole: string;

  @Column({ type: 'varchar', length: 32 })
  targetType: AdminActionTargetType;

  @Column({ type: 'varchar', length: 64 })
  targetId: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  targetName: string | null;

  /**
   * Datos arbitrarios sobre la acción. Para USER_UPDATE típicamente
   * `{ changes: { role: { from: 'user', to: 'admin' } } }`. Para
   * USER_PERMISSIONS_CHANGE típicamente `{ before: [...], after: [...] }`.
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
