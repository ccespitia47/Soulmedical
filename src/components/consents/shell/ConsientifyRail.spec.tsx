import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider, THEME_STORAGE_KEY } from "../../../context/ThemeContext";
import ConsientifyRail from "./ConsientifyRail";

type Opts = Partial<Parameters<typeof ConsientifyRail>[0]>;

function pintar(opts: Opts = {}) {
  const onVista = vi.fn();
  const onLogout = vi.fn();
  render(
    <ThemeProvider>
      <ConsientifyRail
        vista={opts.vista ?? "consentimientos"}
        onVista={opts.onVista ?? onVista}
        usuario={opts.usuario ?? { name: "Ana Ruiz" }}
        onLogout={opts.onLogout ?? onLogout}
        fondoAnimado={opts.fondoAnimado ?? true}
        onFondoAnimado={opts.onFondoAnimado ?? vi.fn()}
      />
    </ThemeProvider>,
  );
  return { onVista, onLogout };
}

const abrirMenu = () => fireEvent.click(screen.getByLabelText(/abrir menú de usuario/i));

describe("ConsientifyRail", () => {
  it("marca como activa la vista en curso", () => {
    pintar({ vista: "registros" });
    expect(screen.getByRole("button", { name: /registros/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /consentimientos/i })).not.toHaveAttribute("aria-current");
  });

  it("avisa al cambiar de vista", () => {
    const { onVista } = pintar({ vista: "registros" });
    fireEvent.click(screen.getByRole("button", { name: /consentimientos/i }));
    expect(onVista).toHaveBeenCalledWith("consentimientos");
  });

  it("alterna claro y oscuro", () => {
    localStorage.clear();
    pintar();
    fireEvent.click(screen.getByLabelText(/cambiar a tema oscuro/i));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    fireEvent.click(screen.getByLabelText(/cambiar a tema claro/i));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("el avatar abre un menú, no cierra sesión de un clic", () => {
    const { onLogout } = pintar();
    abrirMenu();
    expect(onLogout).not.toHaveBeenCalled();
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
  });

  it("desde el menú se cierra sesión", () => {
    const { onLogout } = pintar();
    abrirMenu();
    fireEvent.click(screen.getByText(/cerrar sesión/i));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("el menú ofrece la doble verificación", () => {
    // Es el único acceso que le queda a un usuario que solo tiene Consientify:
    // los otros montajes viven en AdminSidebar y UserAppPage, inalcanzables para él.
    pintar();
    abrirMenu();
    expect(screen.getByText(/doble factor/i)).toBeInTheDocument();
  });

  it("sin nombre de usuario no rompe", () => {
    pintar({ usuario: null });
    abrirMenu();
    expect(screen.getByText(/cerrar sesión/i)).toBeInTheDocument();
  });
});
