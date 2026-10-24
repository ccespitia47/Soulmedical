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

  it("muestra guion cuando no hay dosis", () => {
    render(<PatientHistoryPanel historial={[fila({ dosis: "", proxima: "2099-01-02" })]} />);
    expect(screen.getAllByText("—")).toHaveLength(1);
  });

  it("la vencida anuncia 'vencida' a lectores de pantalla y las cabeceras tienen scope", () => {
    render(<PatientHistoryPanel historial={[fila({ proxima: "2024-04-15", vencida: true })]} />);
    expect(screen.getByText(/vencida/).className).toContain("sr-only");
    screen.getAllByRole("columnheader").forEach((th) => expect(th.getAttribute("scope")).toBe("col"));
  });

  it("usa ámbar oscuro en claro (contraste AA) y sin !important", () => {
    render(<PatientHistoryPanel historial={[fila({ proxima: "2024-04-15", vencida: true })]} />);
    const td = screen.getByText(/toca/i).closest("td")!;
    expect(td.className).toContain("text-amber-700");
    expect(td.className).not.toContain("!");
  });

  it("el panel desaparece al pasar a historial vacío", () => {
    const { container, rerender } = render(<PatientHistoryPanel historial={[fila({})]} />);
    expect(container.querySelector("details")).not.toBeNull();
    rerender(<PatientHistoryPanel historial={[]} />);
    expect(container.querySelector("details")).toBeNull();
  });
});
