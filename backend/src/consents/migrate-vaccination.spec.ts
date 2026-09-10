import { mapSubmissionToConsent } from './migrate-vaccination';
import { consentHash } from './consent-hash';
import { TipoConsentimiento, EstadoConsentimiento } from './consent-record.schema';

describe('mapSubmissionToConsent', () => {
  const sub = {
    _id: 's1',
    submittedById: 5,
    submittedAt: new Date('2026-07-01'),
    data: {
      pacienteNombre: 'Juan Perez',
      pacienteTipoDoc: 'CC',
      pacienteNumDoc: '900064854',
      ciudad: 'Bogota',
      firma: 'gridfs:aaa',
      firmaResponsable: 'gridfs:bbb',
      b1: 'No',
    },
  };

  it('mapea identidad (ids viejos de vacunación) a columnas y el resto a respuestas, conservando firmas gridfs', () => {
    const rec = mapSubmissionToConsent(sub, 'SOUL');

    expect(rec.tipo).toBe(TipoConsentimiento.VACUNACION);
    expect(rec.entidad).toBe('SOUL');
    expect(rec.nombres).toBe('Juan Perez');
    expect(rec.apellidos).toBeNull();
    expect(rec.tipoDoc).toBe('CC');
    expect(rec.numDoc).toBe('900064854');
    expect(rec.ciudad).toBe('Bogota');
    expect(rec.firmaPaciente).toBe('gridfs:aaa');
    expect(rec.firmaResponsable).toBe('gridfs:bbb');
    expect(rec.foto).toBeNull();

    expect((rec.respuestas as any).b1).toBe('No');
    expect((rec.respuestas as any).pacienteNombre).toBeUndefined();
    expect((rec.respuestas as any).pacienteTipoDoc).toBeUndefined();
    expect((rec.respuestas as any).pacienteNumDoc).toBeUndefined();
    expect((rec.respuestas as any).ciudad).toBeUndefined();
    expect((rec.respuestas as any).firma).toBeUndefined();
    expect((rec.respuestas as any).firmaResponsable).toBeUndefined();

    expect((rec as any).origenSubmissionId).toBe('s1');
    expect(rec.createdById).toBe(5);
    expect(rec.createdAt).toEqual(new Date('2026-07-01'));
    expect(rec.estado).toBe(EstadoConsentimiento.FIRMADO);
  });

  it('produce el mismo hashVerificacion que el shape canónico del servicio (para que "verificar" pase)', () => {
    const rec = mapSubmissionToConsent(sub, 'SOUL');

    const base = {
      tipo: rec.tipo,
      entidad: rec.entidad ?? null,
      tipoDoc: rec.tipoDoc,
      numDoc: rec.numDoc,
      nombres: rec.nombres,
      apellidos: rec.apellidos ?? null,
      ciudad: rec.ciudad ?? null,
      profesional: rec.profesional ?? null,
      respuestas: rec.respuestas,
      firmaPaciente: rec.firmaPaciente ?? null,
      firmaResponsable: rec.firmaResponsable ?? null,
      foto: rec.foto ?? null,
    };
    expect(rec.hashVerificacion).toBe(consentHash(base as unknown as Record<string, unknown>));
  });

  it('para SAI usa la entidad pasada por el runner y normaliza opcionales ausentes a null', () => {
    const bare = {
      _id: 's2',
      submittedById: null,
      submittedAt: new Date('2026-08-01'),
      data: {
        pacienteNombre: 'Ana Gomez',
        pacienteTipoDoc: 'TI',
        pacienteNumDoc: '111',
        // sin ciudad, sin firmaResponsable
        firma: 'gridfs:ccc',
      },
    };
    const rec = mapSubmissionToConsent(bare, 'SAI');
    expect(rec.entidad).toBe('SAI');
    expect(rec.ciudad).toBeNull();
    expect(rec.firmaResponsable).toBeNull();
    expect(rec.createdById).toBeNull();
  });
});
