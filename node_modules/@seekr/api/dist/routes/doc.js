/**
 * Document route: GET /doc/:id
 *
 * Fetches a single document from MongoDB by its ID.
 * Response: { id, title, url, text, crawledAt, wordCount }
 */
import { Router } from 'express';
export function docRouter(store) {
    const router = Router();
    router.get('/:id', async (req, res, next) => {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ error: 'Missing document ID' });
            return;
        }
        try {
            const doc = await store.findById(id);
            if (!doc) {
                res.status(404).json({ error: 'Document not found' });
                return;
            }
            res.json(doc);
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
//# sourceMappingURL=doc.js.map