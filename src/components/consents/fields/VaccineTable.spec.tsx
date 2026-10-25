import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
const prev = (p: Partial<VacunaPrevia>): VacunaPrevia => ({
  vacuna: "TETANO", dosis: "1", aplicada: "2026-01-10", proxima: "", vencida: false, ...p,
});

function setup(props: { historial?: VacunaPrevia[]; fechaConsentimiento?: string } = {}) {
  const onChange = vi.fn();
  const ui = (extra: { fechaConsentimiento?: string } = {}) => (
    <VaccineTable columns={columns} onChange={onChange} {...props} {...extra} />
  );
  const { rerender } = render(ui());
  const select = screen.getByLabelText("Nombre vacuna, fila 1") as HTMLSelectElement;
  const last = () => JSON.parse(onChange.mock.calls[onChange.mock.calls.length - 1][0] as string)[0] as Record<string, string>;
  return { select, onChange, last, cambiarFecha: (f: string) => rerender(ui({ fechaConsentimiento: f })) };
}

describe("VaccineTable con catálogo", () => {
  it("no preselecciona ninguna vacuna, aunque haya una sugerida", () => {
    const { select, onChange } = setup({ historial: [prev({})] });
    expect(select.value).toBe("");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("marca la dosis sugerida y la lista primero", () => {
    const { select } = setup({ historial: [prev({})] });
    const opts = Array.from(select.options).map((o) => o.textContent);
    expect(opts[1]).toBe("TETANO D2 · sugerida");
    expect(opts.filter((t) => t?.includes("sugerida"))).toHaveLength(1);
  });

  it("al elegir una vacuna fija nombre, dosis y fecha próxima", () => {
    const { select, last } = setup({ fechaConsentimiento: "2026-03-01" });
    fireEvent.change(select, { target: { value: "HEPATITIS B D1" } });
    expect(last()).toMatchObject({ nombre: "HEPATITIS B D1", dosis: "1", proxima: "2026-04-01" });
  });

  it("usa la fecha de la dosis 1 del historial para una dosis posterior", () => {
    const { select, last } = setup({ historial: [prev({})], fechaConsentimiento: "2026-03-01" });
    fireEvent.change(select, { target: { value: "TETANO D2" } });
    expect(last()).toMatchObject({ nombre: "TETANO D2", dosis: "2", proxima: "2026-06-10" });
  });

  it("deja la próxima vacía si la dosis 1 no está en el historial", () => {
    const { select, last } = setup({ historial: [prev({ dosis: "2" })], fechaConsentimiento: "2026-03-01" });
    fireEvent.change(select, { target: { value: "TETANO D3" } });
    expect(last()).toMatchObject({ nombre: "TETANO D3", dosis: "3" });
    expect(last().proxima).toBe("");
  });

  it("no usa la dosis 1 de otra vacuna", () => {
    const { select, last } = setup({ historial: [prev({ vacuna: "VARICELA" })] });
    fireEvent.change(select, { target: { value: "TETANO D2" } });
    expect(last().proxima).toBe("");
  });

  it("la fecha calculada sigue editable", () => {
    const { select, last } = setup({ fechaConsentimiento: "2026-03-01" });
    fireEvent.change(select, { target: { value: "HEPATITIS B D1" } });
    fireEvent.change(screen.getByLabelText("Fecha próxima vacuna, fila 1"), { target: { value: "2026-05-05" } });
    expect(last().proxima).toBe("2026-05-05");
  });

  it("'Otra' devuelve la fila a texto libre", () => {
    const { select, last } = setup({ fechaConsentimiento: "2026-03-01" });
    fireEvent.change(select, { target: { value: "HEPATITIS B D1" } });
    fireEvent.change(select, { target: { value: OTRA_LABEL } });
    const libre = screen.getByLabelText("Nombre de la vacuna, fila 1");
    fireEvent.change(libre, { target: { value: "Vacuna X" } });
    expect(last().nombre).toBe("Vacuna X");
    expect(last().dosis).toBe("");
    expect(last().proxima).toBe("");
  });

  it("volver a la opción vacía limpia dosis y próxima", () => {
    const { select, onChange } = setup({ fechaConsentimiento: "2026-03-01" });
    fireEvent.change(select, { target: { value: "HEPATITIS B D1" } });
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("recalcula la próxima derivada si cambia la fecha del consentimiento", () => {
    const { select, last, cambiarFecha } = setup({ fechaConsentimiento: "2026-03-01" });
    fireEvent.change(select, { target: { value: "HEPATITIS B D1" } });
    cambiarFecha("2026-02-01");
    expect(last().proxima).toBe("2026-03-01");
  });

  it("calcula la próxima cuando la fecha del consentimiento llega después", () => {
    const { select, last, cambiarFecha } = setup({ fechaConsentimiento: "" });
    fireEvent.change(select, { target: { value: "HEPATITIS B D1" } });
    expect(last().proxima).toBe("");
    cambiarFecha("2026-02-01");
    expect(last().proxima).toBe("2026-03-01");
  });

  it("no toca una próxima que el profesional editó a mano", () => {
    const { select, last, cambiarFecha } = setup({ fechaConsentimiento: "2026-03-01" });
    fireEvent.change(select, { target: { value: "HEPATITIS B D1" } });
    fireEvent.change(screen.getByLabelText("Fecha próxima vacuna, fila 1"), { target: { value: "2026-05-05" } });
    cambiarFecha("2026-02-01");
    expect(last().proxima).toBe("2026-05-05");
  });

  it("con varias dosis 1 en el historial usa la más reciente", () => {
    const { select, last } = setup({
      historial: [prev({ aplicada: "2019-01-10" }), prev({ aplicada: "2026-01-10" })],
    });
    fireEvent.change(select, { target: { value: "TETANO D2" } });
    expect(last().proxima).toBe("2026-06-10");
  });

  it("ignora una dosis 1 del historial con fecha no ISO", () => {
    const { select, last } = setup({ historial: [prev({ aplicada: "10/01/2026" })] });
    fireEvent.change(select, { target: { value: "TETANO D2" } });
    expect(last().proxima).toBe("");
  });

  it("no toma '1/2' ni '1 refuerzo' como dosis 1, pero sí '1ª'", () => {
    const a = setup({ historial: [prev({ dosis: "1/2" })] });
    fireEvent.change(a.select, { target: { value: "TETANO D2" } });
    expect(a.last().proxima).toBe("");
  });

  it("reconoce '1ª' como dosis 1", () => {
    const { select, last } = setup({ historial: [prev({ dosis: "1ª" })] });
    fireEvent.change(select, { target: { value: "TETANO D2" } });
    expect(last().proxima).toBe("2026-06-10");
  });

  it("no confunde NEUMOCOCO 13 con 15 ni HEPATITIS A con A + B en el historial", () => {
    const a = setup({ historial: [prev({ vacuna: "NEUMOCOCO 15" })] });
    fireEvent.change(a.select, { target: { value: "NEUMOCOCO 13 D2" } });
    expect(a.last().proxima).toBe("");
  });
});
