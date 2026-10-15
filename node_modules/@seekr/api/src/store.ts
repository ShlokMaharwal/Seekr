/**
 * MongoDB document store (shared between API and crawler).
 * Same implementation as apps/crawler/src/store.ts but scoped to the API app.
 */
import { type Collection, MongoClient } from 'mongodb';
import { type StoredDocument } from '@seekr/core';
import { logger } from './logger.js';

export class DocumentStore {
  private client: MongoClient | null = null;
  private collection: Collection<StoredDocument> | null = null;

  async connect(uri: string): Promise<void> {
    this.client = new MongoClient(uri);
    await this.client.connect();
    const db = this.client.db('seekr');
    this.collection = db.collection<StoredDocument>('documents');
    await this.collection.createIndex({ url: 1 }, { unique: true });
    await this.collection.createIndex({ contentHash: 1 });
    logger.info('DocumentStore (API) connected');
  }

  async close(): Promise<void> {
    await this.client?.close();
  }

  private get col(): Collection<StoredDocument> {
    if (!this.collection) throw new Error('DocumentStore not connected');
    return this.collection;
  }

  async findById(id: string): Promise<StoredDocument | null> {
    return this.col.findOne({ id }, { projection: { _id: 0 } });
  }

  async count(): Promise<number> {
    return this.col.estimatedDocumentCount();
  }

  async *stream(): AsyncGenerator<StoredDocument> {
    const cursor = this.col.find({}, { projection: { _id: 0 } });
    for await (const doc of cursor) {
      yield doc;
    }
  }
}
