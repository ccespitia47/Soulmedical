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
