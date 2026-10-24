import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PatientHistoryPanel from "./PatientHistoryPanel";
import type { VacunaPrevia } from "./usePatientLookup";

const fila = (p: Partial<VacunaPrevia>): VacunaPrevia => ({
  vacuna: "Hepatitis B", dosis: "1ª", aplicada: "2024-03-15", proxima: "", vencida: false, ...p,
});

describe("PatientHistoryPanel", () => {
  it("no renderiza nada sin historial", () => {
    const { container } = render(<PatientHistoryPanel historial={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("muestra vacuna, dosis y fechas formateadas", () => {
    render(<PatientHistoryPanel historial={[fila({ proxima: "2099-01-02" })]} />);
    expect(screen.getByText("Hepatitis B")).toBeTruthy();
    expect(screen.getByText("1ª")).toBeTruthy();
    expect(screen.getByText("15/03/2024")).toBeTruthy();
    expect(screen.getByText("02/01/2099")).toBeTruthy();
    expect(screen.queryByText(/toca/i)).toBeNull();
  });

  it("marca como vencida la fila cuya próxima ya pasó", () => {
    render(<PatientHistoryPanel historial={[fila({ proxima: "2024-04-15", vencida: true })]} />);
    expect(screen.getByText(/toca/i)).toBeTruthy();
  });

  it("muestra guion cuando no hay próxima fecha", () => {
    render(<PatientHistoryPanel historial={[fila({ proxima: "" })]} />);
    expect(screen.getByText("—")).toBeTruthy();
  });
});
