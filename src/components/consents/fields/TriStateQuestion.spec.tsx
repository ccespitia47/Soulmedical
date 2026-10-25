import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TriStateQuestion from "./TriStateQuestion";
import type { TriStateQ } from "../config/entityConfig";

const q: TriStateQ = { id: "alergia", num: "1", text: "¿Alergias?", thirdLabel: "No está seguro" };

const props = {
  q,
  value: "",
  note: "",
  onChange: vi.fn(),
  onNoteChange: vi.fn(),
};

describe("TriStateQuestion", () => {
  it("dos instancias de la misma pregunta no comparten grupo de radios", () => {
    // Alcanzable desde que el marco monta las dos vistas: un consentimiento a
    // medias en Consentimientos y otro abierto en edición desde Registros.
    // Con el mismo `name`, el navegador los trata como UN grupo: marcar en uno
    // desmarca en el DOM el del otro, sin que React restaure el `checked`.
    // El resultado sería una pregunta que se ve en blanco y se firma respondida.
    render(
      <>
        <div data-testid="a"><TriStateQuestion {...props} /></div>
        <div data-testid="b"><TriStateQuestion {...props} /></div>
      </>,
    );
    const nombre = (test: string) =>
      (screen.getByTestId(test).querySelector("input[type=radio]") as HTMLInputElement).name;

    expect(nombre("a")).not.toBe(nombre("b"));
  });

  it("dentro de una instancia, las tres opciones sí comparten grupo", () => {
    render(<TriStateQuestion {...props} />);
    const nombres = new Set(
      Array.from(document.querySelectorAll<HTMLInputElement>("input[type=radio]")).map((i) => i.name),
    );
    expect(nombres.size).toBe(1);
  });

  it("el nombre sigue identificando la pregunta", () => {
    render(<TriStateQuestion {...props} />);
    const n = (document.querySelector("input[type=radio]") as HTMLInputElement).name;
    expect(n).toContain("alergia");
  });
});
