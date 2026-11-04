import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FormSubmissionDocument = FormSubmission & Document;

@Schema({ collection: 'form_submissions' })
export class FormSubmission {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true, index: true })
  formId: string;

  @Prop({ required: true })
  formVersion: number;

  @Prop({ type: Number, default: null })
  submittedById: number | null;

  @Prop({ type: Object, required: true })
  data: Record<string, unknown>;

  @Prop({ type: Object, default: null })
  metadata: Record<string, unknown> | null;

  // Enlaza la submission a la Tarea que la originó (flujo de enlace
  // compartible en tasks.service.ts submitFromShare). null para submissions
  // normales (formulario directo) — no requiere migración de datos viejos.
  @Prop({ type: String, default: null, index: true })
  taskId: string | null;

  @Prop({ default: () => new Date(), index: true })
  submittedAt: Date;

  // ── Snapshot del template HTML del momento del envío ─────────────────────
  // Se guarda el pdfTemplate con placeholders ${label} SIN interpolar,
  // para poder regenerar el PDF con el formato original aunque el template
  // del formulario cambie más adelante. Peso típico 2-20 KB (no incluye
  // binarios: firmas/fotos siguen en GridFS con referencia gridfs:<id>).
  // null si el formulario no tiene pdfTemplate configurado.
  @Prop({ type: String, default: null })
  templateSnapshot: string | null;

  // Nombre del archivo PDF sugerido al descargar
  @Prop({ type: String, default: null })
  pdfFilename: string | null;

  // Llaves "<submissionId>:<índice>" de las actividades planeadas que este
  // envío (un Cumplimiento) da por cumplidas. Vacío en el resto de
  // formularios. El índice único de abajo garantiza que una misma actividad
  // nunca pueda cerrarse dos veces, incluso si llegan dos envíos en paralelo.
  @Prop({ type: [String], default: [] })
  completesActivities: string[];

  // ── Soft delete ──────────────────────────────────────────────────────────
  // Un registro "eliminado" nunca se borra físicamente: se marca con
  // `deletedAt` + quién lo hizo + por qué. Todas las queries de la app
  // filtran `deletedAt: null` (ver records.service, submissions.service).
  // Se conserva por trazabilidad legal/auditoría — un DBA con acceso a
  // Mongo puede recuperar el registro leyendo por _id.
  @Prop({ type: Date, default: null, index: true })
  deletedAt: Date | null;

  @Prop({ type: Number, default: null })
  deletedById: number | null;

  @Prop({ type: String, default: null })
  deletedReason: string | null;
}

export const FormSubmissionSchema = SchemaFactory.createForClass(FormSubmission);

FormSubmissionSchema.index({ formId: 1, submittedAt: -1 });

// Una actividad planeada solo puede cumplirse una vez. El índice único
// sobre el array `completesActivities` impide que dos cumplimientos
// (aunque lleguen al mismo tiempo) cierren la misma actividad. Parcial:
// solo aplica a documentos que efectivamente tengan al menos una llave
// — los envíos sin actividades (todos los que no son Cumplimiento) no
// pagan costo de índice.
FormSubmissionSchema.index(
  { completesActivities: 1 },
  {
    unique: true,
    partialFilterExpression: {
      'completesActivities.0': { $exists: true },
    },
  },
);
// Soporta la query "actividades que YO planeé" (findPending): busca por
// formId + submittedById y ordena por submittedAt desc.
FormSubmissionSchema.index({ formId: 1, submittedById: 1, submittedAt: -1 });

FormSubmissionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});