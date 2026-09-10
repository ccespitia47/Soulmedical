import { createHash } from 'crypto';

/** Serializa a JSON con llaves ordenadas recursivamente (estable). */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

/** sha-256 hex del contenido canónico del consentimiento. */
export function consentHash(payload: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalize(payload)).digest('hex');
}
