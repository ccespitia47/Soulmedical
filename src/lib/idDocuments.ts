/**
 * Catálogo de documentos de identidad de Colombia, LATAM y Estados Unidos.
 * Cada tipo declara si es numérico (para permitir separador de miles
 * cosmético) y un validador que puede combinar regex + checksum.
 *
 * NADA de esto verifica que el documento EXISTE en un registro oficial —
 * solo valida formato y (donde aplica) el dígito de verificación.
 */

export type IdDocValidator = (input: string) => boolean;

export type IdDocType = {
  code: string;
  name: string;
  /** True si el input es puramente numérico y admite separador de miles. */
  numericOnly: boolean;
  placeholder?: string;
  validate: IdDocValidator;
};

export type IdDocCountry = {
  code: string;
  name: string;
  flag: string;
  types: IdDocType[];
};

// ─── Helpers de checksum ──────────────────────────────────────────────────

/** NIT Colombia — módulo 11 con pesos oficiales DIAN. */
function validateNitCO(input: string): boolean {
  const clean = input.replace(/\D/g, "");
  if (clean.length < 9 || clean.length > 10) return false;
  const digits = clean.slice(0, -1).split("").reverse().map(Number);
  const dv = parseInt(clean.slice(-1), 10);
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  const mod = sum % 11;
  const expected = mod > 1 ? 11 - mod : mod;
  return dv === expected;
}

/** CPF Brasil — módulo 11 (dos dígitos verificadores). */
function validateCpfBR(input: string): boolean {
  const clean = input.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i], 10) * (factor - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = calc(clean.slice(0, 9), 10);
  const d2 = calc(clean.slice(0, 10), 11);
  return d1 === parseInt(clean[9], 10) && d2 === parseInt(clean[10], 10);
}

/** CNPJ Brasil — módulo 11 con pesos específicos. */
function validateCnpjBR(input: string): boolean {
  const clean = input.replace(/\D/g, "");
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;
  const calc = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i], 10) * weights[i];
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, ...w1];
  const d1 = calc(clean.slice(0, 12), w1);
  const d2 = calc(clean.slice(0, 13), w2);
  return d1 === parseInt(clean[12], 10) && d2 === parseInt(clean[13], 10);
}

/** RUT/RUN Chile — módulo 11 con dígito K permitido. */
function validateRutCL(input: string): boolean {
  const clean = input.replace(/[.\-\s]/g, "").toUpperCase();
  if (!/^\d{7,8}[\dK]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? "0" : mod === 10 ? "K" : String(mod);
  return dv === expected;
}

/** Cédula Ecuador — módulo 10 sobre dígitos con pesos 2,1,2,1,2,1,2,1,2. */
function validateCedulaEC(input: string): boolean {
  const clean = input.replace(/\D/g, "");
  if (clean.length !== 10) return false;
  const province = parseInt(clean.slice(0, 2), 10);
  if (province < 1 || (province > 24 && province !== 30)) return false;
  if (parseInt(clean[2], 10) > 6) return false;
  const digits = clean.slice(0, 9).split("").map(Number);
  const weights = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const sum = digits.reduce((acc, d, i) => {
    const p = d * weights[i];
    return acc + (p >= 10 ? p - 9 : p);
  }, 0);
  const mod = sum % 10;
  const expected = mod === 0 ? 0 : 10 - mod;
  return parseInt(clean[9], 10) === expected;
}

/** CI Uruguay — módulo 10 con pesos 2,9,8,7,6,3,4. */
function validateCiUY(input: string): boolean {
  const clean = input.replace(/\D/g, "").padStart(8, "0");
  if (clean.length !== 8) return false;
  const digits = clean.slice(0, 7).split("").map(Number);
  const weights = [2, 9, 8, 7, 6, 3, 4];
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  const mod = sum % 10;
  const expected = mod === 0 ? 0 : 10 - mod;
  return parseInt(clean[7], 10) === expected;
}

/** CUIT/CUIL Argentina — 11 dígitos módulo 11. */
function validateCuitAR(input: string): boolean {
  const clean = input.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const digits = clean.slice(0, 10).split("").map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  const mod = 11 - (sum % 11);
  const dv = mod === 11 ? 0 : mod === 10 ? 9 : mod;
  return parseInt(clean[10], 10) === dv;
}

/** Formato regex simple + longitud. */
function regexValidator(re: RegExp): IdDocValidator {
  return (v) => re.test(v);
}

// ─── Catálogo por país ────────────────────────────────────────────────────

export const ID_DOC_COUNTRIES: IdDocCountry[] = [
  {
    code: "CO",
    name: "Colombia",
    flag: "🇨🇴",
    types: [
      {
        code: "CC",
        name: "Cédula de Ciudadanía",
        numericOnly: true,
        placeholder: "10 dígitos",
        validate: regexValidator(/^\d{6,10}$/),
      },
      {
        code: "TI",
        name: "Tarjeta de Identidad",
        numericOnly: true,
        placeholder: "10-11 dígitos",
        validate: regexValidator(/^\d{10,11}$/),
      },
      {
        code: "CE",
        name: "Cédula de Extranjería",
        numericOnly: true,
        placeholder: "6-15 dígitos",
        validate: regexValidator(/^\d{6,15}$/),
      },
      {
        code: "NIT",
        name: "NIT (con dígito verificador)",
        numericOnly: true,
        placeholder: "9-10 dígitos + DV",
        validate: validateNitCO,
      },
      {
        code: "RC",
        name: "Registro Civil",
        numericOnly: true,
        placeholder: "8-11 dígitos",
        validate: regexValidator(/^\d{8,11}$/),
      },
      {
        code: "PP",
        name: "Pasaporte",
        numericOnly: false,
        placeholder: "6-12 alfanumérico",
        validate: regexValidator(/^[A-Z0-9]{6,12}$/i),
      },
    ],
  },
  {
    code: "MX",
    name: "México",
    flag: "🇲🇽",
    types: [
      {
        code: "CURP",
        name: "CURP",
        numericOnly: false,
        placeholder: "18 caracteres",
        validate: regexValidator(/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i),
      },
      {
        code: "RFC",
        name: "RFC",
        numericOnly: false,
        placeholder: "12-13 caracteres",
        validate: regexValidator(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i),
      },
      {
        code: "INE",
        name: "Clave INE",
        numericOnly: false,
        placeholder: "18 caracteres",
        validate: regexValidator(/^[A-Z]{6}\d{8}[HM]\d{3}$/i),
      },
    ],
  },
  {
    code: "AR",
    name: "Argentina",
    flag: "🇦🇷",
    types: [
      {
        code: "DNI",
        name: "DNI",
        numericOnly: true,
        placeholder: "7-8 dígitos",
        validate: regexValidator(/^\d{7,8}$/),
      },
      {
        code: "CUIT",
        name: "CUIT/CUIL",
        numericOnly: true,
        placeholder: "11 dígitos",
        validate: validateCuitAR,
      },
    ],
  },
  {
    code: "CL",
    name: "Chile",
    flag: "🇨🇱",
    types: [
      {
        code: "RUT",
        name: "RUT/RUN",
        numericOnly: false,
        placeholder: "12345678-K",
        validate: validateRutCL,
      },
    ],
  },
  {
    code: "PE",
    name: "Perú",
    flag: "🇵🇪",
    types: [
      {
        code: "DNI",
        name: "DNI",
        numericOnly: true,
        placeholder: "8 dígitos",
        validate: regexValidator(/^\d{8}$/),
      },
      {
        code: "RUC",
        name: "RUC",
        numericOnly: true,
        placeholder: "11 dígitos",
        validate: regexValidator(/^\d{11}$/),
      },
      {
        code: "CE",
        name: "Carné de Extranjería",
        numericOnly: true,
        placeholder: "9-12 dígitos",
        validate: regexValidator(/^\d{9,12}$/),
      },
    ],
  },
  {
    code: "BR",
    name: "Brasil",
    flag: "🇧🇷",
    types: [
      {
        code: "CPF",
        name: "CPF",
        numericOnly: true,
        placeholder: "11 dígitos",
        validate: validateCpfBR,
      },
      {
        code: "CNPJ",
        name: "CNPJ",
        numericOnly: true,
        placeholder: "14 dígitos",
        validate: validateCnpjBR,
      },
      {
        code: "RG",
        name: "RG",
        numericOnly: false,
        placeholder: "Formato varía por estado",
        validate: regexValidator(/^[A-Z0-9.\-]{5,20}$/i),
      },
    ],
  },
  {
    code: "UY",
    name: "Uruguay",
    flag: "🇺🇾",
    types: [
      {
        code: "CI",
        name: "Cédula de Identidad",
        numericOnly: true,
        placeholder: "8 dígitos",
        validate: validateCiUY,
      },
      {
        code: "RUT",
        name: "RUT",
        numericOnly: true,
        placeholder: "12 dígitos",
        validate: regexValidator(/^\d{12}$/),
      },
    ],
  },
  {
    code: "PY",
    name: "Paraguay",
    flag: "🇵🇾",
    types: [
      {
        code: "CI",
        name: "Cédula de Identidad",
        numericOnly: true,
        placeholder: "6-8 dígitos",
        validate: regexValidator(/^\d{6,8}$/),
      },
      {
        code: "RUC",
        name: "RUC",
        numericOnly: false,
        placeholder: "Dígitos + DV",
        validate: regexValidator(/^\d{6,9}-\d$/),
      },
    ],
  },
  {
    code: "BO",
    name: "Bolivia",
    flag: "🇧🇴",
    types: [
      {
        code: "CI",
        name: "Cédula de Identidad",
        numericOnly: true,
        placeholder: "5-10 dígitos",
        validate: regexValidator(/^\d{5,10}$/),
      },
    ],
  },
  {
    code: "VE",
    name: "Venezuela",
    flag: "🇻🇪",
    types: [
      {
        code: "V",
        name: "Cédula Venezolana (V-)",
        numericOnly: false,
        placeholder: "V-12345678",
        validate: regexValidator(/^V-?\d{5,9}$/i),
      },
      {
        code: "E",
        name: "Cédula Extranjería (E-)",
        numericOnly: false,
        placeholder: "E-12345678",
        validate: regexValidator(/^E-?\d{5,9}$/i),
      },
    ],
  },
  {
    code: "EC",
    name: "Ecuador",
    flag: "🇪🇨",
    types: [
      {
        code: "CI",
        name: "Cédula",
        numericOnly: true,
        placeholder: "10 dígitos",
        validate: validateCedulaEC,
      },
      {
        code: "RUC",
        name: "RUC",
        numericOnly: true,
        placeholder: "13 dígitos",
        validate: regexValidator(/^\d{13}$/),
      },
    ],
  },
  {
    code: "PA",
    name: "Panamá",
    flag: "🇵🇦",
    types: [
      {
        code: "CIP",
        name: "Cédula",
        numericOnly: false,
        placeholder: "X-XXX-XXX",
        validate: regexValidator(/^(PE|E|N|)?\d{1,2}-\d{2,4}-\d{2,6}$/i),
      },
      {
        code: "RUC",
        name: "RUC",
        numericOnly: false,
        placeholder: "Formato oficial",
        validate: regexValidator(/^\d{1,4}-\d{1,4}-\d{1,6}$/),
      },
    ],
  },
  {
    code: "CR",
    name: "Costa Rica",
    flag: "🇨🇷",
    types: [
      {
        code: "CI",
        name: "Cédula",
        numericOnly: true,
        placeholder: "9 dígitos",
        validate: regexValidator(/^\d{9}$/),
      },
      {
        code: "DIMEX",
        name: "DIMEX",
        numericOnly: true,
        placeholder: "11-12 dígitos",
        validate: regexValidator(/^\d{11,12}$/),
      },
    ],
  },
  {
    code: "GT",
    name: "Guatemala",
    flag: "🇬🇹",
    types: [
      {
        code: "DPI",
        name: "DPI",
        numericOnly: true,
        placeholder: "13 dígitos",
        validate: regexValidator(/^\d{13}$/),
      },
      {
        code: "NIT",
        name: "NIT",
        numericOnly: false,
        placeholder: "Dígitos + DV",
        validate: regexValidator(/^\d{1,8}-?[\dK]$/i),
      },
    ],
  },
  {
    code: "HN",
    name: "Honduras",
    flag: "🇭🇳",
    types: [
      {
        code: "DNI",
        name: "DNI",
        numericOnly: true,
        placeholder: "13 dígitos",
        validate: regexValidator(/^\d{13}$/),
      },
      {
        code: "RTN",
        name: "RTN",
        numericOnly: true,
        placeholder: "14 dígitos",
        validate: regexValidator(/^\d{14}$/),
      },
    ],
  },
  {
    code: "NI",
    name: "Nicaragua",
    flag: "🇳🇮",
    types: [
      {
        code: "CI",
        name: "Cédula",
        numericOnly: false,
        placeholder: "13 dígitos + letra",
        validate: regexValidator(/^\d{3}-?\d{6}-?\d{4}[A-Z]$/i),
      },
      {
        code: "RUC",
        name: "RUC",
        numericOnly: true,
        placeholder: "14 dígitos",
        validate: regexValidator(/^\d{14}$/),
      },
    ],
  },
  {
    code: "SV",
    name: "El Salvador",
    flag: "🇸🇻",
    types: [
      {
        code: "DUI",
        name: "DUI",
        numericOnly: false,
        placeholder: "XXXXXXXX-X",
        validate: regexValidator(/^\d{8}-\d$/),
      },
      {
        code: "NIT",
        name: "NIT",
        numericOnly: false,
        placeholder: "XXXX-XXXXXX-XXX-X",
        validate: regexValidator(/^\d{4}-\d{6}-\d{3}-\d$/),
      },
    ],
  },
  {
    code: "DO",
    name: "Rep. Dominicana",
    flag: "🇩🇴",
    types: [
      {
        code: "CI",
        name: "Cédula",
        numericOnly: true,
        placeholder: "11 dígitos",
        validate: regexValidator(/^\d{11}$/),
      },
      {
        code: "RNC",
        name: "RNC",
        numericOnly: true,
        placeholder: "9 dígitos",
        validate: regexValidator(/^\d{9}$/),
      },
    ],
  },
  {
    code: "PR",
    name: "Puerto Rico",
    flag: "🇵🇷",
    types: [
      {
        code: "SSN",
        name: "SSN",
        numericOnly: false,
        placeholder: "XXX-XX-XXXX",
        validate: regexValidator(/^\d{3}-?\d{2}-?\d{4}$/),
      },
    ],
  },
  {
    code: "CU",
    name: "Cuba",
    flag: "🇨🇺",
    types: [
      {
        code: "CI",
        name: "Carné de Identidad",
        numericOnly: true,
        placeholder: "11 dígitos",
        validate: regexValidator(/^\d{11}$/),
      },
    ],
  },
  {
    code: "US",
    name: "Estados Unidos",
    flag: "🇺🇸",
    types: [
      {
        code: "SSN",
        name: "SSN",
        numericOnly: false,
        placeholder: "XXX-XX-XXXX",
        validate: regexValidator(/^\d{3}-?\d{2}-?\d{4}$/),
      },
      {
        code: "ITIN",
        name: "ITIN",
        numericOnly: false,
        placeholder: "9XX-XX-XXXX",
        validate: regexValidator(/^9\d{2}-?\d{2}-?\d{4}$/),
      },
      {
        code: "EIN",
        name: "EIN",
        numericOnly: false,
        placeholder: "XX-XXXXXXX",
        validate: regexValidator(/^\d{2}-?\d{7}$/),
      },
      {
        code: "DL",
        name: "Driver License",
        numericOnly: false,
        placeholder: "Formato varía por estado",
        validate: regexValidator(/^[A-Z0-9]{4,20}$/i),
      },
      {
        code: "STATE_ID",
        name: "State ID",
        numericOnly: false,
        placeholder: "Formato varía por estado",
        validate: regexValidator(/^[A-Z0-9]{4,20}$/i),
      },
    ],
  },
];

/** Lookup rápido por code de país. */
export const ID_DOC_COUNTRY_MAP: Record<string, IdDocCountry> =
  Object.fromEntries(ID_DOC_COUNTRIES.map((c) => [c.code, c]));

/**
 * Aplica separador de miles cosmético al string mientras el usuario tipea.
 * Solo tiene sentido para tipos numéricos. Guarda `stripSeparator(input)`
 * en el submit para que la BD tenga siempre el valor limpio.
 */
export function formatWithSeparator(
  raw: string,
  separator: "dot" | "comma" | "none",
): string {
  if (separator === "none") return raw;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const sep = separator === "dot" ? "." : ",";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function stripSeparator(formatted: string): string {
  return formatted.replace(/[.,\s]/g, "");
}
