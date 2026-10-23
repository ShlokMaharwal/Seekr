/**
 * Document route: GET /doc/:id
 *
 * Fetches a single document from MongoDB by its ID.
 * Response: { id, title, url, text, crawledAt, wordCount }
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { DocumentStore } from '../store.js';
import { z } from 'zod';

export function docRouter(store: DocumentStore): Router {
  const router = Router();

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (!z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/).safeParse(id).success) {
      res.status(400).json({ error: 'Missing document ID' });
      return;
    }

    try {
      const doc = await store.findById(id!);
      if (!doc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      res.json(doc);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
