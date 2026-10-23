import { Redis } from 'ioredis';
import { hostname } from 'node:os';
const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
  lazyConnect: true,
  connectTimeout: 2000,
  commandTimeout: 2000,
  maxRetriesPerRequest: 0,
});
try {
  await redis.connect();
  if (!(await redis.get(`crawler:heartbeat:${hostname()}`))) process.exitCode = 1;
} catch {
  process.exitCode = 1;
} finally {
  redis.disconnect();
}
