import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("../../services/api", async (orig) => ({
  ...(await orig<typeof import("../../services/api")>()),
  getConsentPdfPayloadApi: vi.fn(),
  lookupPacienteApi: vi.fn(),
}));
import { getConsentPdfPayloadApi, lookupPacienteApi, type ConsentRecordDto } from "../../services/api";
import ConsentForm from "./ConsentForm";

const record = {
  id: "6d95b4fb-22d9-4cf5-922f-26a863a18843", tipo: "vih", entidad: null, tipoDoc: "CC", numDoc: "12345678",
  nombres: "Ana", apellidos: "Pérez", ciudad: "Cali, Valle del Cauca", profesional: "Dr. X", estado: "firmado",
  respuestas: { fecha: "2026-03-01" }, firmaPaciente: null, firmaResponsable: null, foto: null,
  hashVerificacion: "h", createdAt: "2026-03-01T10:00:00.000Z",
} as unknown as ConsentRecordDto;

describe("ConsentForm en modo edición", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getConsentPdfPayloadApi).mockResolvedValue({
      data: { record, firmaPacienteDataUrl: null, firmaResponsableDataUrl: null, fotoDataUrl: null },
      error: null,
    } as never);
    vi.mocked(lookupPacienteApi).mockResolvedValue({ data: { ultimo: null, vacunas: [] }, error: null });
  });
  afterEach(() => vi.useRealTimers());

  it("I2: consulta el historial excluyendo el propio registro", async () => {
    render(<ConsentForm tipo="vih" editRecord={record} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(screen.queryByText(/Cargando registro/)).toBeNull();
    expect(lookupPacienteApi).toHaveBeenCalledWith("12345678", undefined, record.id);
  });
});
