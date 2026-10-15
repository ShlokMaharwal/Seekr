/**
 * Autocomplete route: GET /autocomplete?q=
 *
 * Returns up to 6 suggestions from the trie, ranked by frequency.
 * No caching needed — trie lookups are O(prefix length + K log K) in-memory.
 */
import { Router } from 'express';
import type { IndexManager } from '../index-manager.js';
export declare function autocompleteRouter(indexManager: IndexManager): Router;
//# sourceMappingURL=autocomplete.d.ts.map