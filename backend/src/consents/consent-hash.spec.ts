import { canonicalize, consentHash } from './consent-hash';

describe('consent-hash', () => {
  it('canonicalize ordena llaves de forma estable', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it('hash es idéntico sin importar el orden de llaves', () => {
    const a = consentHash({ tipo: 'vih', numDoc: '1', respuestas: { x: 1, y: 2 } });
    const b = consentHash({ respuestas: { y: 2, x: 1 }, numDoc: '1', tipo: 'vih' });
    expect(a).toBe(b);
  });

  it('hash cambia si cambia un valor', () => {
    const a = consentHash({ numDoc: '1' });
    const b = consentHash({ numDoc: '2' });
    expect(a).not.toBe(b);
  });

  it('devuelve sha-256 hex de 64 chars', () => {
    expect(consentHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});
