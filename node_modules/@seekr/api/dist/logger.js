/**
 * Shared logger for the API process.
 */
import pino from 'pino';
export const logger = pino({
    name: 'seekr-api',
    level: process.env['LOG_LEVEL'] ?? 'info',
});
//# sourceMappingURL=logger.js.map