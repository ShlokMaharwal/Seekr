/**
 * Logger – thin wrapper around pino for structured JSON logging.
 * All crawler modules import from here to share a single instance.
 */
import pino from 'pino';

export const logger = pino({
  name: 'seekr-crawler',
  level: process.env['LOG_LEVEL'] ?? 'info',
});
