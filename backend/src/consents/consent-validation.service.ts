import { BadRequestException, Injectable } from '@nestjs/common';
import { TipoConsentimiento } from './consent-record.schema';

@Injectable()
export class ConsentValidationService {
  /** Invariantes de tipo/entidad. Solo Vacunación usa entidad (SAI/SOUL). */
  validate(input: { tipo: TipoConsentimiento; entidad?: 'SAI' | 'SOUL' }): void {
    const esVacunacion =
      input.tipo === TipoConsentimiento.VACUNACION ||
      input.tipo === TipoConsentimiento.VACUNACION_B;

    if (esVacunacion && !input.entidad) {
      throw new BadRequestException(
        'El consentimiento de vacunación requiere entidad (SAI o SOUL).',
      );
    }
    if (!esVacunacion && input.entidad) {
      throw new BadRequestException(
        `El tipo ${input.tipo} no admite entidad.`,
      );
    }
  }
}
