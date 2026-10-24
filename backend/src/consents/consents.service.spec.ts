import { NotFoundException } from '@nestjs/common';
import { ConsentsService } from './consents.service';
import { TipoConsentimiento, EstadoConsentimiento } from './consent-record.schema';

function makeDeps() {
  const model: any = { create: jest.fn((d) => Promise.resolve({ ...d })) };
  const filesService: any = { uploadDataUrl: jest.fn() };
  const usersService: any = { findByIds: jest.fn() };
  const validation: any = { validate: jest.fn() };
  const service = new ConsentsService(model, filesService, usersService, validation);
  return { service, model, filesService, usersService, validation };
}

const baseDto = {
  tipo: TipoConsentimiento.VIH,
  tipoDoc: 'CC', numDoc: '900064854', nombres: 'Juan', apellidos: 'Perez',
  respuestas: { ciudad_confirmada: 'Bogota' },
  firmaPaciente: 'data:image/png;base64,AAAA',
} as any;

describe('ConsentsService.create', () => {
  it('valida, sube la firma a GridFS y persiste con hash + estado firmado', async () => {
    const { service, model, filesService, validation } = makeDeps();
    filesService.uploadDataUrl.mockResolvedValue('64ab');

    const saved = await service.create(baseDto, 7);

    expect(validation.validate).toHaveBeenCalledWith({ tipo: 'vih', entidad: undefined });
    expect(filesService.uploadDataUrl).toHaveBeenCalledTimes(1);
    const doc = model.create.mock.calls[0][0];
    expect(doc.firmaPaciente).toBe('gridfs:64ab');
    expect(doc.estado).toBe(EstadoConsentimiento.FIRMADO);
    expect(doc.createdById).toBe(7);
    expect(doc.hashVerificacion).toMatch(/^[0-9a-f]{64}$/);
    expect(saved).toBeDefined();
  });

  it('conserva una referencia gridfs existente sin re-subir', async () => {
    const { service, model, filesService } = makeDeps();
    await service.create({ ...baseDto, firmaPaciente: 'gridfs:existente' }, 7);
    expect(filesService.uploadDataUrl).not.toHaveBeenCalled();
    expect(model.create.mock.calls[0][0].firmaPaciente).toBe('gridfs:existente');
  });
});

describe('ConsentsService.list/findOne/update/anular', () => {
  it('list arma query por tipo y rango, y enriquece nombres de creador', async () => {
    const { service, model, usersService } = makeDeps();
    const chain = {
      sort: () => chain, skip: () => chain, limit: () => chain,
      lean: () => Promise.resolve([
        { _id: 'r1', tipo: 'vih', numDoc: '1', createdById: 7, createdAt: new Date(), __v: 0 },
      ]),
    };
    model.find = jest.fn().mockReturnValue(chain);
    model.countDocuments = jest.fn().mockResolvedValue(1);
    usersService.findByIds.mockResolvedValue({ 7: { name: 'Sara', email: 's@x' } });

    const page = await service.list({ page: 1, limit: 50, tipo: 'vih', from: '2026-01-01' });

    expect(model.find).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'vih', createdAt: expect.any(Object) }),
    );
    expect(page.total).toBe(1);
    expect(page.data[0].creadoPor).toBe('Sara');
    expect(page.data[0].id).toBe('r1');
    expect(page.data[0]._id).toBe('r1');
    expect(page.data[0]).not.toHaveProperty('__v');
  });

  it('findOne lanza NotFound si no existe', async () => {
    const { service, model } = makeDeps();
    model.findById = jest.fn().mockReturnValue({ lean: () => Promise.resolve(null) });
    await expect(service.findOne('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOne normaliza el doc lean (id presente, sin __v)', async () => {
    const { service, model } = makeDeps();
    model.findById = jest.fn().mockReturnValue({
      lean: () => Promise.resolve({ _id: 'r1', tipo: 'vih', numDoc: '1', __v: 0 }),
    });
    const doc: any = await service.findOne('r1');
    expect(doc.id).toBe('r1');
    expect(doc._id).toBe('r1');
    expect(doc).not.toHaveProperty('__v');
  });

  it('update recalcula hash y fija updatedAt', async () => {
    const { service, model, filesService } = makeDeps();
    model.findById = jest.fn().mockReturnValue({
      lean: () => Promise.resolve({
        _id: 'r1', tipo: 'vih', entidad: null, tipoDoc: 'CC', numDoc: '1',
        nombres: 'A', apellidos: 'B', ciudad: null, profesional: null,
        respuestas: { x: 1 }, firmaPaciente: 'gridfs:a', firmaResponsable: null, foto: null,
      }),
    });
    model.findByIdAndUpdate = jest.fn().mockReturnValue({
      lean: () => Promise.resolve({ _id: 'r1', respuestas: { x: 2 }, __v: 0 }),
    });

    const updated: any = await service.update('r1', { respuestas: { x: 2 } } as any, 7);

    const patch = model.findByIdAndUpdate.mock.calls[0][1];
    expect(patch.hashVerificacion).toMatch(/^[0-9a-f]{64}$/);
    expect(patch.updatedAt).toBeInstanceOf(Date);
    expect(filesService.uploadDataUrl).not.toHaveBeenCalled();
    expect(updated.id).toBe('r1');
    expect(updated._id).toBe('r1');
    expect(updated).not.toHaveProperty('__v');
  });

  it('anular fija estado anulado', async () => {
    const { service, model } = makeDeps();
    model.findByIdAndUpdate = jest.fn().mockReturnValue({
      lean: () => Promise.resolve({ _id: 'r1', estado: 'anulado', __v: 0 }),
    });
    const r: any = await service.anular('r1');
    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'r1', { estado: EstadoConsentimiento.ANULADO }, { new: true },
    );
    expect(r.estado).toBe('anulado');
    expect(r.id).toBe('r1');
    expect(r._id).toBe('r1');
    expect(r).not.toHaveProperty('__v');
  });
});

describe('ConsentsService.pdfPayload', () => {
  it('resuelve las refs gridfs de firmas/foto a data URLs', async () => {
    const { service, model, filesService } = makeDeps();
    model.findById = jest.fn().mockReturnValue({ lean: () => Promise.resolve({
      _id: 'r1', tipo: 'infectologia', firmaPaciente: 'gridfs:a', firmaResponsable: null, foto: 'gridfs:c',
    }) });
    filesService.readAsDataUrl = jest.fn()
      .mockResolvedValueOnce('data:image/png;base64,AA')  // firma
      .mockResolvedValueOnce('data:image/jpeg;base64,BB'); // foto
    const p = await service.pdfPayload('r1');
    expect(p.firmaPacienteDataUrl).toBe('data:image/png;base64,AA');
    expect(p.firmaResponsableDataUrl).toBeNull();
    expect(p.fotoDataUrl).toBe('data:image/jpeg;base64,BB');
  });
});

describe('ConsentsService.verificar', () => {
  it('devuelve valido=true cuando el hash coincide', async () => {
    const { service, model } = makeDeps();
    const base = {
      tipo: 'vih', entidad: null, tipoDoc: 'CC', numDoc: '1', nombres: 'A', apellidos: 'B',
      ciudad: null, profesional: null, respuestas: { x: 1 },
      firmaPaciente: 'gridfs:a', firmaResponsable: null, foto: null,
    };
    const { consentHash } = require('./consent-hash');
    model.findById = jest.fn().mockReturnValue({
      lean: () => Promise.resolve({ _id: 'r1', ...base, hashVerificacion: consentHash(base) }),
    });
    const res = await service.verificar('r1');
    expect(res.valido).toBe(true);
  });

  it('un consentimiento creado SIN apellidos verifica valido=true (apellidos null es parte del hash)', async () => {
    const { service, model, filesService } = makeDeps();
    filesService.uploadDataUrl.mockResolvedValue('64ab');

    // Crear omitiendo apellidos: el servicio lo normaliza a null y lo incluye en el hash.
    const { apellidos, ...dtoSinApellidos } = baseDto;
    await service.create(dtoSinApellidos as any, 7);
    const savedDoc = model.create.mock.calls[0][0];
    expect(savedDoc.apellidos).toBeNull();

    // verificar sobre el mismo doc guardado (findById().lean() lo devuelve tal cual).
    model.findById = jest
      .fn()
      .mockReturnValue({ lean: () => Promise.resolve({ _id: 'r1', ...savedDoc }) });
    const res = await service.verificar('r1');
    expect(res.valido).toBe(true);
  });

  it('devuelve valido=false si el contenido fue alterado', async () => {
    const { service, model } = makeDeps();
    model.findById = jest.fn().mockReturnValue({
      lean: () => Promise.resolve({
        _id: 'r1', tipo: 'vih', entidad: null, tipoDoc: 'CC', numDoc: '1',
        nombres: 'A', apellidos: 'B', ciudad: null, profesional: null,
        respuestas: { x: 999 }, firmaPaciente: 'gridfs:a', firmaResponsable: null, foto: null,
        hashVerificacion: 'no-coincide',
      }),
    });
    const res = await service.verificar('r1');
    expect(res.valido).toBe(false);
  });
});

describe('ConsentsService.lookupPaciente', () => {
  const d = (s: string) => new Date(s);
  const rows: any[] = [
    { _id: 'a', numDoc: '1009', entidad: 'SOUL', estado: 'firmado', createdAt: d('2026-03-01T10:00:00Z'),
      respuestas: { fecha: '2026-03-02', seccionC: JSON.stringify([
        { nombre: 'Hepatitis B', dosis: '1', lote: 'L1', vencimiento: '', proxima: '2026-04-02', fabricante: 'X' },
      ]) } },
    { _id: 'b', numDoc: '1009', entidad: 'SOUL', estado: 'firmado', createdAt: d('2026-05-01T10:00:00Z'),
      respuestas: { seccionC: JSON.stringify([
        { nombre: 'Hepatitis B', dosis: '2', proxima: '2026-06-01' },
        { nombre: 'Tétanos', dosis: '1' },
      ]) } },
    { _id: 'c', numDoc: '100', entidad: 'SOUL', estado: 'firmado', createdAt: d('2026-06-01T10:00:00Z'), respuestas: {} },
    { _id: 'd', numDoc: '1009', entidad: 'SAI', estado: 'firmado', createdAt: d('2026-07-01T10:00:00Z'), respuestas: {} },
    { _id: 'e', numDoc: '1009', entidad: 'SOUL', estado: 'anulado', createdAt: d('2026-08-01T10:00:00Z'), respuestas: {} },
    { _id: 'f', numDoc: '2000', entidad: null, estado: 'firmado', createdAt: d('2026-01-01T10:00:00Z'),
      respuestas: { seccionC: 'texto libre heredado' } },
  ];
  function setup() {
    const deps = makeDeps();
    deps.model.find = jest.fn((q: any) => {
      const data = rows
        .filter((r) => r.numDoc === q.numDoc && r.entidad === q.entidad && r.estado !== 'anulado')
        .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
      const chain: any = { sort: () => chain, lean: () => Promise.resolve(data) };
      return chain;
    });
    return deps;
  }

  it('exige coincidencia exacta de numDoc', async () => {
    const { service, model } = setup();
    const r = await service.lookupPaciente('100', 'SOUL');
    expect(r.ultimo?.id).toBe('c');
    expect(model.find.mock.calls[0][0].numDoc).toBe('100');
    expect(model.find.mock.calls[0][0].numDoc).not.toBeInstanceOf(RegExp);
  });
  it('recorta espacios del numDoc antes de comparar', async () => {
    const { service } = setup();
    expect((await service.lookupPaciente(' 1009 ', 'SOUL')).ultimo?.id).toBe('b');
  });
  it('no cruza entidades', async () => {
    const { service } = setup();
    expect((await service.lookupPaciente('1009', 'SAI')).ultimo?.id).toBe('d');
    expect((await service.lookupPaciente('1009', null)).ultimo).toBeNull();
  });
  it('excluye los anulados', async () => {
    const { service, model } = setup();
    const r = await service.lookupPaciente('1009', 'SOUL');
    expect(r.ultimo?.id).not.toBe('e');
    expect(model.find.mock.calls[0][0].estado).toEqual({ $ne: 'anulado' });
  });
  it('aplana las filas de seccionC de todos los registros', async () => {
    const { service } = setup();
    const r = await service.lookupPaciente('1009', 'SOUL');
    expect(r.vacunas).toHaveLength(3);
    expect(r.vacunas).toContainEqual({
      vacuna: 'Hepatitis B', dosis: '1', aplicada: '2026-03-02', proxima: '2026-04-02',
    });
    expect(r.vacunas).toContainEqual({
      vacuna: 'Tétanos', dosis: '1', aplicada: '2026-05-01', proxima: '',
    });
  });
  it('ignora un seccionC que no sea JSON de array', async () => {
    const { service } = setup();
    const r = await service.lookupPaciente('2000', null);
    expect(r.ultimo?.id).toBe('f');
    expect(r.vacunas).toEqual([]);
  });
  it('devuelve ultimo: null cuando no hay registros', async () => {
    const { service } = setup();
    expect(await service.lookupPaciente('9999', 'SOUL')).toEqual({ ultimo: null, vacunas: [] });
  });
});
