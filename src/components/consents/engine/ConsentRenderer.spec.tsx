import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ConsentRenderer from "./ConsentRenderer";
import type { ConsentDefinition, ConsentState } from "./consentDefinition";

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

  it("con prefill={false} un documento válido no consulta la API", async () => {
    render(<ConsentRenderer definition={defDoc} state={conDoc} onChange={vi.fn()} prefill={false} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(lookup).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("por defecto sigue consultando", async () => {
    render(<ConsentRenderer definition={defDoc} state={conDoc} onChange={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(lookup).toHaveBeenCalledWith("12345678", undefined);
  });
});
