import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "../../../context/ThemeContext";
import ConsientifyBackground from "./ConsientifyBackground";
import { PALETA, MIN_FORMAS, MAX_FORMAS, ANCHO_MIN, ANCHO_MAX, RATIO, numeroDeFormas, type Tipo } from "./fondoParams";

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

  it("pinta tantas formas como pida el área de la ventana", () => {
    pintar();
    const esperadas = numeroDeFormas(window.innerWidth * window.innerHeight);
    expect(formas()).toHaveLength(esperadas);
    expect(esperadas).toBeGreaterThanOrEqual(MIN_FORMAS);
    expect(esperadas).toBeLessThanOrEqual(MAX_FORMAS);
  });

  it("la densidad escala con la pantalla, con topes", () => {
    // Un recuadro de muestra y una pantalla completa no pueden llevar lo mismo:
    // 16 formas que lucen en 360x260 desaparecen en 1900x1000.
    expect(numeroDeFormas(360 * 260)).toBe(MIN_FORMAS);
    expect(numeroDeFormas(1900 * 1000)).toBe(MAX_FORMAS);
    expect(numeroDeFormas(1280 * 720)).toBeGreaterThan(MIN_FORMAS);
  });

  it("cada forma recorre una distancia perceptible", () => {
    // El recorrido del prototipo (18px en medio ciclo) daba 0,59 px/s en
    // pantalla completa: animado e invisible. Se mide en píxeles visibles.
    pintar();
    for (const f of formas()) {
      const el = f as HTMLElement;
      const x = Math.abs(parseFloat(el.style.getPropertyValue("--viaje-x")));
      const y = Math.abs(parseFloat(el.style.getPropertyValue("--viaje-y")));
      expect(Math.hypot(x, y)).toBeGreaterThan(80);
    }
  });

  it("no intercepta clics ni lo anuncia el lector de pantalla", () => {
    pintar();
    const fondo = screen.getByTestId("fondo");
    expect(fondo).toHaveAttribute("aria-hidden", "true");
    expect(fondo.style.pointerEvents).toBe("none");
  });

  it("con animado={false} queda quieto, no solo más lento", () => {
    // Quien decide es el marco (ajuste del sistema + interruptor del riel).
    render(
      <ThemeProvider>
        <ConsientifyBackground animado={false} />
      </ThemeProvider>,
    );
    const quietas = formas();
    expect(quietas.length).toBeGreaterThan(0);
    for (const f of quietas) {
      expect((f as HTMLElement).style.animationName).toBe("none");
    }
  });

  it("sin esa preferencia, cada forma se anima con su propia duración", () => {
    pintar();
    const duraciones = formas().map((f) => parseFloat((f as HTMLElement).style.animationDuration));
    expect(duraciones).toHaveLength(formas().length);
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
      expect(ancho).toBeGreaterThanOrEqual(ANCHO_MIN);
      expect(ancho).toBeLessThanOrEqual(ANCHO_MAX);
    }
  });

  it("cada dibujo recibe la caja de SU proporción, sin deformarse", () => {
    // Una caja 2:1 para todo achataba la jeringa (su dibujo es 48x18) y
    // estiraba la bacteria. Un dibujo deformado deja de reconocerse: a este
    // tamaño la silueta es lo único que se lee, y una bacteria achatada pasa
    // por frasco. La caja tiene que seguir al viewBox de cada tipo.
    pintar();
    for (const f of formas()) {
      const el = f as HTMLElement;
      const tipo = el.getAttribute("data-bicho") as Tipo;
      const ancho = parseFloat(el.style.width);
      const alto = parseFloat(el.style.height);
      expect(alto / ancho).toBeCloseTo(RATIO[tipo], 5);
    }
  });

  it("las proporciones declaradas son las de los viewBox reales", () => {
    expect(RATIO.virus).toBe(1);
    expect(RATIO.bacteria).toBeCloseTo(26 / 48, 5);
    expect(RATIO.jeringa).toBeCloseTo(18 / 48, 5);
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
