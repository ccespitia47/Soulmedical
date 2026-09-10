import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum TipoConsentimiento {
  VACUNACION = 'vacunacion',
  VACUNACION_B = 'vacunacion_b',
  TUBERCULINA = 'tuberculina',
  VENOPUNCION = 'venopuncion',
  VIH = 'vih',
  INFECTOLOGIA = 'infectologia',
}

export enum EstadoConsentimiento {
  BORRADOR = 'borrador',
  FIRMADO = 'firmado',
  ANULADO = 'anulado',
}

export const ENTIDADES = ['SAI', 'SOUL'] as const;
export type Entidad = (typeof ENTIDADES)[number];

export type ConsentRecordDocument = ConsentRecord & Document;

@Schema({ collection: 'consent_records' })
export class ConsentRecord {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true, index: true, enum: Object.values(TipoConsentimiento) })
  tipo: TipoConsentimiento;

  @Prop({ type: String, enum: ENTIDADES, default: null })
  entidad: Entidad | null;

  @Prop({ required: true }) tipoDoc: string;
  @Prop({ required: true, index: true }) numDoc: string;
  @Prop({ required: true }) nombres: string;
  @Prop({ type: String, required: false, default: null }) apellidos: string | null;

  @Prop({ type: String, default: null }) ciudad: string | null;
  @Prop({ type: String, default: null }) profesional: string | null;

  @Prop({
    required: true,
    enum: Object.values(EstadoConsentimiento),
    default: EstadoConsentimiento.BORRADOR,
  })
  estado: EstadoConsentimiento;

  @Prop({ type: Object, required: true, default: {} })
  respuestas: Record<string, unknown>;

  @Prop({ type: String, default: null }) firmaPaciente: string | null;
  @Prop({ type: String, default: null }) firmaResponsable: string | null;
  @Prop({ type: String, default: null }) foto: string | null;

  @Prop({ required: true }) hashVerificacion: string;

  @Prop({ type: Number, default: null }) createdById: number | null;
  @Prop({ default: () => new Date(), index: true }) createdAt: Date;
  @Prop({ type: Date, default: null }) updatedAt: Date | null;
  @Prop({ type: Date, default: null }) pdfGeneradoEn: Date | null;
}

export const ConsentRecordSchema = SchemaFactory.createForClass(ConsentRecord);

ConsentRecordSchema.index({ tipo: 1, createdAt: -1 });

ConsentRecordSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});
