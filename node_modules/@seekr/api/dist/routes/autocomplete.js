/**
 * Autocomplete route: GET /autocomplete?q=
 *
 * Returns up to 6 suggestions from the trie, ranked by frequency.
 * No caching needed — trie lookups are O(prefix length + K log K) in-memory.
 */
import { Router } from 'express';
import { z } from 'zod';
const AutocompleteSchema = z.object({
    q: z.string().min(1).max(100),
});
export function autocompleteRouter(indexManager) {
    const router = Router();
    router.get('/', (req, res) => {
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
//# sourceMappingURL=autocomplete.js.map