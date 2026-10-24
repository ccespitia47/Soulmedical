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
const NEVER_FILL = new Set(["numDoc", "fecha", "profesional"]);
const IDENTITY_KEYS = ["tipoDoc", "nombres", "apellidos", "ciudad"] as const;

function fillableIds(def: ConsentDefinition): string[] {
  const ids: string[] = [];
  for (const s of def.sections) {
    if (s.kind !== "fields") continue;
    for (const f of s.fields) if (!NEVER_FILL.has(f.id)) ids.push(f.id);
  }
  return ids;
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

export function usePatientLookup(
  def: ConsentDefinition,
  state: ConsentState,
  onChange: (p: Partial<ConsentState>) => void,
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
    filledRef.current = {};
    previousRef.current = {};
    if (numDoc.length < MIN_DOC_LENGTH) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await lookupPacienteApi(numDoc, entidad);
      if (cancelled || !data) return;

      const hoy = hoyIso();
      const historial = (data.vacunas ?? []).map((v) => ({ ...v, vencida: v.proxima !== "" && v.proxima <= hoy }));

      const rec = data.ultimo;
      if (!rec) {
        setResult({ doc: numDoc, aviso: null, historial });
        return;
      }

      const current = stateRef.current.values;
      const patch: Record<string, string> = {};
      const prev: Record<string, string> = {};
      for (const id of fillableIds(defRef.current)) {
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
  }, [numDoc, entidad]);

  const deshacer = useCallback(() => {
    const filled = filledRef.current;
    const prev = previousRef.current;
    const values = { ...stateRef.current.values };
    // Solo se revierte lo que sigue siendo lo rellenado: no se borra lo que el profesional editó después.
    for (const id of Object.keys(filled)) {
      if (values[id] === filled[id]) values[id] = prev[id] ?? "";
    }
    filledRef.current = {};
    previousRef.current = {};
    onChangeRef.current({ values });
    setResult((r) => (r ? { ...r, aviso: null } : r));
  }, []);

  const vigente = result && result.doc === numDoc && numDoc.length >= MIN_DOC_LENGTH ? result : null;
  return { aviso: vigente?.aviso ?? null, historial: vigente?.historial ?? [], deshacer };
}
