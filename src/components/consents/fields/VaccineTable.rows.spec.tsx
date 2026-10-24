import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import VaccineTable from "./VaccineTable";
import { OTRA_LABEL } from "../vaccines/vaccineSchedule";
import type { VacunaPrevia } from "../patient/usePatientLookup";

const columns = [
  { id: "nombre", label: "Nombre vacuna" },
  { id: "dosis", label: "N° Dosis" },
  { id: "lote", label: "Lote" },
  { id: "vencimiento", label: "Vencimiento" },
  { id: "proxima", label: "Fecha próxima vacuna" },
  { id: "fabricante", label: "Fabricante" },
];
const prev = (p: Partial<VacunaPrevia> = {}): VacunaPrevia => ({
  vacuna: "TETANO", dosis: "1", aplicada: "2026-01-10", proxima: "", vencida: false, ...p,
});

const selectDe = (n: number) => screen.getByLabelText(`Nombre vacuna, fila ${n}`) as HTMLSelectElement;
const proximaDe = (n: number) => screen.getByLabelText(`Fecha próxima vacuna, fila ${n}`) as HTMLInputElement;
const agregar = () => fireEvent.click(screen.getByText("+ Agregar vacuna"));
const borrar = (n: number) => fireEvent.click(screen.getAllByLabelText("Eliminar fila")[n - 1]);

describe("VaccineTable fecha próxima en dd/mm/aaaa", () => {
  it("escribe la fecha calculada como dd/mm/aaaa (lo que se imprime en el PDF)", () => {
    const onChange = vi.fn();
    render(<VaccineTable columns={columns} onChange={onChange} fechaConsentimiento="2026-03-01" />);
    fireEvent.change(selectDe(1), { target: { value: "HEPATITIS B D1" } });
    const filas = JSON.parse(onChange.mock.calls[onChange.mock.calls.length - 1][0] as string);
    expect(filas[0].proxima).toBe("01/04/2026");
    expect(proximaDe(1).value).toBe("01/04/2026");
  });

  it("estable: re-renderizar con la misma fecha no vuelve a emitir", () => {
    const onChange = vi.fn();
    const ui = (f: string) => <VaccineTable columns={columns} onChange={onChange} fechaConsentimiento={f} />;
    const { rerender } = render(ui("2026-03-01"));
    fireEvent.change(selectDe(1), { target: { value: "HEPATITIS B D1" } });
    const n = onChange.mock.calls.length;
    rerender(ui("2026-03-01"));
    expect(onChange.mock.calls.length).toBe(n);
  });
});

// Tres arrays paralelos (rows, libre, derivada): si se desalinean, la fecha calculada de una fila cae en otra.
describe("VaccineTable: añadir y borrar filas mantiene los arrays alineados", () => {
  const filas = (onChange: ReturnType<typeof vi.fn>) =>
    JSON.parse(onChange.mock.calls[onChange.mock.calls.length - 1][0] as string) as Record<string, string>[];

  function tresFilas() {
    const onChange = vi.fn();
    const ui = (f: string) => <VaccineTable columns={columns} onChange={onChange} fechaConsentimiento={f} />;
    const r = render(ui("2026-03-01"));
    // fila 1: derivada; fila 2: texto libre; fila 3: derivada (otra vacuna)
    fireEvent.change(selectDe(1), { target: { value: "HEPATITIS B D1" } });
    agregar();
    fireEvent.change(selectDe(2), { target: { value: OTRA_LABEL } });
    fireEvent.change(screen.getByLabelText("Nombre de la vacuna, fila 2"), { target: { value: "Vacuna X" } });
    agregar();
    fireEvent.change(selectDe(3), { target: { value: "DPT-a + POLIO D1" } });
    return { onChange, cambiarFecha: (f: string) => r.rerender(ui(f)) };
  }

  it("addRow: la fila nueva es vacía, no libre y no derivada; las demás conservan lo suyo", () => {
    const { onChange, cambiarFecha } = tresFilas();
    agregar();
    expect(selectDe(4).value).toBe("");
    expect(screen.queryByLabelText("Nombre de la vacuna, fila 4")).toBeNull();
    expect(screen.getByLabelText("Nombre de la vacuna, fila 2")).toHaveProperty("value", "Vacuna X");
    cambiarFecha("2026-02-01");
    const f = filas(onChange);
    expect(f[0].proxima).toBe("01/03/2026");
    expect(f[1].proxima).toBe("");
    expect(f[2].proxima).toBe("01/04/2026");
    expect(proximaDe(4).value).toBe("");
  });

  it("removeRow intermedia: libre y derivada se desplazan con su fila", () => {
    const { onChange, cambiarFecha } = tresFilas();
    borrar(2); // se va la fila de texto libre
    expect(screen.queryByLabelText("Nombre de la vacuna, fila 2")).toBeNull();
    expect(selectDe(1).value).toBe("HEPATITIS B D1");
    expect(selectDe(2).value).toBe("DPT-a + POLIO D1");
    cambiarFecha("2026-02-01");
    const f = filas(onChange);
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ nombre: "HEPATITIS B D1", proxima: "01/03/2026" });
    expect(f[1]).toMatchObject({ nombre: "DPT-a + POLIO D1", proxima: "01/04/2026" });
  });

  it("removeRow de la primera: la fila de texto libre sigue libre y no hereda 'derivada'", () => {
    const { onChange, cambiarFecha } = tresFilas();
    borrar(1);
    expect(selectDe(1).value).toBe(OTRA_LABEL);
    expect(within(selectDe(1).parentElement as HTMLElement).getByLabelText("Nombre de la vacuna, fila 1")).toHaveProperty("value", "Vacuna X");
    cambiarFecha("2026-02-01");
    const f = filas(onChange);
    expect(f[0]).toMatchObject({ nombre: "Vacuna X", proxima: "" });
    expect(f[1]).toMatchObject({ nombre: "DPT-a + POLIO D1", proxima: "01/04/2026" });
  });

  it("removeRow de la última: la anterior conserva su estado", () => {
    const { onChange, cambiarFecha } = tresFilas();
    borrar(3);
    cambiarFecha("2026-02-01");
    const f = filas(onChange);
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ nombre: "HEPATITIS B D1", proxima: "01/03/2026" });
    expect(f[1].nombre).toBe("Vacuna X");
  });

  it("una fila editada a mano deja de ser derivada y eso sobrevive a borrar otra fila", () => {
    const { onChange, cambiarFecha } = tresFilas();
    fireEvent.change(proximaDe(3), { target: { value: "05/05/2026" } });
    borrar(1);
    cambiarFecha("2026-02-01");
    expect(filas(onChange).find((x) => x.nombre === "DPT-a + POLIO D1")?.proxima).toBe("05/05/2026");
  });

  it("borrar la única fila deja una fila vacía y alineada", () => {
    const onChange = vi.fn();
    render(<VaccineTable columns={columns} onChange={onChange} fechaConsentimiento="2026-03-01" />);
    fireEvent.change(selectDe(1), { target: { value: OTRA_LABEL } });
    borrar(1);
    expect(selectDe(1).value).toBe("");
    expect(screen.queryByLabelText("Nombre de la vacuna, fila 1")).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});

// Invariante: lo que hay en el formulario corresponde siempre al documento que está en pantalla.
describe("VaccineTable: una vacuna elegida desde una sugerencia no sobrevive al cambio de documento", () => {
  const hist = [prev()];
  function setupDoc() {
    const onChange = vi.fn();
    const ui = (doc: string | null, historial: VacunaPrevia[]) => (
      <VaccineTable columns={columns} onChange={onChange} historial={historial} historialDoc={doc} fechaConsentimiento="2026-03-01" />
    );
    const r = render(ui("12345", hist));
    const ultimo = () =>
      JSON.parse((onChange.mock.calls[onChange.mock.calls.length - 1][0] as string) || "[]") as Record<string, string>[];
    return { onChange, ultimo, ir: (doc: string | null, h: VacunaPrevia[]) => r.rerender(ui(doc, h)) };
  }

  it("al cambiar el documento limpia la fila elegida desde 'sugerida' y avisa", () => {
    const { ultimo, onChange, ir } = setupDoc();
    fireEvent.change(selectDe(1), { target: { value: "TETANO D2" } }); // era la sugerida
    expect(ultimo()[0]).toMatchObject({ nombre: "TETANO D2", dosis: "2" });
    ir(null, []);
    expect(selectDe(1).value).toBe("");
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getByRole("status").textContent).toMatch(/documento/i);
  });

  it("también al pasar directamente a otro documento con historial", () => {
    const { onChange, ir } = setupDoc();
    fireEvent.change(selectDe(1), { target: { value: "TETANO D2" } });
    ir("123456", hist);
    expect(selectDe(1).value).toBe("");
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("no toca una fila elegida sin sugerencia", () => {
    const { ultimo, ir } = setupDoc();
    fireEvent.change(selectDe(1), { target: { value: "HEPATITIS B D1" } }); // no era sugerida
    fireEvent.change(screen.getByLabelText("Lote, fila 1"), { target: { value: "L9" } });
    ir(null, []);
    expect(selectDe(1).value).toBe("HEPATITIS B D1");
    expect(ultimo()[0]).toMatchObject({ nombre: "HEPATITIS B D1", lote: "L9" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("conserva lo demás de la fila (lote) al limpiar la vacuna sugerida", () => {
    const { ultimo, ir } = setupDoc();
    fireEvent.change(selectDe(1), { target: { value: "TETANO D2" } });
    fireEvent.change(screen.getByLabelText("Lote, fila 1"), { target: { value: "L9" } });
    ir(null, []);
    expect(ultimo()[0]).toMatchObject({ nombre: "", dosis: "", proxima: "", lote: "L9" });
  });

  it("si el profesional ya cambió la vacuna a mano, esa elección es suya y no se revierte", () => {
    const { ultimo, ir } = setupDoc();
    fireEvent.change(selectDe(1), { target: { value: "TETANO D2" } });
    fireEvent.change(selectDe(1), { target: { value: "DPT-a + POLIO D1" } });
    ir(null, []);
    expect(ultimo()[0]).toMatchObject({ nombre: "DPT-a + POLIO D1" });
  });

  it("la reversión alcanza SU fila aunque se haya borrado otra antes", () => {
    const { ultimo, ir } = setupDoc();
    agregar();
    fireEvent.change(selectDe(2), { target: { value: "TETANO D2" } }); // sugerida, fila 2
    fireEvent.change(selectDe(1), { target: { value: "DPT-a + POLIO D1" } });
    borrar(1); // la sugerida pasa a ser fila 1
    ir(null, []);
    expect(ultimo()).toHaveLength(0);
    expect(selectDe(1).value).toBe("");
  });
});

describe("VaccineTable: próxima en el pasado queda vacía", () => {
  it("dosis tardía: la próxima calculada anterior a la fecha del consentimiento no se imprime", () => {
    const onChange = vi.fn();
    render(<VaccineTable columns={columns} onChange={onChange} historial={[prev({ aplicada: "2025-01-10" })]} historialDoc="123" fechaConsentimiento="2026-03-01" />);
    fireEvent.change(selectDe(1), { target: { value: "TETANO D2" } }); // 2025-01-10 + 5m = 2025-06-10 < hoy
    expect(proximaDe(1).value).toBe("");
  });
  it("el aviso de reversión nombra la vacuna quitada", () => {
    const onChange = vi.fn();
    const ui = (doc: string | null, h: VacunaPrevia[]) => (
      <VaccineTable columns={columns} onChange={onChange} historial={h} historialDoc={doc} fechaConsentimiento="2026-03-01" />
    );
    const { rerender } = render(ui("12345", [prev()]));
    fireEvent.change(selectDe(1), { target: { value: "TETANO D2" } });
    rerender(ui(null, []));
    expect(screen.getByRole("status").textContent).toMatch(/Se quitó TETANO D2/);
  });
});
