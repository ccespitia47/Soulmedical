import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";

vi.mock("../../../services/api", () => ({ lookupPacienteApi: vi.fn() }));
import { lookupPacienteApi, type ConsentRecordDto } from "../../../services/api";
import { usePatientLookup } from "./usePatientLookup";
import { venopuncionDefinition } from "../definitions/venopuncion";
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

function setup(initial: Record<string, string> = {}, d: ConsentDefinition = def, enabled = true) {
  return renderHook(() => {
    const [state, setState] = useState<ConsentState>({ ...empty, values: { ...initial } });
    const lookup = usePatientLookup(d, state, (p) => setState((s) => ({ ...s, ...p })), enabled);
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
    // Identidad todo-o-nada: con "nombres" ya escrito no se mezcla el resto de la identidad.
    expect(r.result.current.state.values.apellidos ?? "").toBe("");
    expect(r.result.current.state.values.tipoDoc ?? "").toBe("");
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

  it("enabled=false: puebla el historial pero no toca ningún campo ni emite aviso", async () => {
    vi.mocked(lookupPacienteApi).mockResolvedValue({
      data: { ultimo, vacunas: [{ vacuna: "A", dosis: "1", aplicada: "2020-01-01", proxima: "2020-02-01" }] }, error: null,
    });
    const r = setup({}, def, false);
    await typeDoc(r, "12345678");
    expect(lookupPacienteApi).toHaveBeenCalledWith("12345678", "SOUL");
    expect(r.result.current.historial).toHaveLength(1);
    expect(r.result.current.aviso).toBeNull();
    expect(r.result.current.state.values).toEqual({ numDoc: "12345678" });
    await typeDoc(r, "87654321");
    expect(r.result.current.state.values).toEqual({ numDoc: "87654321" });
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

  it("numDoc cambia con la petición en vuelo: la respuesta tardía no rellena", async () => {
    let resolve!: (v: unknown) => void;
    vi.mocked(lookupPacienteApi).mockReturnValueOnce(new Promise((r) => { resolve = r; }) as never);
    const r = setup();
    await typeDoc(r, "12345678");
    act(() => r.result.current.setState((s) => ({ ...s, values: { ...s.values, numDoc: "87654321" } })));
    await act(async () => { resolve({ data: { ultimo, vacunas: [] }, error: null }); });
    expect(r.result.current.state.values.ciudad).toBeUndefined();
    expect(r.result.current.aviso).toBeNull();
  });

  it("numDoc cambia después de rellenar: los valores de A no sobreviven", async () => {
    const r = setup();
    await typeDoc(r, "12345678");
    expect(r.result.current.state.values.ciudad).toBe("Bogotá");
    vi.mocked(lookupPacienteApi).mockResolvedValue({ data: { ultimo: null, vacunas: [] }, error: null });
    await typeDoc(r, "123456789");
    const v = r.result.current.state.values;
    expect(v.nombres ?? "").toBe("");
    expect(v.ciudad ?? "").toBe("");
    expect(v.eps ?? "").toBe("");
    expect(v.numDoc).toBe("123456789");
    expect(r.result.current.aviso).toBeNull();
  });

  it("al cambiar numDoc respeta lo que el profesional editó tras el relleno", async () => {
    const r = setup();
    await typeDoc(r, "12345678");
    act(() => r.result.current.setState((s) => ({ ...s, values: { ...s.values, ciudad: "Cali" } })));
    vi.mocked(lookupPacienteApi).mockResolvedValue({ data: { ultimo: null, vacunas: [] }, error: null });
    await typeDoc(r, "123456789");
    expect(r.result.current.state.values.ciudad).toBe("Cali");
    expect(r.result.current.state.values.nombres ?? "").toBe("");
  });

  it("un campo con solo espacios cuenta como vacío", async () => {
    const r = setup({ ciudad: "   " });
    await typeDoc(r, "12345678");
    expect(r.result.current.state.values.ciudad).toBe("Bogotá");
  });

  it("identidad todo-o-nada: si hay un apellido tecleado no se rellena nombres ni tipoDoc", async () => {
    const r = setup({ apellidos: "Gómez" });
    await typeDoc(r, "12345678");
    const v = r.result.current.state.values;
    expect(v.apellidos).toBe("Gómez");
    expect(v.nombres ?? "").toBe("");
    expect(v.tipoDoc ?? "").toBe("");
    expect(v.ciudad).toBe("Bogotá");
  });

  it("con venopunción real no rellena profesional ni acompañante, sí paciente", async () => {
    const todos: Record<string, string> = {};
    for (const sec of venopuncionDefinition.sections) {
      if (sec.kind === "fields") for (const f of sec.fields) todos[f.id] = "PREVIO";
    }
    vi.mocked(lookupPacienteApi).mockResolvedValue({
      data: { ultimo: { ...ultimo, entidad: null, respuestas: todos }, vacunas: [] }, error: null,
    });
    const r = setup({}, venopuncionDefinition);
    await typeDoc(r, "12345678");
    const v = r.result.current.state.values;
    // Conjunto EXACTO: añadir un id a la lista blanca obliga a tocar este test a conciencia.
    const esperado = ["apellidos", "genero", "nombres", "tipoDoc"];
    const rellenados = Object.keys(v).filter((k) => k !== "numDoc").sort();
    const sobran = rellenados.filter((k) => !esperado.includes(k));
    const faltan = esperado.filter((k) => !rellenados.includes(k));
    expect(sobran, `ids rellenados que NO deberían: ${sobran.join(", ")}`).toEqual([]);
    expect(faltan, `ids que deberían rellenarse: ${faltan.join(", ")}`).toEqual([]);
  });

  it("un id fuera de ambas listas no se rellena nunca, aunque exista, esté vacío y venga en el registro", async () => {
    const defExtra = {
      ...def,
      sections: [{ id: "datos", kind: "fields", fields: [
        { id: "nombres", label: "Nombres", type: "text" },
        { id: "edad", label: "Edad", type: "text" },
        { id: "campoNuevo", label: "Nuevo", type: "text" },
      ] }],
    } as unknown as ConsentDefinition;
    vi.mocked(lookupPacienteApi).mockResolvedValue({
      data: { ultimo: { ...ultimo, respuestas: { edad: "40", campoNuevo: "X" } }, vacunas: [] }, error: null,
    });
    const r = setup({ edad: "", campoNuevo: "" }, defExtra);
    await typeDoc(r, "12345678");
    expect(r.result.current.state.values.nombres).toBe("Ana");
    expect(r.result.current.state.values.edad).toBe("");
    expect(r.result.current.state.values.campoNuevo).toBe("");
  });
});
