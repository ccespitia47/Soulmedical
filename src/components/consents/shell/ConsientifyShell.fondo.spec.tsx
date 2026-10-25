import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "../../../context/ThemeContext";
import ConsientifyShell from "./ConsientifyShell";
import { cardCls } from "../sections/sharedUi";

vi.mock("../../../services/api", async () => {
  const real = await vi.importActual<Record<string, unknown>>("../../../services/api");
  return {
    ...real,
    listConsentsApi: vi.fn(async () => ({ data: { data: [], total: 0, page: 1, limit: 50 }, error: null })),
    lookupPacienteApi: vi.fn(async () => ({ data: { ultimo: null, vacunas: [] }, error: null })),
  };
});

function pintar(ruta = "/consientify") {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route
            path="/consientify/:vista?"
            element={<ConsientifyShell usuario={{ name: "Ana" }} onLogout={vi.fn()} />}
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

/** Raíz de una vista: el primer hijo del panel que el marco monta. */
const raizDe = (v: string) => screen.getByTestId(`vista-${v}`).firstElementChild as HTMLElement;

describe("Las vistas dejan ver el fondo", () => {
  beforeEach(() => localStorage.clear());

  it("ninguna vista pinta un lienzo opaco a pantalla completa", () => {
    pintar();
    for (const v of ["consentimientos", "registros"]) {
      const cls = raizDe(v).className;
      expect(cls).not.toMatch(/bg-\[#f0f4f8\]/);
      expect(cls).not.toMatch(/dark:bg-slate-950/);
    }
  });

  it("el formulario tampoco lo pinta", () => {
    pintar();
    fireEvent.click(within(screen.getByTestId("vista-consentimientos")).getByText("Vacunación"));
    const raiz = raizDe("consentimientos");
    expect(raiz.className).not.toMatch(/bg-\[#f0f4f8\]/);
    expect(raiz.className).not.toMatch(/dark:bg-slate-950/);
  });

  it("ya no hay botón de volver a la portada", () => {
    pintar();
    expect(screen.queryByText("← Volver")).toBeNull();
    pintar("/consientify/registros");
    expect(screen.queryByText("← Volver")).toBeNull();
  });

  it("las tarjetas siguen opacas, que es lo que hace legible el consentimiento", () => {
    expect(cardCls).toMatch(/bg-white/);
    expect(cardCls).toMatch(/dark:bg-slate-900/);
  });
});
