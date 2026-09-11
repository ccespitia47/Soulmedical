import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("../../../services/api", () => ({ listConsentsApi: vi.fn() }));
import { useConsentRecords } from "./useConsentRecords";
import { listConsentsApi } from "../../../services/api";

describe("useConsentRecords", () => {
  beforeEach(() => vi.clearAllMocks());
  it("carga la primera página y aplica filtros", async () => {
    (listConsentsApi as any).mockResolvedValue({ data: { data: [{ id: "r1" }], total: 1, page: 1, limit: 50 }, error: null });
    const { result } = renderHook(() => useConsentRecords());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.setFilters({ tipo: "vih" }));
    await waitFor(() => expect(listConsentsApi).toHaveBeenLastCalledWith(expect.objectContaining({ tipo: "vih" })));
  });

  it("descarta una respuesta obsoleta que resuelve después de un refetch más reciente (latest wins)", async () => {
    // La primera llamada (montaje) queda pendiente; la segunda (refetch
    // manual) resuelve primero. Si no hubiera guard, la primera pisaría el
    // estado con datos viejos al resolver después.
    let resolveFirst!: (v: any) => void;
    const firstCall = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    (listConsentsApi as any)
      .mockReturnValueOnce(firstCall)
      .mockResolvedValueOnce({ data: { data: [{ id: "fresh" }], total: 1, page: 1, limit: 50 }, error: null });

    const { result } = renderHook(() => useConsentRecords());

    // Dispara el segundo refetch (más reciente) mientras el primero sigue pendiente.
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.rows).toEqual([{ id: "fresh" }]));

    // Ahora resuelve la llamada más vieja (del montaje) con datos obsoletos.
    await act(async () => {
      resolveFirst({ data: { data: [{ id: "stale" }], total: 1, page: 1, limit: 50 }, error: null });
    });

    // El estado no debe haber sido pisado por la respuesta obsoleta.
    expect(result.current.rows).toEqual([{ id: "fresh" }]);
  });
});
