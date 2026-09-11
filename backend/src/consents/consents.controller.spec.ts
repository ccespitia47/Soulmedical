import { ConsentsController } from './consents.controller';

describe('ConsentsController', () => {
  const service: any = {
    create: jest.fn(), list: jest.fn(), findOne: jest.fn(),
    update: jest.fn(), anular: jest.fn(), verificar: jest.fn(), pdfPayload: jest.fn(),
  };
  const ctrl = new ConsentsController(service);

  beforeEach(() => jest.clearAllMocks());

  it('POST /consents pasa el userId del request (coercionado a numero)', async () => {
    service.create.mockResolvedValue({ id: 'r1' });
    await ctrl.create({ tipo: 'vih' } as any, { user: { id: '9' } } as any);
    expect(service.create).toHaveBeenCalledWith({ tipo: 'vih' }, 9);
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
