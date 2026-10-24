// Autorrelleno de datos generales a partir del último consentimiento de un
// paciente (por número de documento). Silencioso: solo completa campos VACÍOS,
// nunca `fecha` ni `profesional` (fecha de aplicación / quién atiende), y nunca
// copia respuestas del cuestionario, firmas ni foto. El aviso y `deshacer` son
// la única red de seguridad.

import { useCallback, useEffect, useRef, useState } from "react";
import { lookupPacienteApi, type ConsentRecordDto } from "../../../services/api";
import { fechaAIso } from "../vaccines/vaccineSchedule";
import type { ConsentDefinition, ConsentState } from "../engine/consentDefinition";

export type VacunaPrevia = { vacuna: string; dosis: string; aplicada: string; proxima: string; vencida: boolean };
type Aviso = { fecha: string; nombre: string };

const DEBOUNCE_MS = 600;
const MIN_DOC_LENGTH = 5;
// Lista BLANCA: solo identidad y contacto del PACIENTE. Todo lo demás (fecha, profesional,
// acompañante, respuestas de cuestionario...) NO se rellena aunque esté vacío.
// La identidad es un bloque todo-o-nada para no mezclar "nombre de A con apellido de B".
// `pacienteEmail` va DENTRO del bloque: el backend toma de ahí a quién se envía por correo el PDF firmado
// (irreversible), así que nunca puede venir de un registro distinto al del nombre. `entidad` NO se rellena
// (gemelo de `entidadRemite`: es propio de cada visita) y no debe entrar en IDENTITY_KEYS: su id colisiona
// con la columna `entidad` del registro ("SOUL"/"SAI").
const IDENTITY_BLOCK = ["nombres", "apellidos", "tipoDoc", "pacienteEmail"] as const;
const FILLABLE_FIELDS = [
  "ciudad", "pacienteFechaNac", "eps", "pacienteTelefono",
  "rh", "direccion", "genero",
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
  /** Id del consentimiento que se está editando: no cuenta como historial del paciente. */
  excludeId?: string,
): {
  aviso: Aviso | null;
  historial: VacunaPrevia[];
  /** Documento al que pertenece `historial` (null si no hay uno vigente). */
  historialDoc: string | null;
  /** La consulta del documento en pantalla falló (red, 401, 5xx): NO equivale a "sin historial". */
  consultaFallida: boolean;
  deshacer: () => void;
} {
  // El resultado va ligado al documento que lo originó: al cambiar numDoc deja de verse sin setState en el efecto.
  const [result, setResult] = useState<{
    doc: string; aviso: Aviso | null; historial: VacunaPrevia[]; fallo?: boolean;
  } | null>(null);

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
      const { data, error } = await lookupPacienteApi(numDoc, entidad, excludeId);
      if (cancelled) return;
      if (error || !data) {
        // Sin esto, un fallo se lee como "este paciente no tiene vacunas previas".
        setResult({ doc: numDoc, aviso: null, historial: [], fallo: true });
        return;
      }

      const hoy = hoyIso();
      // `proxima` puede venir en ISO (registros antiguos) o dd/mm/aaaa: se compara siempre en ISO.
      const historial = (data.vacunas ?? []).map((v) => {
        const prox = fechaAIso(v.proxima);
        return { ...v, vencida: prox !== "" && prox <= hoy };
      });

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
  }, [numDoc, entidad, enabled, excludeId]);

  const deshacer = useCallback(() => {
    revertFill(filledRef, previousRef, stateRef, onChangeRef);
    setResult((r) => (r ? { ...r, aviso: null } : r));
  }, []);

  const vigente = result && result.doc === numDoc && numDoc.length >= MIN_DOC_LENGTH ? result : null;
  return {
    aviso: enabled ? (vigente?.aviso ?? null) : null,
    historial: vigente?.historial ?? [],
    historialDoc: vigente && !vigente.fallo ? vigente.doc : null,
    consultaFallida: !!vigente?.fallo,
    deshacer,
  };
}
