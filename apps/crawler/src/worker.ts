
/**
 * Crawler Worker
 *
 * Pulls URLs from the Redis frontier, fetches and parses pages,
 * stores documents in MongoDB, and publishes documents for indexing.
 */

import { Redis } from 'ioredis';
import { UrlFrontier } from './frontier.js';
import { RobotsCache } from './robots.js';
import { fetchUrl } from './fetcher.js';
import { parseHtml, extractDomain } from './parser.js';
import { DocumentStore } from './store.js';
import { logger } from './logger.js';

export const INDEXER_STREAM = 'stream:new-docs';

export interface CrawlerConfig {
  redisUrl?: string;
  mongoUrl?: string;
  concurrency?: number;
  delayMs?: number;
  maxPages?: number;
  allowedPrefixes?: string[];
}

export class CrawlerWorker {
  private readonly redis: Redis;
  private readonly frontier: UrlFrontier;
  private readonly robots: RobotsCache;
  private readonly store: DocumentStore;
  private readonly config: Required<CrawlerConfig>;

  private running = false;
  private paused = false;
  private stopRequested = false;

  private crawledCount = 0;
  private activeCount = 0;
  private idleSince: number | null = null;

  private stopPromise: Promise<void> | null = null;

  constructor(config: CrawlerConfig = {}) {
    this.config = {
      redisUrl:
        config.redisUrl ??
        (process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
      mongoUrl:
        config.mongoUrl ??
        (process.env['MONGO_URL'] ?? 'mongodb://localhost:27017'),
      concurrency: Math.max(1, config.concurrency ?? 5),
      delayMs: config.delayMs ?? 500,
      maxPages: config.maxPages ?? Infinity,
      allowedPrefixes: config.allowedPrefixes ?? [],
    };

    this.redis = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: 3,
    });

    this.frontier = new UrlFrontier({
      redis: this.redis,
      delayMs: this.config.delayMs,
    });

    this.robots = new RobotsCache();
    this.store = new DocumentStore();
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    await this.store.connect(this.config.mongoUrl);

    this.running = true;
    this.stopRequested = false;
    this.crawledCount = 0;
    this.activeCount = 0;
    this.idleSince = null;

    logger.info(
      { config: this.config },
      'Crawler worker starting',
    );

    // Initial pass to recover any stale/abandoned URLs before starting
    await this.frontier.reapStale(60_000).catch(() => {});

    // Periodic reaper for abandoned URLs from crashed workers
    const reaperTimer = setInterval(() => {
      this.frontier.reapStale(60_000).catch((err) => {
        logger.warn({ err }, 'Reaper failed to scan stale processing URLs');
      });
    }, 15_000);

    const workers = Array.from(
      { length: this.config.concurrency },
      (_, index) => this.runLoop(index),
    );

    try {
      await Promise.all(workers);
    } finally {
      clearInterval(reaperTimer);
      this.running = false;
      if (this.stopRequested) await this.frontier.reset();
      await this.closeResources();
    }

    logger.info(
      { crawledCount: this.crawledCount },
      'Crawler worker finished',
    );
  }

  pause(): void {
    this.paused = true;
    logger.info('Crawler paused');
  }

  resume(): void {
    this.paused = false;
    logger.info('Crawler resumed');
  }

  async stop(): Promise<void> {
    if (this.stopPromise) {
      return this.stopPromise;
    }

    this.stopRequested = true;
    this.running = false;
    this.paused = false;

    // start() owns resource closure after in-flight processing finishes.
    // Closing Redis/Mongo here races the workers' finally/acknowledgement.
    this.stopPromise = Promise.resolve();

    try {
      await this.stopPromise;
      logger.info('Crawler stopped');
    } finally {
      this.stopPromise = null;
    }
  }

  private async closeResources(): Promise<void> {
    const results = await Promise.allSettled([
      this.store.close(),
      this.redis.quit(),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        logger.warn(
          { err: result.reason },
          'Error while closing crawler resource',
        );
      }
    }
  }

  private async runLoop(workerIndex: number): Promise<void> {
    const workerId = `worker-${process.pid}-${workerIndex}`;
    // Allow other workers time to finish processing discovered links.
    const idleTimeoutMs = 3000;

    while (this.running && !this.stopRequested) {
      if (this.paused) {
        await sleep(200);
        continue;
      }

      if (this.crawledCount >= this.config.maxPages) {
        this.running = false;
        break;
      }

      let next: Awaited<ReturnType<UrlFrontier['dequeue']>>;

      try {
        next = await this.frontier.dequeue(workerId);
      } catch (err) {
        if (!this.running || this.stopRequested) {
          break;
        }

        logger.error(
          { workerIndex, workerId, err },
          'Failed to dequeue URL',
        );

        await sleep(500);
        continue;
      }

      if (!this.running || this.stopRequested) {
        break;
      }

      if (next === null) {
        // Only finish after the queue remains empty and all workers
        // have been idle for the configured grace period.
        if (this.activeCount === 0) {
          if (this.idleSince === null) {
            this.idleSince = Date.now();
          } else if (
            Date.now() - this.idleSince >= idleTimeoutMs
          ) {
            this.running = false;
            break;
          }
        }

        await sleep(200);
        continue;
      }

      this.idleSince = null;
      this.activeCount++;
      const leaseTimer = setInterval(() => {
        this.frontier.renew(workerId, next.url).catch((err: unknown) => logger.warn({ err }, 'Lease renewal failed'));
      }, 10_000);

      try {
        await this.processUrl(next.url);
      } catch (err) {
        logger.error(
          { workerIndex, workerId, url: next.url, err },
          'Unexpected URL processing error',
        );

        try {
          await this.frontier.recordEvent(next.url, 'failed');
        } catch (recordErr) {
          logger.warn(
            { url: next.url, err: recordErr },
            'Failed to record crawl error',
          );
        }
      } finally {
        clearInterval(leaseTimer);
        try {
          await this.frontier.complete(workerId, next.url, next.domain);
        } catch (completeErr) {
          logger.warn({ url: next.url, err: completeErr }, 'Failed to remove URL from processing queue');
        }
        this.activeCount--;
        this.crawledCount++;
      }
    }
  }

  private async processUrl(url: string): Promise<void> {
    logger.debug({ url }, 'Processing URL');

    try {
      const allowed = await this.robots.isAllowed(url);

      if (!allowed) {
        await this.frontier.recordEvent(url, 'skipped');
        logger.debug({ url }, 'Blocked by robots.txt');
        return;
      }

      const { html } = await fetchUrl(url);

      const parsed = parseHtml(
        html,
        url,
        this.config.allowedPrefixes,
      );

      if (!parsed.text.trim()) {
        logger.warn(
          { url, title: parsed.title },
          'Page contained no extractable text',
        );
      }

      // Suppress content that already exists in the document store.
      if (await this.store.existsByContentHash(parsed.contentHash)) {
        await this.frontier.recordEvent(url, 'duplicate');

        logger.info(
          { url, wordCount: parsed.text.split(/\s+/).filter(Boolean).length },
          'Duplicate content skipped',
        );

        return;
      }

      const id = urlId(url);
      const wordCount = parsed.text
        .split(/\s+/)
        .filter(Boolean).length;

      const doc = {
        id,
        url,
        title: parsed.title,
        text: parsed.text,
        crawledAt: new Date().toISOString(),
        wordCount,
        contentHash: parsed.contentHash,
      };

      const isNew = await this.store.upsert(doc);

      // Publish the document even if the URL already existed in MongoDB.
      // The indexer can then refresh a missing or stale index entry.
      await this.redis.xadd(
        INDEXER_STREAM,
        '*',
        'id', id,
        'url', url,
        'title', parsed.title,
        'text', parsed.text.slice(0, 100_000),
        'crawledAt', doc.crawledAt,
        'wordCount', String(wordCount),
      );

      await this.frontier.recordEvent(url, 'success');

      logger.info(
        { url, wordCount, isNew },
        'Page crawled',
      );

      for (const link of parsed.links) {
        if (!this.running || this.stopRequested) {
          break;
        }

        const domain = extractDomain(link);

        await this.frontier.enqueue(link, domain);
      }
    } catch (err) {
      await this.frontier.recordEvent(url, 'failed');

      logger.warn(
        { url, err },
        'Crawl failed',
      );
    }
  }
}

function urlId(url: string): string {
  let hash = 5381;

  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) + hash + url.charCodeAt(i)) >>> 0;
  }

  return hash.toString(36);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
