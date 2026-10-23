import { describe, it, expect, vi } from 'vitest';
import { UrlFrontier, processingKey } from '../src/frontier.js';
import type { Redis } from 'ioredis';

describe('UrlFrontier Reliable Queue', () => {
  it('formats worker processing key correctly', () => {
    expect(processingKey('worker-1')).toBe('frontier:processing:worker-1');
  });

  it('passes worker processing key to Lua script during dequeue', async () => {
    const mockRedis = {
      eval: vi.fn().mockResolvedValue(['example.com', 'https://example.com/page-1']),
      decr: vi.fn().mockResolvedValue(0),
    } as unknown as Redis;

    const frontier = new UrlFrontier({ redis: mockRedis, delayMs: 100 });
    const result = await frontier.dequeue('worker-123');

    expect(result).toEqual({ domain: 'example.com', url: 'https://example.com/page-1' });
    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      'frontier:domains',
      'frontier:processing:worker-123',
      expect.any(String),
      expect.any(String),
    );
  });

  it('removes processed URL from worker processing set upon complete', async () => {
    const mockRedis = {
      zrem: vi.fn().mockResolvedValue(1),
    } as unknown as Redis;

    const frontier = new UrlFrontier({ redis: mockRedis });
    await frontier.complete('worker-123', 'https://example.com/page-1', 'example.com');

    expect(mockRedis.zrem).toHaveBeenCalledWith(
      'frontier:processing:worker-123',
      'https://example.com/page-1',
    );
  });

  it('reaps stale processing entries and re-enqueues them', async () => {
    const stalePayload = JSON.stringify({
      url: 'https://example.com/stale-page',
      domain: 'example.com',
    });
    const mockRedis = {
      scan: vi
        .fn()
        .mockResolvedValueOnce(['1', ['frontier:processing:worker-crashed']])
        .mockResolvedValueOnce(['0', []]),
      zrangebyscore: vi.fn().mockResolvedValue([stalePayload]),
      lpush: vi.fn().mockResolvedValue(1),
      zadd: vi.fn().mockResolvedValue(1),
      incr: vi.fn().mockResolvedValue(1),
      zrem: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockResolvedValue(1),
    } as unknown as Redis;

    const frontier = new UrlFrontier({ redis: mockRedis });
    const reaped = await frontier.reapStale(60_000);

    expect(reaped).toBe(1);
    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      3,
      'frontier:processing:worker-crashed',
      'frontier:queue:example.com',
      'frontier:domains',
      stalePayload,
      expect.any(Number),
      'https://example.com/stale-page',
      'example.com',
    );
  });
});
