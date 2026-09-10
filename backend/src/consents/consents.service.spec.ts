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
