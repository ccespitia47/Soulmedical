import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "../../../context/ThemeContext";
import ConsientifyShell from "./ConsientifyShell";

// El marco monta las dos vistas de verdad; sus llamadas al backend se cortan aquí.
vi.mock("../../../services/api", async () => {
  const real = await vi.importActual<Record<string, unknown>>("../../../services/api");
  return {
    ...real,
    listConsentsApi: vi.fn(async () => ({ data: { data: [], total: 0, page: 1, limit: 50 }, error: null })),
    lookupPacienteApi: vi.fn(async () => ({ data: { ultimo: null, vacunas: [] }, error: null })),
  };
});

function pintar(ruta = "/consientify") {
  return render(
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

const panelDe = (v: string) => screen.getByTestId(`vista-${v}`);
const visible = (el: HTMLElement) => !el.hasAttribute("hidden");

describe("ConsientifyShell", () => {
  beforeEach(() => localStorage.clear());

  it("entrar en /consientify muestra consentimientos", () => {
    pintar();
    expect(visible(panelDe("consentimientos"))).toBe(true);
    expect(visible(panelDe("registros"))).toBe(false);
  });

  it("/consientify/registros muestra registros, así que recargar funciona", () => {
    pintar("/consientify/registros");
    expect(visible(panelDe("registros"))).toBe(true);
    expect(visible(panelDe("consentimientos"))).toBe(false);
  });

  it("mantiene ambas vistas montadas", () => {
    pintar();
    // La inactiva existe en el DOM, solo oculta: es lo que permite conservar su estado.
    expect(panelDe("registros")).toBeInTheDocument();
  });

  it("el riel y el fondo están presentes", () => {
    pintar();
    expect(screen.getByLabelText("Secciones de Consientify")).toBeInTheDocument();
    expect(screen.getByTestId("fondo")).toBeInTheDocument();
  });

  it("conserva el formulario al ir a registros y volver", () => {
    pintar();
    // Abrir un consentimiento y escribir en él.
    fireEvent.click(within(panelDe("consentimientos")).getByText("Vacunación"));
    const doc = within(panelDe("consentimientos")).getByLabelText(/^Documento/i) as HTMLInputElement;
    fireEvent.change(doc, { target: { value: "987654" } });

    // Irse a Registros y volver con el riel.
    fireEvent.click(screen.getByRole("button", { name: /registros/i }));
    expect(visible(panelDe("registros"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /consentimientos/i }));

    // El formulario sigue abierto y con lo escrito.
    const doc2 = within(panelDe("consentimientos")).getByLabelText(/^Documento/i) as HTMLInputElement;
    expect(doc2.value).toBe("987654");
  });
});
