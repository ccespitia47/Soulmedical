import { mapSubmissionToConsent, runMigration } from './migrate-vaccination';
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

// Nota: este proyecto NO usa mongodb-memory-server (verificado: no está en
// package.json/package-lock.json ni instalado en node_modules — ver también
// los comentarios en assignments-tree.service.spec.ts y tasks-*.service.spec.ts
// que documentan por qué). Seguimos el mismo patrón ya establecido ahí:
// modelos Mongoose mockeados con Jest sobre un store en memoria, inyectados
// via el parámetro `models` de `runMigration` (hook solo para tests: si se
// provee, `runMigration` no abre conexión real a Mongo — ver migrate-vaccination.ts).
type FakeSubmission = {
  _id: string;
  formId: string;
  submittedById: number | null;
  submittedAt: Date;
  data: Record<string, unknown>;
};

function fakeSubmissionModel(docs: FakeSubmission[]) {
  return {
    find: jest.fn((filter: { formId: { $in: string[] } }) => ({
      lean: () =>
        Promise.resolve(docs.filter((d) => filter.formId.$in.includes(d.formId))),
    })),
  } as any;
}

function fakeConsentModel(store: Array<Record<string, unknown>>) {
  return {
    find: jest.fn((filter: { origenSubmissionId: { $in: string[] } }) => ({
      lean: () =>
        Promise.resolve(
          store.filter((d) =>
            filter.origenSubmissionId.$in.includes(d.origenSubmissionId as string),
          ),
        ),
    })),
    updateOne: jest.fn(
      async (
        filter: { origenSubmissionId: string },
        update: { $set: Record<string, unknown> },
        options?: { upsert?: boolean; runValidators?: boolean },
      ) => {
        const idx = store.findIndex(
          (d) => d.origenSubmissionId === filter.origenSubmissionId,
        );
        if (idx >= 0) store[idx] = { ...store[idx], ...update.$set };
        else if (options?.upsert) store.push({ ...update.$set });
      },
    ),
  } as any;
}

describe('runMigration (idempotencia + dry-run)', () => {
  const submissions: FakeSubmission[] = [
    {
      _id: 'sub-soul-1',
      formId: 'consent-vaccination-soul',
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
    },
    {
      _id: 'sub-sai-1',
      formId: 'consent-vaccination-sai',
      submittedById: 7,
      submittedAt: new Date('2026-07-02'),
      data: {
        pacienteNombre: 'Ana Gomez',
        pacienteTipoDoc: 'TI',
        pacienteNumDoc: '111',
        firma: 'gridfs:ccc',
      },
    },
  ];

  it('dry-run no escribe nada: consent_records queda vacía (0 docs)', async () => {
    const store: Array<Record<string, unknown>> = [];

    const result = await runMigration({
      dryRun: true,
      models: {
        submissionModel: fakeSubmissionModel(submissions),
        consentModel: fakeConsentModel(store),
      },
    });

    expect(store).toHaveLength(0);
    expect(result.scanned).toBe(2);
    expect(result.toInsert).toBe(2);
    expect(result.toUpdate).toBe(0);
    expect(result.upserted).toBe(0);
  });

  it('dos corridas consecutivas sin dry-run son idempotentes: 1 doc por submission, sin duplicados', async () => {
    const store: Array<Record<string, unknown>> = [];
    const models = {
      submissionModel: fakeSubmissionModel(submissions),
      consentModel: fakeConsentModel(store),
    };

    const first = await runMigration({ dryRun: false, models });
    expect(store).toHaveLength(2);
    expect(first.toInsert).toBe(2);
    expect(first.toUpdate).toBe(0);
    expect(first.upserted).toBe(2);
    for (const doc of store) {
      expect(doc.hashVerificacion).toEqual(expect.any(String));
      expect(doc.origenSubmissionId).toEqual(expect.any(String));
    }

    const second = await runMigration({ dryRun: false, models });

    expect(store).toHaveLength(2); // sin duplicados
    expect(second.toInsert).toBe(0);
    expect(second.toUpdate).toBe(2);
    expect(second.upserted).toBe(2);

    const ids = store.map((d) => d.origenSubmissionId);
    expect(new Set(ids).size).toBe(2);
  });
});
