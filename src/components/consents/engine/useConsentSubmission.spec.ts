import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../../../services/api", () => ({
  createConsentApi: vi.fn(),
}));
vi.mock("../../../utils/pdfExporter", () => ({ htmlToPdfBase64: vi.fn().mockResolvedValue("BASE64") }));
vi.mock("../../../services/emailService", () => ({ sendFormEmail: vi.fn().mockResolvedValue(undefined) }));

import { useConsentSubmission } from "./useConsentSubmission";
import { createConsentApi } from "../../../services/api";
import { sendFormEmail } from "../../../services/emailService";
import type { ConsentDefinition, ConsentState } from "./consentDefinition";

const def: ConsentDefinition = {
  meta: { tipo: "vih", titulo: "VIH", entidadNombre: "SOUL", displayName: "SOUL", codigo: "C", version: "1", logo: "" },
  sections: [
    { id: "g", kind: "fields", fields: [{ id: "nombres", label: "Nombres", type: "text" }, { id: "numDoc", label: "Doc", type: "text" }] },
    { id: "f", kind: "signatures", firmaPaciente: { id: "firma_paciente", label: "Firma" } },
  ],
};
const state: ConsentState = { values: { nombres: "Juan", numDoc: "1" }, firma: "data:image/png;base64,AA", firmaResp: "", foto: "", accepted: true };

describe("useConsentSubmission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persiste vía createConsentApi con el payload del estado", async () => {
    (createConsentApi as any).mockResolvedValue({ data: { id: "r1" }, error: null });
    const { result } = renderHook(() => useConsentSubmission(def));
    await act(async () => { await result.current.submitConsent(state); });
    expect(createConsentApi).toHaveBeenCalledWith(expect.objectContaining({ tipo: "vih", nombres: "Juan", numDoc: "1", firmaPaciente: "data:image/png;base64,AA" }));
    expect(result.current.done).toBe(true);
  });

  it("si createConsentApi devuelve error, expone submitError y NO envía correo", async () => {
    (createConsentApi as any).mockResolvedValue({ data: null, error: "numDoc duplicado" });
    const { result } = renderHook(() => useConsentSubmission(def));
    await act(async () => { await result.current.submitConsent(state); });
    expect(result.current.submitError).toBe("numDoc duplicado");
    expect(result.current.emailError).toBeNull();
    expect(result.current.done).toBe(false);
    expect(sendFormEmail).not.toHaveBeenCalled();
  });

  it("si el POST tiene éxito, genera el PDF y envía el correo con firmaPaciente excluida de formData", async () => {
    (createConsentApi as any).mockResolvedValue({ data: { id: "r1" }, error: null });
    const { result } = renderHook(() => useConsentSubmission(def));
    await act(async () => { await result.current.submitConsent(state); });
    expect(sendFormEmail).toHaveBeenCalledTimes(1);
    const call = (sendFormEmail as any).mock.calls[0][0];
    expect(call.formData.firma_paciente).toBeUndefined();
    expect(call.formData.pacienteNombre).toBe("Juan");
    expect(call.attachments[0].contentBytes).toBe("BASE64");
    expect(result.current.emailStatus).toBe("sent");
  });
});
