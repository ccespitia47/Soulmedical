import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lookupPacienteApi, getConsentApi } from "./api";

const json = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? "application/json" : null) },
  json: async () => body,
});

describe("lookupPacienteApi", () => {
  beforeEach(() => {
    localStorage.setItem("token", "jwt-abc");
    localStorage.setItem("user", "{}");
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("arma el querystring con numDoc, entidad y excludeId", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(json({ ultimo: null, vacunas: [] }));
    await lookupPacienteApi("123", "SOUL", "6d95b4fb-22d9-4cf5-922f-26a863a18843");
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toMatch(/numDoc=123/);
    expect(url).toMatch(/entidad=SOUL/);
    expect(url).toMatch(/excludeId=6d95b4fb-22d9-4cf5-922f-26a863a18843/);
  });

  it("sin excludeId no lo envía", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(json({ ultimo: null, vacunas: [] }));
    await lookupPacienteApi("123");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).not.toMatch(/excludeId/);
  });

  it("un 401 devuelve error y NO borra la sesión (no arrastra al login)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(json({}, 401));
    const r = await lookupPacienteApi("12345");
    expect(r.data).toBeNull();
    expect(r.error).toBeTruthy();
    expect(localStorage.getItem("token")).toBe("jwt-abc");
    expect(localStorage.getItem("user")).toBe("{}");
  });

  it("control: un 401 en otro endpoint sí borra la sesión", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(json({}, 401));
    await getConsentApi("x");
    expect(localStorage.getItem("token")).toBeNull();
  });
});
