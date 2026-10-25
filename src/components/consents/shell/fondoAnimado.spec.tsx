import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "../../../context/ThemeContext";
import ConsientifyShell from "./ConsientifyShell";
import { fondoAnimadoPorDefecto, FONDO_STORAGE_KEY } from "./fondoParams";

vi.mock("../../../services/api", async () => {
  const real = await vi.importActual<Record<string, unknown>>("../../../services/api");
  return {
    ...real,
    listConsentsApi: vi.fn(async () => ({ data: { data: [], total: 0, page: 1, limit: 50 }, error: null })),
    lookupPacienteApi: vi.fn(async () => ({ data: { ultimo: null, vacunas: [] }, error: null })),
  };
});

function sistemaPide(reduce: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: reduce && q.includes("prefers-reduced-motion"),
    media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(), onchange: null,
  }));
}

const pintar = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/consientify"]}>
        <Routes>
          <Route path="/consientify/:vista?" element={<ConsientifyShell usuario={{ name: "Ana" }} onLogout={vi.fn()} />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

const animadas = () =>
  Array.from(screen.getByTestId("fondo").querySelectorAll<HTMLElement>("[data-bicho]"))
    .filter((f) => f.style.animationName && f.style.animationName !== "none").length;

describe("Interruptor del fondo animado", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  // El fondo animado es lo que el usuario pidió expresamente para esta
  // pantalla. El ajuste de Windows (Accesibilidad › Efectos visuales) viene
  // activado en muchos equipos y lo vetaba en silencio: quien pide el fondo no
  // se queda sin él por una casilla que nunca tocó. El interruptor del riel
  // sigue siendo la salida para quien sí quiera quietud.
  it("por defecto anima, aunque el sistema pida quietud", () => {
    sistemaPide(true);
    expect(fondoAnimadoPorDefecto()).toBe(true);
    sistemaPide(false);
    expect(fondoAnimadoPorDefecto()).toBe(true);
  });

  it("una elección guardada apagándolo gana al defecto", () => {
    sistemaPide(false);
    localStorage.setItem(FONDO_STORAGE_KEY, "0");
    expect(fondoAnimadoPorDefecto()).toBe(false);

    localStorage.setItem(FONDO_STORAGE_KEY, "1");
    expect(fondoAnimadoPorDefecto()).toBe(true);
  });

  it("con el sistema pidiendo quietud el fondo arranca igual en movimiento", () => {
    sistemaPide(true);
    pintar();
    expect(animadas()).toBeGreaterThan(0);
  });

  it("el interruptor del riel lo apaga y lo recuerda", () => {
    sistemaPide(true);
    pintar();
    expect(animadas()).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText(/desactivar fondo animado/i));

    expect(animadas()).toBe(0);
    expect(localStorage.getItem(FONDO_STORAGE_KEY)).toBe("0");
  });

  it("y vuelve a encenderlo", () => {
    sistemaPide(false);
    localStorage.setItem(FONDO_STORAGE_KEY, "0");
    pintar();
    expect(animadas()).toBe(0);

    fireEvent.click(screen.getByLabelText(/activar fondo animado/i));

    expect(animadas()).toBeGreaterThan(0);
    expect(localStorage.getItem(FONDO_STORAGE_KEY)).toBe("1");
  });
});
