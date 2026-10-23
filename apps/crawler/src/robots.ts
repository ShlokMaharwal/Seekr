import robotsParserPackage from 'robots-parser';
import { fetchUrl } from './fetcher.js';

type Parser = { isAllowed(url: string, agent: string): boolean | undefined };
function parseRobots(url: string, text: string): Parser {
  const factory: unknown = robotsParserPackage;
  if (typeof factory !== 'function') throw new Error('Invalid robots parser export');
  const parser: unknown = factory(url, text);
  if (!parser || typeof parser !== 'object' || !('isAllowed' in parser) || typeof parser.isAllowed !== 'function') {
    throw new Error('Invalid robots parser result');
  }
  const isAllowed = parser.isAllowed;
  return { isAllowed: (target, agent) => {
    const result: unknown = isAllowed.call(parser, target, agent);
    return typeof result === 'boolean' ? result : undefined;
  } };
}
export class RobotsCache {
  private readonly cache = new Map<string, { parser: Parser; expiresAt: number }>();
  async isAllowed(url: string, userAgent = 'SeekrBot'): Promise<boolean> {
    const origin = new URL(url).origin;
    let cached = this.cache.get(origin);
    if (!cached || cached.expiresAt <= Date.now()) {
      let text = '';
      try { text = (await fetchUrl(`${origin}/robots.txt`, false)).html; }
      catch { /* Missing/unavailable robots files use the documented allow policy. */ }
      cached = { parser: parseRobots(`${origin}/robots.txt`, text), expiresAt: Date.now() + 3_600_000 };
      this.cache.set(origin, cached);
    }
    return cached.parser.isAllowed(url, userAgent) !== false;
  }
}
