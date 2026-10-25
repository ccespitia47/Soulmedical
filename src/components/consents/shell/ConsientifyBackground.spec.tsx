import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "../../../context/ThemeContext";
import ConsientifyBackground from "./ConsientifyBackground";
import { PALETA, N_FORMAS } from "./fondoParams";

/** `matchMedia` no existe en jsdom; cada test declara si se pide menos movimiento. */
function conMatchMedia(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

const pintar = () =>
  render(
    <ThemeProvider>
      <ConsientifyBackground />
    </ThemeProvider>,
  );

const formas = () => Array.from(screen.getByTestId("fondo").querySelectorAll("[data-bicho]"));

describe("ConsientifyBackground", () => {
  beforeEach(() => conMatchMedia(false));
  afterEach(() => vi.unstubAllGlobals());

  it("pinta 16 formas", () => {
    pintar();
    expect(formas()).toHaveLength(16);
    expect(N_FORMAS).toBe(16);
  });

  it("no intercepta clics ni lo anuncia el lector de pantalla", () => {
    pintar();
    const fondo = screen.getByTestId("fondo");
    expect(fondo).toHaveAttribute("aria-hidden", "true");
    expect(fondo.style.pointerEvents).toBe("none");
  });

  it("con prefers-reduced-motion queda quieto", () => {
    conMatchMedia(true);
    pintar();
    for (const f of formas()) {
      expect((f as HTMLElement).style.animationName || "none").toBe("none");
    }
  });

  it("sin esa preferencia, cada forma se anima con su propia duración", () => {
    pintar();
    const duraciones = formas().map((f) => parseFloat((f as HTMLElement).style.animationDuration));
    expect(duraciones).toHaveLength(16);
    for (const d of duraciones) {
      expect(d).toBeGreaterThanOrEqual(20);
      expect(d).toBeLessThanOrEqual(34);
    }
    // Desfases negativos: si arrancaran todas a la vez se vería un pulso.
    for (const f of formas()) {
      expect(parseFloat((f as HTMLElement).style.animationDelay)).toBeLessThanOrEqual(0);
    }
  });

  it("los tamaños salen del rango del prototipo", () => {
    pintar();
    for (const f of formas()) {
      const ancho = parseFloat((f as HTMLElement).style.width);
      expect(ancho).toBeGreaterThanOrEqual(18);
      expect(ancho).toBeLessThanOrEqual(30);
    }
  });

  it("usa la paleta del prototipo", () => {
    pintar();
    expect(PALETA).toEqual(["#2dd4bf", "#38bdf8", "#a78bfa", "#34d399"]);
    const usados = new Set(formas().map((f) => f.getAttribute("data-color")));
    for (const c of usados) expect(PALETA).toContain(c);
  });

  it("incluye las tres formas: virus, bacteria y jeringa", () => {
    pintar();
    const tipos = new Set(formas().map((f) => f.getAttribute("data-bicho")));
    expect(tipos).toEqual(new Set(["virus", "bacteria", "jeringa"]));
  });
});
