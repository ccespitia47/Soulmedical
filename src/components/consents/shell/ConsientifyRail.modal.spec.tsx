import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../../../context/ThemeContext";
import ConsientifyRail from "./ConsientifyRail";

// El modal de 2FA es `fixed inset-0`. Si se renderiza DENTRO del <nav> del riel,
// dos mecanismos independientes lo rompen:
//  1. el `backdrop-blur` del nav crea bloque contenedor para `position: fixed`,
//     así que `inset: 0` se resuelve contra una caja de 60px de ancho;
//  2. nav y main son hermanos con el mismo z-index, y main gana por orden del DOM.
// Como es el único acceso a la 2FA de un usuario de solo Consientify, tiene que
// salir del riel: va a <body> por portal.

function pintar() {
  render(
    <ThemeProvider>
      <div className="flex">
        <ConsientifyRail vista="consentimientos" onVista={vi.fn()} usuario={{ name: "Ana" }} onLogout={vi.fn()} fondoAnimado onFondoAnimado={vi.fn()} />
        <main>contenido</main>
      </div>
    </ThemeProvider>,
  );
}

describe("El modal de 2FA escapa del riel", () => {
  it("el nav se apila por encima del contenido", () => {
    pintar();
    const nav = screen.getByLabelText("Secciones de Consientify");
    // Mismo z que <main> dejaría al menú y al modal detrás del contenido.
    const z = Number(/z-(\d+)/.exec(nav.className)?.[1] ?? 0);
    expect(z).toBeGreaterThan(10);
  });

  it("el modal se monta fuera del nav, colgando de <body>", () => {
    pintar();
    fireEvent.click(screen.getByLabelText(/abrir menú de usuario/i));
    fireEvent.click(screen.getByText(/doble factor/i));

    const dialogo = document.querySelector(".fixed.inset-0") as HTMLElement;
    expect(dialogo).toBeTruthy();
    const nav = screen.getByLabelText("Secciones de Consientify");
    expect(nav.contains(dialogo)).toBe(false);
    expect(dialogo.parentElement).toBe(document.body);
  });
});
