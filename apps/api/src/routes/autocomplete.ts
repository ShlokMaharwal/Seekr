/**
 * Autocomplete route: GET /autocomplete?q=
 *
 * Returns up to 6 suggestions from the trie, ranked by frequency.
 * No caching needed — trie lookups are O(prefix length + K log K) in-memory.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { IndexManager } from '../index-manager.js';

const AutocompleteSchema = z.object({
  q: z.string().trim().min(1).max(100),
});

export function autocompleteRouter(indexManager: IndexManager): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const parsed = AutocompleteSchema.safeParse(req.query);
    if (!parsed.success) {
      res.json({ suggestions: [] });
      return;
    }

    const { q } = parsed.data;
    // Normalize the prefix the same way terms are indexed
    const prefix = q.toLowerCase().replace(/[^a-z0-9]/g, '');
    const suggestions = indexManager.trie.suggest(prefix, 6);
    res.json({ suggestions });
  });

  return router;
}
