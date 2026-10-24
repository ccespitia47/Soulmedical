export type Unidad = "dias" | "meses" | "anios";
export type Intervalo = { cantidad: number; unidad: Unidad };
export type EsquemaEntry = {
  label: string;
  vacuna: string;
  dosis: string;
  intervalo: Intervalo | null;
  esUltima: boolean;
};

export const OTRA_LABEL = "Otra (escribir a mano)";

const d = (cantidad: number): Intervalo => ({ cantidad, unidad: "dias" });
const m = (cantidad: number): Intervalo => ({ cantidad, unidad: "meses" });
const a = (cantidad: number): Intervalo => ({ cantidad, unidad: "anios" });

// Transcripción literal de la tabla del spec (§2). La "Próxima aplicación" se
// cuenta DESDE LA DOSIS 1. ROTAVIRUS D2 (1 mes) < D1 (2 meses) es dato clínico.
const ESQUEMA: ReadonlyArray<readonly [string, number, Intervalo]> = [
  ["ANTIRRABICA POS", 1, d(3)],
  ["ANTIRRABICA POS", 2, d(7)],
  ["ANTIRRABICA POS", 3, d(14)],
  ["ANTIRRABICA PRE", 1, d(7)],
  ["DENGUE", 1, m(3)],
  ["DPT-a", 1, a(10)],
  ["DPT-a + POLIO", 1, m(2)],
  ["DPT-a + POLIO", 2, m(6)],
  ["HEPATITIS A", 1, m(6)],
  ["HEPATITIS A + B", 1, m(1)],
  ["HEPATITIS A + B", 2, m(5)],
  ["HEPATITIS B", 1, m(1)],
  ["HEPATITIS B", 2, m(5)],
  ["HERPES ZOSTER", 1, m(2)],
  ["HEXAVALENTE", 1, m(2)],
  ["HEXAVALENTE", 2, m(4)],
  ["MENINGOCOCO AYW 135", 1, m(2)],
  ["MENINGOCOCO B", 1, m(2)],
  ["NEUMOCOCO 13", 1, m(2)],
  ["NEUMOCOCO 13", 2, m(4)],
  ["NEUMOCOCO 15", 1, m(2)],
  ["NEUMOCOCO 15", 2, m(4)],
  ["NEUMOCOCO 23", 1, a(5)],
  ["PENTAVALENTE", 1, m(2)],
  ["PENTAVALENTE", 2, m(4)],
  ["ROTAVIRUS", 1, m(2)],
  ["ROTAVIRUS", 2, m(1)],
  ["TETANO", 1, m(1)],
  ["TETANO", 2, m(5)],
  ["TETANO", 3, a(1)],
  ["TETANO", 4, a(1)],
  ["VARICELA", 1, m(2)],
  ["VPH", 1, m(2)],
  ["VPH", 2, m(4)],
];

const DOSIS_UNICA = [
  "TRIPLE VIRAL",
  "FIEBRE AMARILLA",
  "NEUMOCOCO 13",
  "PENTAVALENTE",
  "HEXAVALENTE",
  "MENINGOCOCO",
  "FIEBRE TIFOIDEA",
  "INFLUENZA",
];

const maxDosis = new Map<string, number>();
for (const [vacuna, dosis] of ESQUEMA) {
  maxDosis.set(vacuna, Math.max(maxDosis.get(vacuna) ?? 0, dosis));
}

export const CATALOGO: EsquemaEntry[] = [
  ...ESQUEMA.map(([vacuna, dosis, intervalo]) => ({
    label: `${vacuna} D${dosis}`,
    vacuna,
    dosis: String(dosis),
    intervalo,
    esUltima: dosis === maxDosis.get(vacuna),
  })),
  ...DOSIS_UNICA.map((vacuna) => ({
    label: `${vacuna} · dosis única`,
    vacuna,
    dosis: "única",
    intervalo: null,
    esUltima: true,
  })),
];

export function findEntry(label: string): EsquemaEntry | undefined {
  return CATALOGO.find((e) => e.label === label);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Suma un intervalo a una fecha ISO yyyy-mm-dd (a mediodía, sin cruce de día por zona horaria). */
export function addIntervalo(baseIso: string, intervalo: Intervalo): string {
  const [y, mo, day] = baseIso.split("-").map(Number);
  const date = new Date(y, mo - 1, day, 12, 0, 0);
  if (intervalo.unidad === "dias") {
    date.setDate(date.getDate() + intervalo.cantidad);
  } else {
    const meses = intervalo.unidad === "meses" ? intervalo.cantidad : intervalo.cantidad * 12;
    date.setDate(1);
    date.setMonth(date.getMonth() + meses);
    const ultimo = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, ultimo));
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function calcularProxima(entry: EsquemaEntry, fechaDosis1: string): string {
  if (entry.esUltima || !entry.intervalo || !fechaDosis1) return "";
  return addIntervalo(fechaDosis1, entry.intervalo);
}

export function siguienteDosisLabel(vacuna: string, dosisRegistradas: string[]): string | null {
  const max = maxDosis.get(vacuna);
  if (max === undefined) return null;
  const nums = dosisRegistradas.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n));
  const siguiente = (nums.length ? Math.max(...nums) : 0) + 1;
  if (siguiente > max) return null;
  return `${vacuna} D${siguiente}`;
}
