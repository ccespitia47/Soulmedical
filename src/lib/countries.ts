export type Country = {
  code: string;        // ISO 3166-1 alpha-2
  name: string;
  dialCode: string;    // con "+"
  flag: string;        // emoji
  pattern: RegExp;     // valida el número (sin el dialCode, solo dígitos)
  placeholder: string;
  maxLength: number;   // total digits the user can type for this country
};

// Colombia primero (mercado principal). Resto alfabético por name.
export const COUNTRIES: Country[] = [
  { code: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴", pattern: /^3\d{9}$/, placeholder: "300 123 4567", maxLength: 10 },
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷", pattern: /^\d{10,11}$/, placeholder: "11 1234 5678", maxLength: 11 },
  { code: "BO", name: "Bolivia", dialCode: "+591", flag: "🇧🇴", pattern: /^[67]\d{7}$/, placeholder: "7 123 4567", maxLength: 8 },
  { code: "BR", name: "Brasil", dialCode: "+55", flag: "🇧🇷", pattern: /^\d{10,11}$/, placeholder: "11 91234 5678", maxLength: 11 },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱", pattern: /^9\d{8}$/, placeholder: "9 1234 5678", maxLength: 9 },
  { code: "CR", name: "Costa Rica", dialCode: "+506", flag: "🇨🇷", pattern: /^\d{8}$/, placeholder: "1234 5678", maxLength: 8 },
  { code: "CU", name: "Cuba", dialCode: "+53", flag: "🇨🇺", pattern: /^\d{8}$/, placeholder: "1234 5678", maxLength: 8 },
  { code: "DO", name: "República Dominicana", dialCode: "+1", flag: "🇩🇴", pattern: /^\d{10}$/, placeholder: "809 123 4567", maxLength: 10 },
  { code: "EC", name: "Ecuador", dialCode: "+593", flag: "🇪🇨", pattern: /^\d{9}$/, placeholder: "9 1234 5678", maxLength: 9 },
  { code: "ES", name: "España", dialCode: "+34", flag: "🇪🇸", pattern: /^[6-9]\d{8}$/, placeholder: "612 34 56 78", maxLength: 9 },
  { code: "SV", name: "El Salvador", dialCode: "+503", flag: "🇸🇻", pattern: /^\d{8}$/, placeholder: "1234 5678", maxLength: 8 },
  { code: "US", name: "Estados Unidos", dialCode: "+1", flag: "🇺🇸", pattern: /^\d{10}$/, placeholder: "555 123 4567", maxLength: 10 },
  { code: "GT", name: "Guatemala", dialCode: "+502", flag: "🇬🇹", pattern: /^\d{8}$/, placeholder: "1234 5678", maxLength: 8 },
  { code: "HN", name: "Honduras", dialCode: "+504", flag: "🇭🇳", pattern: /^\d{8}$/, placeholder: "1234 5678", maxLength: 8 },
  { code: "MX", name: "México", dialCode: "+52", flag: "🇲🇽", pattern: /^\d{10}$/, placeholder: "55 1234 5678", maxLength: 10 },
  { code: "NI", name: "Nicaragua", dialCode: "+505", flag: "🇳🇮", pattern: /^\d{8}$/, placeholder: "1234 5678", maxLength: 8 },
  { code: "PA", name: "Panamá", dialCode: "+507", flag: "🇵🇦", pattern: /^\d{7,8}$/, placeholder: "1234 5678", maxLength: 8 },
  { code: "PY", name: "Paraguay", dialCode: "+595", flag: "🇵🇾", pattern: /^9\d{8}$/, placeholder: "9 1234 5678", maxLength: 9 },
  { code: "PE", name: "Perú", dialCode: "+51", flag: "🇵🇪", pattern: /^9\d{8}$/, placeholder: "9 1234 5678", maxLength: 9 },
  { code: "PR", name: "Puerto Rico", dialCode: "+1", flag: "🇵🇷", pattern: /^\d{10}$/, placeholder: "787 123 4567", maxLength: 10 },
  { code: "UY", name: "Uruguay", dialCode: "+598", flag: "🇺🇾", pattern: /^9\d{7}$/, placeholder: "9 123 4567", maxLength: 8 },
  { code: "VE", name: "Venezuela", dialCode: "+58", flag: "🇻🇪", pattern: /^4\d{9}$/, placeholder: "412 123 4567", maxLength: 10 },
];

export function findCountry(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
}
