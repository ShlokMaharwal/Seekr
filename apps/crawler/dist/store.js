/**
 * Document Store – MongoDB persistence for crawled documents.
 *
 * Collection: "documents"
 *   { _id: string (=id), url, title, text, crawledAt, wordCount, contentHash }
 *
 * Indexes:
 *   - url (unique)
 *   - contentHash (for duplicate detection)
 *   - crawledAt (for sorting)
 */
import { MongoClient } from 'mongodb';
import { logger } from './logger.js';
export class DocumentStore {
    client = null;
    collection = null;
    async connect(uri) {
        this.client = new MongoClient(uri);
        await this.client.connect();
        const db = this.client.db('seekr');
        this.collection = db.collection('documents');
        // Ensure indexes
        await this.collection.createIndex({ url: 1 }, { unique: true, background: true });
        await this.collection.createIndex({ contentHash: 1 }, { background: true });
        await this.collection.createIndex({ crawledAt: -1 }, { background: true });
        logger.info('DocumentStore connected');
    }
    async close() {
        await this.client?.close();
    }
    get col() {
        if (this.collection === null)
            throw new Error('DocumentStore not connected');
        return this.collection;
    }
    /**
     * Upsert a document by URL.
     * Returns true if the document was new, false if it was an update.
     */
    async upsert(doc) {
        const result = await this.col.updateOne({ url: doc.url }, { $set: doc }, { upsert: true });
        return result.upsertedCount > 0;
    }
    async findById(id) {
        return this.col.findOne({ id });
    }
    async findByUrl(url) {
        return this.col.findOne({ url });
    }
    async existsByContentHash(hash) {
        const doc = await this.col.findOne({ contentHash: hash }, { projection: { _id: 1 } });
        return doc !== null;
    }
    async count() {
        return this.col.estimatedDocumentCount();
    }
    /**
     * Stream all document IDs, URLs, and text for index rebuilding.
     */
    async *stream() {
        const cursor = this.col.find({}, { projection: { _id: 0 } });
        for await (const doc of cursor) {
            yield doc;
        }
    }
}
//# sourceMappingURL=store.js.map