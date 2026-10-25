import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeContext";

// Consumidor mínimo: muestra el tema activo y permite cambiarlo.
function Sonda() {
  const { theme, setTheme } = useTheme();
  return (
    <>
      <span data-testid="tema">{theme}</span>
      <button onClick={() => setTheme("midnight")}>a midnight</button>
    </>
  );
}

const tema = () => screen.getByTestId("tema").textContent;

describe("ThemeContext", () => {
  beforeEach(() => localStorage.clear());

  it("arranca en el tema guardado", () => {
    localStorage.setItem("soulforms-theme", "dark");
    render(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    );
    expect(tema()).toBe("dark");
  });

  it("guarda el tema al cambiarlo", () => {
    render(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("a midnight"));
    expect(localStorage.getItem("soulforms-theme")).toBe("midnight");
    expect(tema()).toBe("midnight");
  });

  it("un valor guardado inválido no rompe: cae en light", () => {
    localStorage.setItem("soulforms-theme", "turquesa");
    render(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    );
    expect(tema()).toBe("light");
  });

  it("sin nada guardado arranca en light", () => {
    render(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    );
    expect(tema()).toBe("light");
  });
});
