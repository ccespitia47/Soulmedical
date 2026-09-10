import { model } from 'mongoose';
import {
  ConsentRecord,
  ConsentRecordSchema,
  TipoConsentimiento,
  EstadoConsentimiento,
} from './consent-record.schema';

describe('ConsentRecordSchema', () => {
  const Model = model(ConsentRecord.name, ConsentRecordSchema);

  it('genera _id string por defecto y aplica defaults', () => {
    const doc = new Model({
      tipo: TipoConsentimiento.VIH,
      tipoDoc: 'CC',
      numDoc: '900064854',
      nombres: 'Juan',
      apellidos: 'Perez',
      respuestas: {},
      hashVerificacion: 'abc',
    });
    expect(typeof doc._id).toBe('string');
    expect(doc._id.length).toBeGreaterThan(10);
    expect(doc.estado).toBe(EstadoConsentimiento.BORRADOR);
    expect(doc.entidad ?? null).toBeNull();
    expect(doc.createdAt).toBeInstanceOf(Date);
  });

  it('toJSON expone id y elimina __v', () => {
    const doc = new Model({
      tipo: TipoConsentimiento.VIH, tipoDoc: 'CC', numDoc: '1', nombres: 'A',
      apellidos: 'B', respuestas: {}, hashVerificacion: 'h',
    });
    const json = doc.toJSON() as any;
    expect(json.id).toBe(doc._id);
    expect(json.__v).toBeUndefined();
  });

  it('rechaza tipo fuera del enum', () => {
    const doc = new Model({
      tipo: 'otro', tipoDoc: 'CC', numDoc: '1', nombres: 'A', apellidos: 'B',
      respuestas: {}, hashVerificacion: 'h',
    });
    const err = doc.validateSync();
    expect(err?.errors?.tipo).toBeDefined();
  });
});
