import { Injectable } from '@nestjs/common';

type CacheEntry = { buffer: Buffer; expiresAt: number };

@Injectable()
export class ExcelCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private static readonly TTL_MS = 60_000;
  private static readonly MAX_ENTRIES = 100;

  async getOrFetch(url: string, fetchFn: () => Promise<Buffer>): Promise<Buffer> {
    const hit = this.cache.get(url);
    if (hit && Date.now() < hit.expiresAt) {
      // LRU: al hit reciente, moverlo al final del Map (Map preserva insertion order)
      this.cache.delete(url);
      this.cache.set(url, hit);
      return hit.buffer;
    }

    const buffer = await fetchFn();

    if (this.cache.size >= ExcelCacheService.MAX_ENTRIES) {
      // Evict la entry más antigua (primera del Map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }

    this.cache.set(url, {
      buffer,
      expiresAt: Date.now() + ExcelCacheService.TTL_MS,
    });
    return buffer;
  }
}
