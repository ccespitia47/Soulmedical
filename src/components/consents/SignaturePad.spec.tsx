import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { act } from "react";
import SignaturePad from "./SignaturePad";

// jsdom da 0 en todos los rects; se simula el tamaño real del lienzo.
function conAncho(ancho: number) {
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: ancho, height: ancho ? 120 : 0, top: 0, left: 0, right: ancho, bottom: 0, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe("SignaturePad con la vista oculta", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("un resize con el lienzo oculto no lo deja en 0x0", () => {
    // El marco de Consientify monta las dos vistas y oculta una con `display:none`,
    // así que su rect es 0x0. Cualquier `resize` de ventana estando en Registros
    // —en tableta, abrir el teclado virtual ya lo dispara— borraría el bitmap de
    // la firma, y los trazos siguientes irían a una superficie de 0x0.
    conAncho(400);
    const { container } = render(<SignaturePad onChange={vi.fn()} />);
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas.width).toBe(400);

    conAncho(0); // la vista pasa a oculta
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(canvas.width).toBe(400);
    expect(canvas.height).toBeGreaterThan(0);
  });

  it("al volver a ser visible sigue aceptando el tamaño nuevo", () => {
    conAncho(400);
    const { container } = render(<SignaturePad onChange={vi.fn()} />);
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;

    conAncho(640);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(canvas.width).toBe(640);
  });
});
