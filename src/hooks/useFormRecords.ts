import { useCallback, useEffect, useRef, useState } from 'react';
import { getFormRecordsApi, type RecordRowDto } from '../services/api';

type Filters = {
  from?: string;
  to?: string;
  q?: string;
};

export function useFormRecords(formId: string | null, filters: Filters) {
  const [data, setData] = useState<RecordRowDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  // `loading` es TRUE durante cualquier fetch. `hasEverLoaded` es TRUE una
  // vez que el primer fetch (o su error) terminó. La UI puede diferenciar:
  //   - initial: !hasEverLoaded → spinner grande
  //   - refetch: hasEverLoaded && loading → indicador sutil, la tabla no salta
  const [loading, setLoading] = useState(false);
  const [hasEverLoaded, setHasEverLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const LIMIT = 25;

  // Ignoramos respuestas de fetches obsoletos (el usuario tipeó 3 letras
  // rápido → 3 fetches disparados → si el 2o llega después del 3o, sin este
  // guard verías momentáneamente los resultados equivocados).
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!formId) return;
    const myRequest = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    const res = await getFormRecordsApi(formId, { page, limit: LIMIT, ...filters });
    if (myRequest !== requestIdRef.current) return; // llegó tarde, ignorar
    if (res.error || !res.data) {
      setError(res.error ?? 'No se pudieron cargar los registros');
      setData([]);
      setTotal(0);
    } else {
      setData(res.data.data);
      setTotal(res.data.total);
    }
    setLoading(false);
    setHasEverLoaded(true);
  }, [formId, page, filters.from, filters.to, filters.q]);

  useEffect(() => {
    load();
  }, [load]);

  // Al cambiar filtros, volver a la página 1.
  useEffect(() => {
    setPage(1);
  }, [filters.from, filters.to, filters.q]);

  return {
    data,
    total,
    loading,
    isInitialLoading: loading && !hasEverLoaded,
    error,
    page,
    setPage,
    pageCount: Math.max(1, Math.ceil(total / LIMIT)),
    refresh: load,
  };
}
