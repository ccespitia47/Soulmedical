import { useCallback, useEffect, useRef, useState } from 'react';
import { getSubmissionPdfBlobApi } from '../services/api';

export function usePdfPreview() {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revokeRef = useRef<string | null>(null);

  const open = useCallback(async (submissionId: string) => {
    setLoading(true);
    setError(null);
    if (revokeRef.current) URL.revokeObjectURL(revokeRef.current);
    revokeRef.current = null;
    setBlob(null);
    setBlobUrl(null);
    const { blob, filename, error } = await getSubmissionPdfBlobApi(submissionId);
    if (error || !blob) {
      setError(error ?? 'No se pudo generar el PDF');
      setLoading(false);
      return;
    }
    const url = URL.createObjectURL(blob);
    revokeRef.current = url;
    setBlob(blob);
    setBlobUrl(url);
    setFilename(filename);
    setLoading(false);
  }, []);

  const close = useCallback(() => {
    if (revokeRef.current) URL.revokeObjectURL(revokeRef.current);
    revokeRef.current = null;
    setBlob(null);
    setBlobUrl(null);
    setFilename('');
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (revokeRef.current) URL.revokeObjectURL(revokeRef.current);
    };
  }, []);

  return { blob, blobUrl, filename, loading, error, open, close };
}
