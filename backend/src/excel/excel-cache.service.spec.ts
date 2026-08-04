import { ExcelCacheService } from './excel-cache.service';

describe('ExcelCacheService', () => {
  let svc: ExcelCacheService;
  beforeEach(() => { svc = new ExcelCacheService(); });

  it('primer fetch invoca fetchFn y devuelve el buffer', async () => {
    const fetchFn = jest.fn().mockResolvedValue(Buffer.from('data'));
    const out = await svc.getOrFetch('url1', fetchFn);
    expect(out).toEqual(Buffer.from('data'));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('segundo fetch dentro del TTL reusa el cache sin llamar fetchFn', async () => {
    const fetchFn = jest.fn().mockResolvedValue(Buffer.from('data'));
    await svc.getOrFetch('url1', fetchFn);
    await svc.getOrFetch('url1', fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('fetch después del TTL refetchea', async () => {
    jest.useFakeTimers();
    const fetchFn = jest.fn().mockResolvedValue(Buffer.from('data'));
    await svc.getOrFetch('url1', fetchFn);
    jest.advanceTimersByTime(60_001);
    await svc.getOrFetch('url1', fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('URLs distintas tienen entries independientes', async () => {
    const fetchA = jest.fn().mockResolvedValue(Buffer.from('a'));
    const fetchB = jest.fn().mockResolvedValue(Buffer.from('b'));
    const [a, b] = await Promise.all([
      svc.getOrFetch('url-a', fetchA),
      svc.getOrFetch('url-b', fetchB),
    ]);
    expect(a).toEqual(Buffer.from('a'));
    expect(b).toEqual(Buffer.from('b'));
  });

  it('al alcanzar MAX_ENTRIES=100, evict de la entry más antigua (LRU)', async () => {
    for (let i = 0; i < 100; i++) {
      await svc.getOrFetch(`url-${i}`, () => Promise.resolve(Buffer.from(`${i}`)));
    }
    // Insert la 101 → debería sacar la 0
    await svc.getOrFetch('url-101', () => Promise.resolve(Buffer.from('101')));
    // Refetch url-0 debería llamar fetchFn de nuevo (fue evicted)
    const refetch = jest.fn().mockResolvedValue(Buffer.from('re-0'));
    await svc.getOrFetch('url-0', refetch);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
