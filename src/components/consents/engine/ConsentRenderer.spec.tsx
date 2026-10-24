import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ConsentRenderer from "./ConsentRenderer";
import type { ConsentDefinition, ConsentState } from "./consentDefinition";
import { OTRA_CIUDAD_LABEL } from "../cities/colombiaCities";

const def: ConsentDefinition = {
  meta: { tipo: "vih", titulo: "VIH", entidadNombre: "SOUL", displayName: "SOUL", codigo: "C", version: "1", logo: "" },
  sections: [{ id: "g", kind: "fields", title: "Datos", fields: [{ id: "nombres", label: "Nombres", type: "text", required: true }] }],
};
const state: ConsentState = { values: {}, firma: "", firmaResp: "", foto: "", accepted: false };

describe("ConsentRenderer", () => {
  it("renderiza campos y propaga cambios", () => {
    const onChange = vi.fn();
    render(<ConsentRenderer definition={def} state={state} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/nombres/i), { target: { value: "Ana" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ values: expect.objectContaining({ nombres: "Ana" }) }));
  });
});

describe("ConsentRenderer ciudad", () => {
  const defCiudad: ConsentDefinition = {
    ...def,
    sections: [{ id: "g", kind: "fields", title: "Datos", fields: [{ id: "ciudad", label: "Ciudad", type: "text" }] }],
  };
  it("renderiza ciudad como desplegable y guarda 'Municipio, Departamento'", () => {
    const onChange = vi.fn();
    render(<ConsentRenderer definition={defCiudad} state={state} onChange={onChange} />);
    const sel = screen.getByLabelText(/ciudad/i);
    expect(sel.tagName).toBe("SELECT");
    fireEvent.change(sel, { target: { value: "Medellín, Antioquia" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ values: expect.objectContaining({ ciudad: "Medellín, Antioquia" }) }));
  });
  it("conserva un valor guardado fuera de la lista", () => {
    render(<ConsentRenderer definition={defCiudad} state={{ ...state, values: { ciudad: "Pueblo Raro" } }} onChange={vi.fn()} />);
    expect((screen.getByLabelText(/ciudad/i) as HTMLSelectElement).value).toBe("Pueblo Raro");
  });
});

describe("ConsentRenderer autorrelleno (prefill)", () => {
  const defDoc: ConsentDefinition = {
    ...def,
    sections: [{ id: "g", kind: "fields", title: "Datos", fields: [
      { id: "numDoc", label: "Documento", type: "text" },
      { id: "nombres", label: "Nombres", type: "text" },
    ] }],
  };
  const conDoc: ConsentState = { ...state, values: { numDoc: "12345678" } };
  const lookup = vi.fn();

  beforeEach(async () => {
    vi.useFakeTimers();
    lookup.mockReset();
    lookup.mockResolvedValue({ data: { ultimo: null, vacunas: [] }, error: null });
    const api = await import("../../../services/api");
    vi.spyOn(api, "lookupPacienteApi").mockImplementation(lookup);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("con prefill={false} consulta pero no muta el formulario ni avisa", async () => {
    lookup.mockResolvedValue({ data: { ultimo: { nombres: "Ana", apellidos: "P", createdAt: "2024-03-15T12:00:00.000Z", respuestas: {} }, vacunas: [] }, error: null });
    const onChange = vi.fn();
    render(<ConsentRenderer definition={defDoc} state={conDoc} onChange={onChange} prefill={false} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(lookup).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("por defecto sigue consultando", async () => {
    render(<ConsentRenderer definition={defDoc} state={conDoc} onChange={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(lookup).toHaveBeenCalledWith("12345678", undefined, undefined);
  });
});

describe("ConsentRenderer ciudad: escape a texto libre", () => {
  const defCiudad: ConsentDefinition = {
    ...def,
    sections: [{ id: "g", kind: "fields", title: "Datos", fields: [{ id: "ciudad", label: "Ciudad", type: "text", required: true }] }],
  };
  function Wrapper({ initial = {} }: { initial?: Record<string, string> }) {
    const [st, setSt] = useState<ConsentState>({ ...state, values: initial });
    return (
      <>
        <ConsentRenderer definition={defCiudad} state={st} onChange={(p) => setSt((s) => ({ ...s, ...p }))} prefill={false} />
        <output data-testid="ciudad">{st.values.ciudad ?? ""}</output>
      </>
    );
  }
  const valor = () => screen.getByTestId("ciudad").textContent;

  it("el desplegable ofrece 'Otra ciudad' al final", () => {
    render(<Wrapper />);
    const opts = Array.from((screen.getByLabelText(/ciudad/i) as HTMLSelectElement).options).map((o) => o.textContent);
    expect(opts[opts.length - 1]).toBe(OTRA_CIUDAD_LABEL);
  });

  it("al elegirla, el campo pasa a texto libre y la etiqueta no se guarda como ciudad", () => {
    render(<Wrapper initial={{ ciudad: "Medellín, Antioquia" }} />);
    fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: OTRA_CIUDAD_LABEL } });
    const input = screen.getByLabelText(/ciudad/i);
    expect(input.tagName).toBe("INPUT");
    expect((input as HTMLInputElement).value).toBe("");
    expect(valor()).toBe("");
  });

  it("lo tecleado es el valor de la ciudad y no vuelve al desplegable mientras se escribe", () => {
    render(<Wrapper />);
    fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: OTRA_CIUDAD_LABEL } });
    fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: "Vereda El Roble, Boyacá" } });
    expect(screen.getByLabelText(/ciudad/i).tagName).toBe("INPUT");
    expect(valor()).toBe("Vereda El Roble, Boyacá");
  });

  it("se puede volver a la lista y lo escrito se conserva como valor", () => {
    render(<Wrapper />);
    fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: OTRA_CIUDAD_LABEL } });
    fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: "Pueblo Raro" } });
    fireEvent.click(screen.getByRole("button", { name: /elegir de la lista/i }));
    const sel = screen.getByLabelText(/ciudad/i) as HTMLSelectElement;
    expect(sel.tagName).toBe("SELECT");
    expect(sel.value).toBe("Pueblo Raro");
    expect(valor()).toBe("Pueblo Raro");
  });

  it("un valor guardado fuera de la lista se conserva y 'Otra ciudad' sigue disponible", () => {
    render(<Wrapper initial={{ ciudad: "Pueblo Raro" }} />);
    const sel = screen.getByLabelText(/ciudad/i) as HTMLSelectElement;
    expect(sel.value).toBe("Pueblo Raro");
    expect(Array.from(sel.options).map((o) => o.value)).toContain(OTRA_CIUDAD_LABEL);
  });

  it("ciudad obligatoria: queda vacía hasta que se teclea (collectMissing la reclamaría)", () => {
    render(<Wrapper />);
    fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: OTRA_CIUDAD_LABEL } });
    expect(valor()).toBe("");
  });
});

describe("ConsentRenderer consulta del historial", () => {
  const defDoc: ConsentDefinition = {
    ...def,
    sections: [
      { id: "g", kind: "fields", title: "Datos", fields: [
        { id: "numDoc", label: "Documento", type: "text" },
        { id: "fecha", label: "Fecha", type: "date" },
      ] },
      { id: "seccionC", kind: "vaccineTable", title: "Vacunas", columns: [
        { id: "nombre", label: "Nombre vacuna" }, { id: "dosis", label: "N° Dosis" }, { id: "proxima", label: "Fecha próxima vacuna" },
      ] },
    ],
  } as unknown as ConsentDefinition;
  const lookup = vi.fn();
  function Wrapper({ excludeId }: { excludeId?: string }) {
    const [st, setSt] = useState<ConsentState>({ ...state, values: { numDoc: "", fecha: "2026-03-01" } });
    return <ConsentRenderer definition={defDoc} state={st} onChange={(p) => setSt((s) => ({ ...s, ...p }))} excludeId={excludeId} />;
  }
  const escribirDoc = async (v: string) => {
    fireEvent.change(screen.getByLabelText("Documento"), { target: { value: v } });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    lookup.mockReset();
    const api = await import("../../../services/api");
    vi.spyOn(api, "lookupPacienteApi").mockImplementation(lookup);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("I5: si la consulta falla avisa que no se pudo consultar (no se lee como 'sin historial')", async () => {
    lookup.mockResolvedValue({ data: null, error: "No se pudo conectar con el servidor" });
    render(<Wrapper />);
    await escribirDoc("12345678");
    expect(screen.getByRole("status").textContent).toMatch(/no se pudo consultar el historial/i);
  });

  it("I5: sin fallo no hay aviso", async () => {
    lookup.mockResolvedValue({ data: { ultimo: null, vacunas: [] }, error: null });
    render(<Wrapper />);
    await escribirDoc("12345678");
    expect(screen.queryByText(/no se pudo consultar el historial/i)).toBeNull();
  });

  it("I2: excludeId llega a la consulta", async () => {
    lookup.mockResolvedValue({ data: { ultimo: null, vacunas: [] }, error: null });
    render(<Wrapper excludeId="rec-7" />);
    await escribirDoc("12345678");
    expect(lookup).toHaveBeenCalledWith("12345678", undefined, "rec-7");
  });

  it("I1: la dosis sugerida de un documento a medio teclear no sobrevive a seguir tecleando", async () => {
    // "12345" es un prefijo del documento real: su historial es de OTRA persona.
    lookup.mockImplementation(async (doc: string) => ({
      data: {
        ultimo: null,
        vacunas: doc === "12345" ? [{ vacuna: "TETANO", dosis: "1", aplicada: "2026-01-10", proxima: "" }] : [],
      },
      error: null,
    }));
    render(<Wrapper />);
    await escribirDoc("12345");
    const sel = screen.getByLabelText("Nombre vacuna, fila 1") as HTMLSelectElement;
    expect(Array.from(sel.options).some((o) => /sugerida/.test(o.textContent ?? ""))).toBe(true);
    fireEvent.change(sel, { target: { value: "TETANO D2" } });
    expect((screen.getByLabelText("Fecha próxima vacuna, fila 1") as HTMLInputElement).value).toBe("10/06/2026");
    fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "12345678" } });
    expect((screen.getByLabelText("Nombre vacuna, fila 1") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("N° Dosis, fila 1") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Fecha próxima vacuna, fila 1") as HTMLInputElement).value).toBe("");
  });
});
