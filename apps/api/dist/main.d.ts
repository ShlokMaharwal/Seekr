/**
 * API server entrypoint
 *
 * Boot sequence:
 *   1. Connect to Redis and MongoDB
 *   2. Load the index snapshot (or start fresh)
 *   3. Start the indexer consumer (Redis stream → in-memory index)
 *   4. Start the Express server
 *   5. Handle graceful shutdown on SIGTERM/SIGINT
 */
export {};
//# sourceMappingURL=main.d.ts.map