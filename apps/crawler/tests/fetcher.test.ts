import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertSafeUrl, isPrivateIPv4, isPrivateIPv6, fetchUrl } from '../src/fetcher.js';
import { createServer } from 'node:http';

afterEach(() => vi.unstubAllEnvs());
describe('network boundary', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.31.0.1', '192.168.1.1', '169.254.1.1', '0.0.0.0'])('blocks IPv4 %s', ip => expect(isPrivateIPv4(ip)).toBe(true));
  it.each(['::1', '::', 'fe90::1', 'fc00::1', '::ffff:127.0.0.1', '::ffff:7f00:1'])('blocks IPv6 %s', ip => expect(isPrivateIPv6(ip)).toBe(true));
  it('permits public addresses and rejects unsafe protocols', async () => {
    expect(isPrivateIPv4('8.8.8.8')).toBe(false);
    expect(isPrivateIPv6('2606:4700:4700::1111')).toBe(false);
    await expect(assertSafeUrl('file:///etc/passwd')).rejects.toThrow('Blocked');
    await expect(assertSafeUrl('http://127.0.0.1')).rejects.toThrow('Blocked');
  });
  it('blocks redirects off the explicitly allowed test origin before connecting', async () => {
    const server = createServer((_req, res) => { res.writeHead(302, { Location: 'http://127.0.0.1:1/private' }); res.end(); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No fixture port');
    const origin = `http://127.0.0.1:${address.port}`;
    vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('CRAWLER_TEST_ORIGIN', origin);
    try { await expect(fetchUrl(origin)).rejects.toThrow('Blocked'); }
    finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
