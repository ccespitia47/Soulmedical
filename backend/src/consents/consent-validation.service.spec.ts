import { BadRequestException } from '@nestjs/common';
import { ConsentValidationService } from './consent-validation.service';
import { TipoConsentimiento } from './consent-record.schema';

describe('ConsentValidationService', () => {
  const svc = new ConsentValidationService();

  it('acepta vacunacion con entidad', () => {
    expect(() =>
      svc.validate({ tipo: TipoConsentimiento.VACUNACION, entidad: 'SOUL' }),
    ).not.toThrow();
  });

  it('exige entidad en vacunacion', () => {
    expect(() => svc.validate({ tipo: TipoConsentimiento.VACUNACION })).toThrow(
      BadRequestException,
    );
  });

  it('rechaza entidad en un tipo que no es vacunacion', () => {
    expect(() =>
      svc.validate({ tipo: TipoConsentimiento.VIH, entidad: 'SAI' }),
    ).toThrow(BadRequestException);
  });

  it('acepta vih sin entidad', () => {
    expect(() => svc.validate({ tipo: TipoConsentimiento.VIH })).not.toThrow();
  });
});
