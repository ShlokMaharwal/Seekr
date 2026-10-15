/**
 * Document route: GET /doc/:id
 *
 * Fetches a single document from MongoDB by its ID.
 * Response: { id, title, url, text, crawledAt, wordCount }
 */
import { Router } from 'express';
import type { DocumentStore } from '../store.js';
export declare function docRouter(store: DocumentStore): Router;
//# sourceMappingURL=doc.d.ts.map