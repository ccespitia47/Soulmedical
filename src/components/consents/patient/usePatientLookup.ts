// Autorrelleno de datos generales a partir del último consentimiento de un
// paciente (por número de documento). Silencioso: solo completa campos VACÍOS,
// nunca `fecha` ni `profesional` (fecha de aplicación / quién atiende), y nunca
// copia respuestas del cuestionario, firmas ni foto. El aviso y `deshacer` son
// la única red de seguridad.

import { useCallback, useEffect, useRef, useState } from "react";
import { lookupPacienteApi, type ConsentRecordDto } from "../../../services/api";
import type { ConsentDefinition, ConsentState } from "../engine/consentDefinition";

export type VacunaPrevia = { vacuna: string; dosis: string; aplicada: string; proxima: string; vencida: boolean };
type Aviso = { fecha: string; nombre: string };

const DEBOUNCE_MS = 600;
const MIN_DOC_LENGTH = 5;
// Lista BLANCA: solo identidad y contacto del PACIENTE. Todo lo demás (fecha, profesional,
// acompañante, respuestas de cuestionario...) NO se rellena aunque esté vacío.
// La identidad es un bloque todo-o-nada para no mezclar "nombre de A con apellido de B".
const IDENTITY_BLOCK = ["nombres", "apellidos", "tipoDoc"] as const;
const FILLABLE_FIELDS = [
  "ciudad", "pacienteFechaNac", "eps", "pacienteTelefono", "pacienteEmail",
  "rh", "direccion", "genero", "entidad",
] as const;
const IDENTITY_KEYS = ["tipoDoc", "nombres", "apellidos", "ciudad"] as const;

function definedIds(def: ConsentDefinition): Set<string> {
  const ids = new Set<string>();
  for (const s of def.sections) {
    if (s.kind === "fields") for (const f of s.fields) ids.add(f.id);
  }
  return ids;
}

function fillableIds(def: ConsentDefinition, current: Record<string, string>): string[] {
  const defined = definedIds(def);
  const identity = IDENTITY_BLOCK.filter((id) => defined.has(id));
  const identityFree = identity.every((id) => (current[id] ?? "").trim() === "");
  return [...(identityFree ? identity : []), ...FILLABLE_FIELDS.filter((id) => defined.has(id))];
}

function sourceValue(rec: ConsentRecordDto, id: string): string {
  if ((IDENTITY_KEYS as readonly string[]).includes(id)) {
    const v = (rec as unknown as Record<string, unknown>)[id];
    return typeof v === "string" ? v : "";
  }
  const v = rec.respuestas?.[id];
  return typeof v === "string" ? v : "";
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Ref<T> = { current: T };

/** Revierte lo rellenado. Solo toca lo que sigue siendo el valor rellenado: no borra ediciones posteriores. */
function revertFill(
  filledRef: Ref<Record<string, string>>,
  previousRef: Ref<Record<string, string>>,
  stateRef: Ref<ConsentState>,
  onChangeRef: Ref<(p: Partial<ConsentState>) => void>,
) {
  const filled = filledRef.current;
  const ids = Object.keys(filled);
  if (ids.length === 0) return;
  const values = { ...stateRef.current.values };
  for (const id of ids) {
    if (values[id] === filled[id]) values[id] = previousRef.current[id] ?? "";
  }
  filledRef.current = {};
  previousRef.current = {};
  onChangeRef.current({ values });
}

export function usePatientLookup(
  def: ConsentDefinition,
  state: ConsentState,
  onChange: (p: Partial<ConsentState>) => void,
  /** false (p. ej. al editar un consentimiento ya guardado): consulta y devuelve el historial (solo lectura),
   *  pero no rellena ningún campo ni emite aviso. */
  enabled = true,
): { aviso: Aviso | null; historial: VacunaPrevia[]; deshacer: () => void } {
  // El resultado va ligado al documento que lo originó: al cambiar numDoc deja de verse sin setState en el efecto.
  const [result, setResult] = useState<{ doc: string; aviso: Aviso | null; historial: VacunaPrevia[] } | null>(null);

  const stateRef = useRef(state);
  const onChangeRef = useRef(onChange);
  const defRef = useRef(def);
  useEffect(() => {
    stateRef.current = state;
    onChangeRef.current = onChange;
    defRef.current = def;
  });

  // Valores que rellenamos (id -> valor puesto) y lo que había antes, para deshacer.
  const filledRef = useRef<Record<string, string>>({});
  const previousRef = useRef<Record<string, string>>({});

  const numDoc = (state.values.numDoc ?? "").trim();
  const entidad = def.meta.entidad;

  useEffect(() => {
    // Invariante: lo rellenado corresponde siempre al documento en pantalla. Si numDoc cambia,
    // se revierte el relleno anterior (respetando lo que el profesional editó después).
    revertFill(filledRef, previousRef, stateRef, onChangeRef);
    if (numDoc.length < MIN_DOC_LENGTH) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await lookupPacienteApi(numDoc, entidad);
      if (cancelled || !data) return;

      const hoy = hoyIso();
      const historial = (data.vacunas ?? []).map((v) => ({ ...v, vencida: v.proxima !== "" && v.proxima <= hoy }));

      const rec = data.ultimo;
      if (!enabled || !rec) {
        setResult({ doc: numDoc, aviso: null, historial });
        return;
      }

      const current = stateRef.current.values;
      const patch: Record<string, string> = {};
      const prev: Record<string, string> = {};
      for (const id of fillableIds(defRef.current, current)) {
        if ((current[id] ?? "").trim() !== "") continue;
        const v = sourceValue(rec, id);
        if (v === "") continue;
        patch[id] = v;
        prev[id] = current[id] ?? "";
      }
      if (Object.keys(patch).length === 0) {
        setResult({ doc: numDoc, aviso: null, historial });
        return;
      }

      filledRef.current = patch;
      previousRef.current = prev;
      onChangeRef.current({ values: { ...current, ...patch } });
      setResult({
        doc: numDoc,
        historial,
        aviso: {
          nombre: [rec.nombres, rec.apellidos].filter(Boolean).join(" ").trim(),
          fecha: formatFecha(rec.createdAt),
        },
      });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [numDoc, entidad, enabled]);

  const deshacer = useCallback(() => {
    revertFill(filledRef, previousRef, stateRef, onChangeRef);
    setResult((r) => (r ? { ...r, aviso: null } : r));
  }, []);

  const vigente = result && result.doc === numDoc && numDoc.length >= MIN_DOC_LENGTH ? result : null;
  return { aviso: enabled ? (vigente?.aviso ?? null) : null, historial: vigente?.historial ?? [], deshacer };
}
