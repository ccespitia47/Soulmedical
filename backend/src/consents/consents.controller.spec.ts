import { ConsentsController } from './consents.controller';

describe('ConsentsController', () => {
  const service: any = {
    create: jest.fn(), list: jest.fn(), findOne: jest.fn(),
    update: jest.fn(), anular: jest.fn(), verificar: jest.fn(),
  };
  const ctrl = new ConsentsController(service);

  beforeEach(() => jest.clearAllMocks());

  it('POST /consents pasa el userId del request', async () => {
    service.create.mockResolvedValue({ id: 'r1' });
    await ctrl.create({ tipo: 'vih' } as any, { user: { id: 9 } } as any);
    expect(service.create).toHaveBeenCalledWith({ tipo: 'vih' }, 9);
  });

  it('GET /consents parsea page/limit y filtros', async () => {
    service.list.mockResolvedValue({ data: [], total: 0, page: 2, limit: 10 });
    await ctrl.list('2', '10', 'vih', 'juan', '2026-01-01', '2026-02-01');
    expect(service.list).toHaveBeenCalledWith({
      page: 2, limit: 10, tipo: 'vih', search: 'juan', from: '2026-01-01', to: '2026-02-01',
    });
  });

  it('GET /consents/:id/verificar delega en el servicio', async () => {
    service.verificar.mockResolvedValue({ valido: true, hash: 'h' });
    const r = await ctrl.verificar('r1');
    expect(r.valido).toBe(true);
  });
});
