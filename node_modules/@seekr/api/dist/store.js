/**
 * MongoDB document store (shared between API and crawler).
 * Same implementation as apps/crawler/src/store.ts but scoped to the API app.
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
        await this.collection.createIndex({ url: 1 }, { unique: true, background: true });
        await this.collection.createIndex({ contentHash: 1 }, { background: true });
        logger.info('DocumentStore (API) connected');
    }
    async close() {
        await this.client?.close();
    }
    get col() {
        if (!this.collection)
            throw new Error('DocumentStore not connected');
        return this.collection;
    }
    async findById(id) {
        return this.col.findOne({ id }, { projection: { _id: 0 } });
    }
    async count() {
        return this.col.estimatedDocumentCount();
    }
    async *stream() {
        const cursor = this.col.find({}, { projection: { _id: 0 } });
        for await (const doc of cursor) {
            yield doc;
        }
    }
}
//# sourceMappingURL=store.js.map