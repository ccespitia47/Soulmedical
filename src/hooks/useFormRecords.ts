import { useCallback, useEffect, useState } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const LIMIT = 25;

  const load = useCallback(async () => {
    if (!formId) return;
    setLoading(true);
    setError(null);
    const res = await getFormRecordsApi(formId, { page, limit: LIMIT, ...filters });
    if (res.error || !res.data) {
      setError(res.error ?? 'No se pudieron cargar los registros');
      setData([]);
      setTotal(0);
    } else {
      setData(res.data.data);
      setTotal(res.data.total);
    }
    setLoading(false);
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
    error,
    page,
    setPage,
    pageCount: Math.max(1, Math.ceil(total / LIMIT)),
    refresh: load,
  };
}
