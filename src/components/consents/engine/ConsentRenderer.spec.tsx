import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
