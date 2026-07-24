import { RecordsService } from './records.service';

describe('RecordsService', () => {
  const model: any = {
    find: jest.fn(),
    countDocuments: jest.fn(),
  };
  const formsService: any = { findOne: jest.fn() };
  const usersService: any = { findByIds: jest.fn() };

  const service = new RecordsService(model, formsService, usersService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('devuelve página con hasPdf según templateSnapshot no-null', async () => {
    formsService.findOne.mockResolvedValue({
      _id: 'form1',
      schema: { widgets: [{ id: 'w1', label: 'Paciente' }, { id: 'w2', label: 'Documento' }] },
    });
    model.find.mockReturnValue({
      sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve([
        { _id: 's1', submittedAt: new Date('2026-07-22'), data: { w1: 'Juan', w2: 'CC1' }, submittedById: 5, templateSnapshot: '<p></p>' },
        { _id: 's2', submittedAt: new Date('2026-07-21'), data: { w1: 'Ana',  w2: 'CC2' }, submittedById: 5, templateSnapshot: null },
      ])})})}),
    });
    model.countDocuments.mockResolvedValue(2);
    usersService.findByIds.mockResolvedValue({ 5: { name: 'Sara', email: 's@x' } });

    const page = await service.listByForm('form1', { page: 1, limit: 50 });

    expect(page.total).toBe(2);
    expect(page.data[0]).toMatchObject({ id: 's1', userName: 'Sara', hasPdf: true });
    expect(page.data[0].summary).toMatchObject({ Paciente: 'Juan', Documento: 'CC1' });
    expect(page.data[1]).toMatchObject({ id: 's2', hasPdf: false });
  });

  it('aplica filtro por rango de fechas', async () => {
    formsService.findOne.mockResolvedValue({ _id: 'form1', schema: { widgets: [] } });
    model.find.mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) }) });
    model.countDocuments.mockResolvedValue(0);
    usersService.findByIds.mockResolvedValue({});

    await service.listByForm('form1', { page: 1, limit: 50, from: '2026-07-01', to: '2026-07-31' });

    const query = model.find.mock.calls[0][0];
    expect(query.submittedAt.$gte).toEqual(new Date('2026-07-01'));
    expect(query.submittedAt.$lte).toEqual(new Date('2026-07-31T23:59:59.999Z'));
  });
});
