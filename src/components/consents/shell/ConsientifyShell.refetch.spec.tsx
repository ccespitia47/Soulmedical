import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "../../../context/ThemeContext";
import ConsientifyShell from "./ConsientifyShell";
import { listConsentsApi } from "../../../services/api";

vi.mock("../../../services/api", async () => {
  const real = await vi.importActual<Record<string, unknown>>("../../../services/api");
  return {
    ...real,
    listConsentsApi: vi.fn(async () => ({ data: { data: [], total: 0, page: 1, limit: 50 }, error: null })),
    lookupPacienteApi: vi.fn(async () => ({ data: { ultimo: null, vacunas: [] }, error: null })),
  };
});

const llamadas = () => (listConsentsApi as ReturnType<typeof vi.fn>).mock.calls.length;

describe("Registros se refresca al volverse visible", () => {
  beforeEach(() => vi.clearAllMocks());

  it("vuelve a pedir los registros cada vez que se entra en la vista", async () => {
    // Antes, el cambio de vista desmontaba la página, así que cada visita traía
    // datos frescos. Con las dos vistas montadas a la vez, sin esto un
    // consentimiento recién guardado no aparecería en Registros.
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/consientify"]}>
          <Routes>
            <Route
              path="/consientify/:vista?"
              element={<ConsientifyShell usuario={{ name: "Ana" }} onLogout={vi.fn()} />}
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    await waitFor(() => expect(llamadas()).toBeGreaterThan(0));
    const alMontar = llamadas();

    fireEvent.click(screen.getByRole("button", { name: /registros/i }));
    await waitFor(() => expect(llamadas()).toBeGreaterThan(alMontar));
    const trasEntrar = llamadas();

    fireEvent.click(screen.getByRole("button", { name: /consentimientos/i }));
    fireEvent.click(screen.getByRole("button", { name: /registros/i }));
    await waitFor(() => expect(llamadas()).toBeGreaterThan(trasEntrar));
  });
});
