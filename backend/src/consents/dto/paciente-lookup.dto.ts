import { ConsentRecord } from '../consent-record.schema';

export type VacunaPreviaDto = {
  vacuna: string;
  dosis: string;
  aplicada: string;
  proxima: string;
};

export type PacienteLookupDto = {
  ultimo: ConsentRecord | null;
  vacunas: VacunaPreviaDto[];
};
