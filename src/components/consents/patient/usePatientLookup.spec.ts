import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";

vi.mock("../../../services/api", () => ({ lookupPacienteApi: vi.fn() }));
import { lookupPacienteApi, type ConsentRecordDto } from "../../../services/api";
import { usePatientLookup } from "./usePatientLookup";
import type { ConsentDefinition, ConsentState } from "../engine/consentDefinition";

const def = {
  meta: { tipo: "vacunacion", entidad: "SOUL", titulo: "", entidadNombre: "", displayName: "", codigo: "", version: "", logo: "" },
  sections: [
    {
      id: "datos", kind: "fields",
      fields: [
        { id: "fecha", label: "Fecha", type: "date" },
        { id: "profesional", label: "Profesional", type: "text" },
        { id: "tipoDoc", label: "Tipo", type: "text" },
        { id: "numDoc", label: "Doc", type: "text" },
        { id: "nombres", label: "Nombres", type: "text" },
        { id: "apellidos", label: "Apellidos", type: "text" },
        { id: "ciudad", label: "Ciudad", type: "text" },
        { id: "eps", label: "EPS", type: "text" },
      ],
    },
    { id: "q", kind: "tristate", questions: [{ id: "alergia", label: "Alergia" }] },
  ],
} as unknown as ConsentDefinition;

const empty: ConsentState = { values: {}, firma: "", firmaResp: "", foto: "", accepted: false };

const ultimo: ConsentRecordDto = {
  id: "r1", tipo: "vacunacion", entidad: "SOUL", tipoDoc: "CC", numDoc: "12345678",
  nombres: "Ana", apellidos: "Pérez", ciudad: "Bogotá", profesional: "Dr. Viejo", estado: "ok",
  respuestas: { fecha: "2020-01-01", profesional: "Dr. Viejo", eps: "Sanitas", alergia: "Sí" },
  firmaPaciente: "sig", firmaResponsable: null, foto: "foto", hashVerificacion: "h", createdAt: "2024-03-15T12:00:00.000Z",
};

function setup(initial: Record<string, string> = {}) {
  return renderHook(() => {
    const [state, setState] = useState<ConsentState>({ ...empty, values: { ...initial } });
    const lookup = usePatientLookup(def, state, (p) => setState((s) => ({ ...s, ...p })));
    return { state, setState, ...lookup };
  });
}

async function typeDoc(r: ReturnType<typeof setup>, numDoc: string) {
  act(() => r.result.current.setState((s) => ({ ...s, values: { ...s.values, numDoc } })));
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
}

describe("usePatientLookup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(lookupPacienteApi).mockResolvedValue({ data: { ultimo, vacunas: [] }, error: null });
  });
  afterEach(() => vi.useRealTimers());

  it("rellena solo los campos vacíos", async () => {
    const r = setup({ nombres: "Ya escrito" });
    await typeDoc(r, "12345678");
    expect(lookupPacienteApi).toHaveBeenCalledWith("12345678", "SOUL");
    expect(r.result.current.state.values.nombres).toBe("Ya escrito");
    expect(r.result.current.state.values.ciudad).toBe("Bogotá");
    expect(r.result.current.state.values.apellidos).toBe("Pérez");
    expect(r.result.current.state.values.tipoDoc).toBe("CC");
    expect(r.result.current.state.values.eps).toBe("Sanitas");
  });

  it("nunca rellena fecha ni profesional, ni respuestas, firmas o foto", async () => {
    const r = setup();
    await typeDoc(r, "12345678");
    const s = r.result.current.state;
    expect(s.values.fecha).toBeUndefined();
    expect(s.values.profesional).toBeUndefined();
    expect(s.values.alergia).toBeUndefined();
    expect(s.firma).toBe("");
    expect(s.foto).toBe("");
  });

  it("no consulta con menos de 5 caracteres", async () => {
    const r = setup();
    await typeDoc(r, "1234");
    expect(lookupPacienteApi).not.toHaveBeenCalled();
  });

  it("emite aviso con nombre y fecha del origen", async () => {
    const r = setup();
    await typeDoc(r, "12345678");
    expect(r.result.current.aviso?.nombre).toBe("Ana Pérez");
    expect(r.result.current.aviso?.fecha).toMatch(/2024/);
  });

  it("deshacer devuelve los valores previos", async () => {
    const r = setup({ nombres: "Ya escrito" });
    await typeDoc(r, "12345678");
    act(() => r.result.current.deshacer());
    const v = r.result.current.state.values;
    expect(v.nombres).toBe("Ya escrito");
    expect(v.ciudad).toBe("");
    expect(v.numDoc).toBe("12345678");
    expect(r.result.current.aviso).toBeNull();
  });

  it("sin paciente no emite aviso", async () => {
    vi.mocked(lookupPacienteApi).mockResolvedValue({ data: { ultimo: null, vacunas: [] }, error: null });
    const r = setup();
    await typeDoc(r, "12345678");
    expect(r.result.current.aviso).toBeNull();
    expect(r.result.current.state.values.nombres).toBeUndefined();
  });

  it("marca vencida la próxima dosis ya cumplida", async () => {
    vi.mocked(lookupPacienteApi).mockResolvedValue({
      data: { ultimo: null, vacunas: [
        { vacuna: "A", dosis: "1", aplicada: "2020-01-01", proxima: "2020-02-01" },
        { vacuna: "B", dosis: "1", aplicada: "2020-01-01", proxima: "2999-01-01" },
        { vacuna: "C", dosis: "1", aplicada: "2020-01-01", proxima: "" },
      ] }, error: null,
    });
    const r = setup();
    await typeDoc(r, "12345678");
    expect(r.result.current.historial.map((h) => h.vencida)).toEqual([true, false, false]);
  });
});
