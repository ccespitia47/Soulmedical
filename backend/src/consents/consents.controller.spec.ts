import { BadRequestException } from '@nestjs/common';
import { ConsentsController } from './consents.controller';

describe('ConsentsController', () => {
  const service: any = {
    create: jest.fn(), list: jest.fn(), findOne: jest.fn(),
    update: jest.fn(), lookupPaciente: jest.fn(), anular: jest.fn(), verificar: jest.fn(), pdfPayload: jest.fn(),
  };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const ctrl = new ConsentsController(service, audit);

  beforeEach(() => jest.clearAllMocks());

  it('POST /consents pasa el userId del request (coercionado a numero)', async () => {
    service.create.mockResolvedValue({ id: 'r1' });
    await ctrl.create({ tipo: 'vih' } as any, { user: { id: '9' } } as any);
    expect(service.create).toHaveBeenCalledWith({ tipo: 'vih' }, 9);
  });

  it('GET /consents/paciente consulta, normaliza entidad y audita', async () => {
    service.lookupPaciente.mockResolvedValue({ ultimo: { id: 'r1' }, vacunas: [] });
    const r = await ctrl.paciente(' 1009 ', 'SOUL', { user: { id: '9', name: 'Sara', role: 'admin' } } as any);
    expect(service.lookupPaciente).toHaveBeenCalledWith('1009', 'SOUL', undefined);
    expect(r.ultimo).toEqual({ id: 'r1' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      actor: { id: 9, name: 'Sara', role: 'admin' },
      action: 'CONSENT_PATIENT_LOOKUP', targetType: 'CONSENT_PATIENT', targetId: '1009',
    }));
  });

  const req: any = { user: { id: '9' } };
  it.each(['FOO', 'sai', 'soul', ' SAI'])('GET /consents/paciente entidad invalida %p -> 400 sin consultar ni auditar', async (e) => {
    await expect(ctrl.paciente('1', e, req)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.lookupPaciente).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
  it('GET /consents/paciente entidad vacia se trata como omitida (null)', async () => {
    service.lookupPaciente.mockResolvedValue({ ultimo: null, vacunas: [] });
    await ctrl.paciente('1', '', req);
    expect(service.lookupPaciente).toHaveBeenCalledWith('1', null, undefined);
  });
  it.each([undefined, '', '   '])('GET /consents/paciente numDoc vacio %p -> 400', async (n) => {
    await expect(ctrl.paciente(n as any, 'SOUL', req)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.lookupPaciente).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
  it.each([{ '$ne': 'x' }, ['1', '2'], 5])('GET /consents/paciente numDoc no-string %j -> 400', async (n) => {
    await expect(ctrl.paciente(n as any, 'SOUL', req)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.lookupPaciente).not.toHaveBeenCalled();
  });
  it('entidad repetida (array) -> 400', async () => {
    await expect(ctrl.paciente('1', ['SAI', 'SOUL'] as any, req)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('GET /consents/paciente sin entidad usa null', async () => {
    service.lookupPaciente.mockResolvedValue({ ultimo: null, vacunas: [] });
    await ctrl.paciente('1', undefined, { user: { id: '9' } } as any);
    expect(service.lookupPaciente).toHaveBeenCalledWith('1', null, undefined);
  });

  const OID = '507f1f77bcf86cd799439011';
  it('GET /consents/paciente pasa excludeId al servicio', async () => {
    service.lookupPaciente.mockResolvedValue({ ultimo: null, vacunas: [] });
    await ctrl.paciente('1009', 'SOUL', req, OID);
    expect(service.lookupPaciente).toHaveBeenCalledWith('1009', 'SOUL', OID);
  });
  it.each(['abc', '123', ['a', 'b'], { $ne: 1 }, 5])('GET /consents/paciente excludeId invalido %j -> 400 sin consultar', async (x) => {
    await expect(ctrl.paciente('1009', 'SOUL', req, x as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.lookupPaciente).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
  it('GET /consents/paciente excludeId vacio se trata como omitido', async () => {
    service.lookupPaciente.mockResolvedValue({ ultimo: null, vacunas: [] });
    await ctrl.paciente('1009', 'SOUL', req, '');
    expect(service.lookupPaciente).toHaveBeenCalledWith('1009', 'SOUL', undefined);
  });

  it('GET /consents parsea page/limit y filtros', async () => {
    service.list.mockResolvedValue({ data: [], total: 0, page: 2, limit: 10 });
    await ctrl.list('2', '10', 'vih', 'juan', '2026-01-01', '2026-02-01');
    expect(service.list).toHaveBeenCalledWith({
      page: 2, limit: 10, tipo: 'vih', search: 'juan', from: '2026-01-01', to: '2026-02-01',
    });
  });

  it('GET /consents con page/limit invalidos cae a valores por defecto', async () => {
    service.list.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });
    await ctrl.list('abc', 'abc');
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 50 }),
    );
  });

  it('GET /consents/:id/verificar delega en el servicio', async () => {
    service.verificar.mockResolvedValue({ valido: true, hash: 'h' });
    const r = await ctrl.verificar('r1');
    expect(r.valido).toBe(true);
  });

  it('GET /consents/:id/pdf delega en pdfPayload', async () => {
    service.pdfPayload = jest.fn().mockResolvedValue({ record: { id: 'r1' }, firmaPacienteDataUrl: null, firmaResponsableDataUrl: null, fotoDataUrl: null });
    const r = await ctrl.pdf('r1');
    expect(service.pdfPayload).toHaveBeenCalledWith('r1');
    expect(r.record.id).toBe('r1');
  });
});
