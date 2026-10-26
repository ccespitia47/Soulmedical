import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Colección de historia para asignaciones "eliminadas". Cuando se
 * desasigna un form/carpeta/proyecto/grupo, en vez de borrar el doc
 * físicamente, movemos una copia acá. La colección activa queda limpia
 * (sin problemas de índices unique al reasignar) y aquí queda toda la
 * historia auditable: quién estuvo asignado a qué, cuándo se creó, quién
 * lo desasignó, cuándo, por qué.
 *
 * Aplica también a los reseteos masivos de PUT /assignments/tree — cada
 * reemplazo guarda un snapshot completo del estado anterior con
 * `type: 'tree_reset'` en `metadata`.
 */
export type AssignmentHistoryDocument = AssignmentHistory & Document;

@Schema({ timestamps: true, collection: 'assignments_history' })
export class AssignmentHistory {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  /**
   * Qué tipo de asignación era. Sirve para filtrar la historia por
   * subsistema en el reporte de acciones.
   */
  @Prop({ type: String, required: true, index: true })
  type:
    | 'user_form_assignment'
    | 'user_group_membership'
    | 'group_project_assignment'
    | 'group_form_assignment'
    | 'user_project_assignment'
    | 'user_form_direct_assignment'
    | 'assignment_tree_reset';

  /** El documento original completo tal como estaba antes de eliminarse. */
  @Prop({ type: Object, required: true })
  originalDocument: Record<string, unknown>;

  /** Quién desasignó (id del usuario admin/coordinador). null si fue sistema. */
  @Prop({ type: Number, default: null, index: true })
  deletedById: number | null;

  /** Cuándo se desasignó. */
  @Prop({ type: Date, default: () => new Date(), index: true })
  deletedAt: Date;

  /**
   * Motivo opcional. La app hoy no lo pide para asignaciones (a diferencia
   * de submissions), pero el campo existe por si se agrega más adelante.
   */
  @Prop({ type: String, default: null })
  deletedReason: string | null;

  /**
   * Contexto adicional: para `assignment_tree_reset` incluye el nuevo
   * árbol que reemplazó al anterior; para deletes individuales puede
   * incluir el endpoint/actor rol/ip.
   */
  @Prop({ type: Object, default: null })
  metadata: Record<string, unknown> | null;
}

export const AssignmentHistorySchema =
  SchemaFactory.createForClass(AssignmentHistory);

AssignmentHistorySchema.index({ type: 1, deletedAt: -1 });
