import { Agent, request } from 'undici';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP, type LookupFunction } from 'node:net';

export interface FetchResult { url: string; html: string; statusCode: number }
const blocked = new BlockList();
for (const [network, prefix] of [ ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4] ] as const) blocked.addSubnet(network, prefix, 'ipv4');
blocked.addAddress('::', 'ipv6'); blocked.addAddress('::1', 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6'); blocked.addSubnet('fe80::', 10, 'ipv6');
blocked.addSubnet('ff00::', 8, 'ipv6');
export const isPrivateIPv4 = (ip: string): boolean => isIP(ip) === 4 && blocked.check(ip, 'ipv4');
export const isPrivateIPv6 = (ip: string): boolean => isIP(ip) === 6 && blocked.check(ip, 'ipv6');
function permanent(message: string): Error & { permanent: true } {
  return Object.assign(new Error(message), { permanent: true as const });
}
function allowFixture(url: URL): boolean {
  // This narrow exception is available only in the explicitly configured E2E
  // test process. Redirects to a different private origin remain blocked.
  return process.env['NODE_ENV'] === 'test' && url.origin === process.env['CRAWLER_TEST_ORIGIN'];
}
function hostname(url: URL): string { return url.hostname.replace(/^\[|\]$/g, ''); }
async function addresses(host: string, allowPrivate: boolean) {
  const resolved = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
  if (!resolved.length || (!allowPrivate && resolved.some(r => isPrivateIPv4(r.address) || isPrivateIPv6(r.address)))) {
    throw permanent(`Blocked URL: ${host} resolves to a non-public address`);
  }
  return resolved;
}
export async function assertSafeUrl(raw: string): Promise<void> {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw permanent('Blocked URL: only HTTP(S) URLs without credentials are allowed');
  }
  await addresses(hostname(url), allowFixture(url));
}

export async function fetchUrl(raw: string, requireHtml = true): Promise<FetchResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let url = new URL(raw);
      for (let hop = 0; hop <= 5; hop++) {
        await assertSafeUrl(url.href);
        // Validate the addresses actually handed to the socket, too. A separate
        // preflight lookup alone leaves a DNS-rebinding window.
        const safeLookup: LookupFunction = (host, options, callback) => {
          addresses(host, allowFixture(url)).then(resolved => {
            const chosen = resolved.find(r => !options.family || r.family === options.family) ?? resolved[0];
            if (!chosen) { callback(new Error('No address'), '', 4); return; }
            if (options.all) callback(null, resolved);
            else callback(null, chosen.address, chosen.family);
          }).catch((err: Error) => callback(err, '', 4));
        };
        const agent = new Agent({ connect: { lookup: safeLookup } });
        try {
          const { body, statusCode, headers } = await request(url.href, {
            dispatcher: agent, maxRedirections: 0, headersTimeout: 10_000, bodyTimeout: 10_000,
            signal: AbortSignal.timeout(15_000),
            headers: { 'User-Agent': 'SeekrBot/1.0', Accept: requireHtml ? 'text/html,application/xhtml+xml' : 'text/plain' },
          });
          // Intentional cancellation of redirect/non-HTML bodies emits an
          // AbortError. Consume that event; for-await still propagates read errors.
          body.on('error', () => {});
          if ([301, 302, 303, 307, 308].includes(statusCode)) {
            body.destroy();
            if (!headers.location || hop === 5) throw permanent('Redirect limit exceeded or missing Location');
            url = new URL(String(headers.location), url);
            continue; // Every redirect goes through URL and connection-time checks.
          }
          if (statusCode >= 400) {
            body.destroy();
            if (statusCode < 500) throw permanent(`HTTP ${statusCode}`);
            throw new Error(`HTTP ${statusCode}`);
          }
          const contentType = String(headers['content-type'] ?? '').toLowerCase();
          if (requireHtml && !contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
            body.destroy(); throw permanent('Non-HTML content-type');
          }
          const chunks: Buffer[] = []; let size = 0;
          for await (const chunk of body) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            if (size > 5 * 1024 * 1024) { body.destroy(); throw permanent('Response exceeds 5 MiB'); }
            chunks.push(buffer);
          }
          return { url: url.href, html: Buffer.concat(chunks).toString('utf8'), statusCode };
        } finally { await agent.destroy(); }
      }
    } catch (err) {
      lastError = err;
      if (err instanceof Error && 'permanent' in err && err.permanent) throw err;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}
