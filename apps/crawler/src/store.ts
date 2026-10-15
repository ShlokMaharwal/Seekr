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

import { type Collection, MongoClient } from 'mongodb';
import { logger } from './logger.js';

/** Document as stored in MongoDB. */
export interface StoredDocument {
  id: string;
  url: string;
  title: string;
  text: string;
  crawledAt: string;
  wordCount: number;
  contentHash: string;
}

export class DocumentStore {
  private client: MongoClient | null = null;
  private collection: Collection<StoredDocument> | null = null;

  async connect(uri: string): Promise<void> {
    this.client = new MongoClient(uri);
    await this.client.connect();
    const db = this.client.db('seekr');
    this.collection = db.collection<StoredDocument>('documents');

    // Ensure indexes
    await this.collection.createIndex({ url: 1 }, { unique: true });
    await this.collection.createIndex({ contentHash: 1 });
    await this.collection.createIndex({ crawledAt: -1 });
    logger.info('DocumentStore connected');
  }

  async close(): Promise<void> {
    await this.client?.close();
  }

  private get col(): Collection<StoredDocument> {
    if (this.collection === null) throw new Error('DocumentStore not connected');
    return this.collection;
  }

  /**
   * Upsert a document by URL.
   * Returns true if the document was new, false if it was an update.
   */
  async upsert(doc: StoredDocument): Promise<boolean> {
    const result = await this.col.updateOne(
      { url: doc.url },
      { $set: doc },
      { upsert: true },
    );
    return result.upsertedCount > 0;
  }

  async findById(id: string): Promise<StoredDocument | null> {
    return this.col.findOne({ id });
  }

  async findByUrl(url: string): Promise<StoredDocument | null> {
    return this.col.findOne({ url });
  }

  async existsByContentHash(hash: string): Promise<boolean> {
    const doc = await this.col.findOne({ contentHash: hash }, { projection: { _id: 1 } });
    return doc !== null;
  }

  async count(): Promise<number> {
    return this.col.estimatedDocumentCount();
  }

  /**
   * Stream all document IDs, URLs, and text for index rebuilding.
   */
  async *stream(): AsyncGenerator<StoredDocument> {
    const cursor = this.col.find({}, { projection: { _id: 0 } });
    for await (const doc of cursor) {
      yield doc;
    }
  }
}
