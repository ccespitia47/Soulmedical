import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PatientPrefillNotice from "./PatientPrefillNotice";

describe("PatientPrefillNotice", () => {
  it("muestra nombre y fecha de origen y permite deshacer", () => {
    const onUndo = vi.fn();
    render(<PatientPrefillNotice aviso={{ nombre: "Ana Pérez", fecha: "15/03/2024" }} onUndo={onUndo} />);
    expect(screen.getByText("Ana Pérez")).toBeTruthy();
    expect(screen.getByText(/15\/03\/2024/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /deshacer/i }));
    expect(onUndo).toHaveBeenCalled();
  });
});
