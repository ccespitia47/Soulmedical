import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createConsentApi, listConsentsApi } from "./api";

describe("consentsApi", () => {
  beforeEach(() => {
    localStorage.setItem("token", "jwt-abc");
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("createConsentApi hace POST /consents con Bearer token y body", async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "r1" }) });
    const res = await createConsentApi({
      tipo: "vih", tipoDoc: "CC", numDoc: "1", nombres: "A", apellidos: "B",
      respuestas: {}, firmaPaciente: "data:image/png;base64,AA",
    });
    expect(res.data?.id).toBe("r1");
    const [url, opts] = (fetch as any).mock.calls[0];
    expect(url).toMatch(/\/consents$/);
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Bearer jwt-abc");
  });

  it("listConsentsApi arma el querystring de filtros", async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [], total: 0, page: 1, limit: 50 }) });
    await listConsentsApi({ tipo: "vih", page: 2, limit: 10, search: "juan" });
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toMatch(/tipo=vih/);
    expect(url).toMatch(/page=2/);
    expect(url).toMatch(/search=juan/);
  });
});
