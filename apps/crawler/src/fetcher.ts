/**
 * HTML Fetcher
 *
 * Fetches a URL with:
 *   - SSRF protection (blocks private, loopback, and link-local IPs)
 *   - Protocol validation (only http/https)
 *   - Configurable timeout (default 10s)
 *   - Automatic redirect following (max 5 hops, handled by undici)
 *   - Exponential backoff retry (max 3 attempts)
 *   - Only processes HTML responses (skips binary, CSS, JS)
 */

import { request } from 'undici';
import { lookup } from 'node:dns/promises';
import { logger } from './logger.js';

export interface FetchResult {
  url: string;       // Final URL after redirects
  html: string;
  statusCode: number;
}

const MAX_RETRIES = 3;
const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

// ---------------------------------------------------------------------------
// SSRF Protection: block private, loopback, and link-local IP ranges
// ---------------------------------------------------------------------------

/**
 * Check whether an IPv4 address falls in a private, loopback, or link-local range.
 *
 * Blocked ranges:
 *   - 10.0.0.0/8     (private)
 *   - 172.16.0.0/12  (private)
 *   - 192.168.0.0/16 (private)
 *   - 127.0.0.0/8    (loopback)
 *   - 169.254.0.0/16 (link-local)
 *   - 0.0.0.0/8      (current network)
 */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false; // Not a valid IPv4 — let caller decide
  }
  const [a, b] = parts as [number, number, number, number];

  if (a === 10) return true;                                    // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;             // 172.16.0.0/12
  if (a === 192 && b === 168) return true;                      // 192.168.0.0/16
  if (a === 127) return true;                                   // 127.0.0.0/8
  if (a === 169 && b === 254) return true;                      // 169.254.0.0/16
  if (a === 0) return true;                                     // 0.0.0.0/8
  return false;
}

/**
 * Check whether an IPv6 address is loopback (::1) or link-local (fe80::/10).
 */
export function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;                        // loopback
  if (normalized.startsWith('fe80:')) return true;              // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local
  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  const v4Match = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Match && v4Match[1]) return isPrivateIPv4(v4Match[1]);
  return false;
}

/**
 * Validate a URL is safe to fetch:
 *   1. Only http/https protocols are allowed
 *   2. Resolved IP must not be private, loopback, or link-local
 *
 * Throws an error with { permanent: true } if blocked.
 */
export async function assertSafeUrl(url: string): Promise<void> {
  const parsed = new URL(url);

  // Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw Object.assign(
      new Error(`Blocked URL: unsupported protocol ${parsed.protocol}`),
      { permanent: true },
    );
  }

  // DNS resolution check
  const hostname = parsed.hostname;

  // If the hostname is already an IP literal, check directly
  if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
    throw Object.assign(
      new Error(`Blocked URL: private/loopback IP ${hostname}`),
      { permanent: true },
    );
  }

  // Resolve the hostname and check all returned addresses
  try {
    const results = await lookup(hostname, { all: true });
    for (const result of results) {
      const blocked =
        result.family === 4
          ? isPrivateIPv4(result.address)
          : isPrivateIPv6(result.address);
      if (blocked) {
        throw Object.assign(
          new Error(`Blocked URL: ${hostname} resolves to private/loopback IP ${result.address}`),
          { permanent: true },
        );
      }
    }
  } catch (err) {
    // Re-throw SSRF blocks; swallow DNS-not-found (let undici handle it)
    if ((err as { permanent?: boolean }).permanent) throw err;
    logger.debug({ hostname, err }, 'DNS lookup warning (will let undici handle)');
  }
}

/**
 * Fetch a URL and return its HTML content.
 * Throws on non-recoverable errors (4xx, non-HTML content-type, SSRF, etc.).
 */
export async function fetchUrl(url: string): Promise<FetchResult> {
  // SSRF check before any network request
  await assertSafeUrl(url);

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { body, statusCode, headers } = await request(url, {
        method: 'GET',
        maxRedirections: 5,
        headersTimeout: TIMEOUT_MS,
        bodyTimeout: TIMEOUT_MS,
        headers: {
          'User-Agent': 'SeekerBot/1.0',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      const contentType = (headers['content-type'] ?? '') as string;

      // Skip non-HTML responses immediately (no retry)
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        await body.dump();
        throw Object.assign(new Error('Non-HTML content-type'), { permanent: true });
      }

      if (statusCode >= 400 && statusCode < 500) {
        await body.dump();
        throw Object.assign(new Error(`HTTP ${statusCode}`), { permanent: true });
      }

      if (statusCode >= 500) {
        await body.dump();
        throw new Error(`HTTP ${statusCode}`);
      }

      // Read body up to MAX_BODY_BYTES
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      for await (const chunk of body) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer);
        totalBytes += buf.byteLength;
        chunks.push(buf);
        if (totalBytes > MAX_BODY_BYTES) break;
      }

      const html = Buffer.concat(chunks).toString('utf8');
      return { url, html, statusCode };
    } catch (err) {
      lastError = err;
      // Don't retry permanent errors
      if ((err as { permanent?: boolean }).permanent) throw err;

      if (attempt < MAX_RETRIES) {
        const delay = 500 * Math.pow(2, attempt - 1); // 500ms, 1000ms, 2000ms
        logger.warn({ url, attempt, delay }, 'Fetch failed, retrying');
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

