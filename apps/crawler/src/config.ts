export interface CrawlConfig {
  seeds: string[];
  maxPages: number;
  delayMs: number;
  workers: number;
}
export function parseCrawlConfig(raw: string | null): CrawlConfig {
  const value: unknown = raw === null ? { seeds: [] } : JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('seeds' in value) || !Array.isArray(value.seeds))
    throw new Error('Invalid crawl config');
  const seeds: unknown[] = value.seeds;
  if (!seeds.every((seed): seed is string => typeof seed === 'string') || seeds.length > 100)
    throw new Error('Invalid seeds');
  for (const seed of seeds)
    if (!['http:', 'https:'].includes(new URL(seed).protocol))
      throw new Error('Invalid seed protocol');
  function number(
    key: 'maxPages' | 'delayMs' | 'workers',
    fallback: number,
    min: number,
    max: number,
  ): number {
    if (!value || typeof value !== 'object') throw new Error('Invalid config');
    const n = key in value ? Reflect.get(value, key) : fallback;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max)
      throw new Error(`Invalid ${key}`);
    return n;
  }
  return {
    seeds,
    maxPages: number('maxPages', 10_000, 1, 1_000_000),
    delayMs: number('delayMs', 500, 0, 60_000),
    workers: number('workers', 1, 1, 10),
  };
}
