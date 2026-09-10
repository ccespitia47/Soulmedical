import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateConsentDto } from './create-consent.dto';

function build(overrides: Partial<CreateConsentDto> = {}) {
  return plainToInstance(CreateConsentDto, {
    tipo: 'vih',
    tipoDoc: 'CC',
    numDoc: '900064854',
    nombres: 'Juan',
    apellidos: 'Perez',
    respuestas: { ciudad_confirmada: 'Bogota' },
    firmaPaciente: 'data:image/png;base64,AAAA',
    ...overrides,
  });
}

describe('CreateConsentDto', () => {
  it('acepta un payload válido', () => {
    expect(validateSync(build())).toHaveLength(0);
  });

  it('rechaza tipo fuera del enum', () => {
    const errs = validateSync(build({ tipo: 'otro' as never }));
    expect(errs.some((e) => e.property === 'tipo')).toBe(true);
  });

  it('exige firmaPaciente', () => {
    const errs = validateSync(build({ firmaPaciente: '' }));
    expect(errs.some((e) => e.property === 'firmaPaciente')).toBe(true);
  });

  it('exige respuestas como objeto', () => {
    const errs = validateSync(build({ respuestas: 'x' as never }));
    expect(errs.some((e) => e.property === 'respuestas')).toBe(true);
  });
});
