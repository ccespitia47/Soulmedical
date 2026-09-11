// Estado de la tabla de la vista de registros unificada (Task 6): pagina y
// filtra `consent_records` vía `listConsentsApi`. `setFilters` reemplaza el
// conjunto de filtros y siempre vuelve a la página 1 (una nueva búsqueda no
// debería quedarse en una página que puede no existir para el nuevo filtro).

import { useCallback, useEffect, useState } from "react";
import { listConsentsApi, type ConsentRecordDto } from "../../../services/api";

export type ConsentRecordFilters = {
  tipo?: string;
  search?: string;
  from?: string;
  to?: string;
};

const DEFAULT_LIMIT = 50;

export function useConsentRecords() {
  const [rows, setRows] = useState<ConsentRecordDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(DEFAULT_LIMIT);
  const [filters, setFiltersState] = useState<ConsentRecordFilters>({});
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await listConsentsApi({ ...filters, page, limit });
    setRows(data?.data ?? []);
    setTotal(data?.total ?? 0);
    setLoading(false);
  }, [filters, page, limit]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const setFilters = useCallback((next: ConsentRecordFilters) => {
    setFiltersState(next);
    setPage(1);
  }, []);

  return { rows, total, page, limit, filters, setFilters, setPage, refetch, loading };
}
