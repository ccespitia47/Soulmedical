import { describe, it, expect } from "vitest";
import { buildEmailFormData } from "./placeholders";

type W = Parameters<typeof buildEmailFormData>[0][number];

/**
 * El backend resuelve los destinatarios `type: 'field'` con
 * `formData[recipient.widgetId]` (email.service.ts). Si el formData que manda
 * el cliente solo trae claves por label normalizado, esa búsqueda devuelve
 * undefined y el destinatario se descarta EN SILENCIO — si era el único en
 * "Para", el envío entero falla con "No hay destinatarios válidos".
 *
 * El camino público (forms.service.ts) ya manda ambas familias de claves:
 * `{ ...dataPorWidgetId, ...clavesPorLabel }`. Estas pruebas fijan ese mismo
 * contrato para el camino autenticado.
 */
describe("buildEmailFormData", () => {
  const widgets = [
    { id: "w_correoElectrnico", type: "email", label: "Correo Electrónico" },
    { id: "w_nombre", type: "text", label: "Nombre Completo" },
  ] as unknown as W[];

  const data = {
    w_correoElectrnico: "paciente@ejemplo.com",
    w_nombre: "Ana Pérez",
  };

  it("incluye las claves por widgetId (destinatarios type='field')", () => {
    const out = buildEmailFormData(widgets, data);
    expect(out["w_correoElectrnico"]).toBe("paciente@ejemplo.com");
  });

  it("sigue incluyendo las claves por label normalizado (placeholders)", () => {
    const out = buildEmailFormData(widgets, data);
    expect(out["correoelectrnico"]).toBe("paciente@ejemplo.com");
    expect(out["nombrecompleto"]).toBe("Ana Pérez");
  });

  it("omite los widgets ocultos por reglas en AMBAS familias de claves", () => {
    const out = buildEmailFormData(widgets, data, new Set(["w_correoElectrnico"]));
    expect(out["w_correoElectrnico"]).toBeUndefined();
    expect(out["correoelectrnico"]).toBeUndefined();
    // El visible no se ve afectado.
    expect(out["w_nombre"]).toBe("Ana Pérez");
    expect(out["nombrecompleto"]).toBe("Ana Pérez");
  });
});
